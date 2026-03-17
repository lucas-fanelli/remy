import { NextRequest, NextResponse } from 'next/server';
import { MAX_PANTRY_ITEMS, MAX_ITEM_NAME_LENGTH, MAX_QUANTITY } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { extractBearerToken } from '@/lib/utils/auth';

// GET - Get user's pantry with all items
export async function GET(request: NextRequest) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get or create user's pantry
    const pantry = await prisma.userPantry.findUnique({
      where: { userId: payload.userId },
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
    console.error('Error fetching pantry:', error);
    return NextResponse.json({ error: 'Failed to fetch pantry' }, { status: 500 });
  }
}

// POST - Add item to pantry
export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
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

    if (expiresAt !== undefined && expiresAt !== null) {
      const parsedDate = new Date(expiresAt);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid expiry date' }, { status: 400 });
      }
    }

    // Get or create user's pantry and create item atomically
    const item = await prisma.$transaction(async (tx) => {
      let pantry = await tx.userPantry.findUnique({
        where: { userId: payload.userId },
      });

      if (!pantry) {
        pantry = await tx.userPantry.create({
          data: { userId: payload.userId },
        });
      }

      const itemCount = await tx.pantryItem.count({ where: { pantryId: pantry.id } });
      if (itemCount >= MAX_PANTRY_ITEMS) {
        throw new Error('PANTRY_LIMIT');
      }
      return tx.pantryItem.create({
        data: {
          pantryId: pantry.id,
          name: name.trim(),
          quantity: quantity !== undefined && quantity !== null ? parseFloat(quantity) : 0,
          unit: unit.trim(),
          category: category?.trim() || null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          notes: notes?.trim() || null,
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
    console.error('Error adding pantry item:', error);
    return NextResponse.json({ error: 'Failed to add item to pantry' }, { status: 500 });
  }
}
