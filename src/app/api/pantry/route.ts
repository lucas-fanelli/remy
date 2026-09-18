import { NextRequest, NextResponse } from 'next/server';
import striptags from 'striptags';
import { requireAuth } from '@/lib/api/auth';
import {
  MAX_PANTRY_ITEMS,
  MAX_ITEM_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_QUANTITY,
} from '@/lib/constants';
import prisma from '@/lib/database/prisma';
import { logServerError } from '@/lib/utils/logger';
import { requireJsonContentType } from '@/lib/utils/request';

// GET - Get user's pantry with all items
export async function GET(request: NextRequest) {
  try {
    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create user's pantry
    const pantry = await prisma.userPantry.findUnique({
      where: { userId: user.id },
      include: {
        items: {
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        },
      },
    });

    // Return empty pantry if none exists (don't create on GET)
    if (!pantry) {
      return NextResponse.json({
        pantry: { id: null, items: [], updatedAt: null },
      });
    }

    return NextResponse.json({
      pantry: {
        id: pantry.id,
        items: pantry.items,
        updatedAt: pantry.updatedAt,
      },
    });
  } catch (error) {
    logServerError('Error fetching pantry:', error);
    return NextResponse.json({ error: 'Failed to fetch pantry' }, { status: 500 });
  }
}

// POST - Add item to pantry
export async function POST(request: NextRequest) {
  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { name, quantity, unit, category, expiresAt, notes } = body;

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
    }

    if (name.length > MAX_ITEM_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Item name too long (max ${MAX_ITEM_NAME_LENGTH} characters)` },
        { status: 400 }
      );
    }

    // quantity: 0 is valid (represents "to taste" or "as needed" items)
    if (quantity !== undefined && quantity !== null) {
      const parsed = parseFloat(quantity);
      if (isNaN(parsed) || !isFinite(parsed)) {
        return NextResponse.json({ error: 'Quantity must be a valid number' }, { status: 400 });
      }
      if (parsed < 0) {
        return NextResponse.json({ error: 'Quantity cannot be negative' }, { status: 400 });
      }
      if (parsed > MAX_QUANTITY) {
        return NextResponse.json({ error: 'Quantity too large' }, { status: 400 });
      }
    }

    if (!unit || unit.trim().length === 0) {
      return NextResponse.json({ error: 'Unit is required' }, { status: 400 });
    }

    if (unit.length > 50) {
      return NextResponse.json({ error: 'Unit too long (max 50 characters)' }, { status: 400 });
    }

    if (expiresAt !== undefined && expiresAt !== null) {
      const parsedDate = new Date(expiresAt);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid expiry date' }, { status: 400 });
      }
    }

    // Custom categories are intentionally allowed (freeSolo Autocomplete on the client).
    // The length limit is the only server-side constraint.
    if (category !== undefined && category !== null && category.length > MAX_ITEM_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Category too long (max ${MAX_ITEM_NAME_LENGTH} characters)` },
        { status: 400 }
      );
    }

    if (notes !== undefined && notes !== null && notes.length > MAX_NOTES_LENGTH) {
      return NextResponse.json(
        { error: `Notes too long (max ${MAX_NOTES_LENGTH} characters)` },
        { status: 400 }
      );
    }

    // Sanitize category to strip any HTML tags
    const sanitizedCategory = category ? striptags(category).trim() : category;

    // Get or create user's pantry and create item atomically
    const item = await prisma.$transaction(async (tx) => {
      let pantry = await tx.userPantry.findUnique({
        where: { userId: user.id },
      });

      if (!pantry) {
        pantry = await tx.userPantry.create({
          data: { userId: user.id },
        });
      }

      // Lock the pantry row to prevent concurrent inserts from bypassing the item limit
      await tx.$executeRaw`SELECT id FROM "user_pantries" WHERE id = ${pantry.id} FOR UPDATE`;

      const itemCount = await tx.pantryItem.count({ where: { pantryId: pantry.id } });
      if (itemCount >= MAX_PANTRY_ITEMS) {
        throw new Error('PANTRY_LIMIT');
      }

      const existingItem = await tx.pantryItem.findFirst({
        where: { pantryId: pantry.id, name: { equals: name.trim(), mode: 'insensitive' } },
      });
      if (existingItem) {
        throw new Error('DUPLICATE_ITEM');
      }

      const sanitizedName = striptags(name.trim());

      return tx.pantryItem.create({
        data: {
          pantryId: pantry.id,
          name: sanitizedName,
          quantity: quantity !== undefined && quantity !== null ? parseFloat(quantity) : 0,
          unit: unit.trim(),
          category: sanitizedCategory?.trim() || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          notes: notes ? striptags(notes.trim()) || null : null,
        },
      });
    });

    return NextResponse.json(
      {
        item,
        message: 'Item added to pantry successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'PANTRY_LIMIT') {
      return NextResponse.json(
        { error: `Pantry item limit reached (${MAX_PANTRY_ITEMS})` },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === 'DUPLICATE_ITEM') {
      return NextResponse.json(
        { error: 'An item with this name already exists in your pantry' },
        { status: 409 }
      );
    }
    logServerError('Error adding pantry item:', error);
    return NextResponse.json({ error: 'Failed to add item to pantry' }, { status: 500 });
  }
}
