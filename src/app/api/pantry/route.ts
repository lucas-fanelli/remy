import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

// GET - Get user's pantry with all items
export async function GET(request: NextRequest) {
  try {
    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get or create user's pantry
    let pantry = await prisma.userPantry.findUnique({
      where: { userId: payload.userId },
      include: {
        items: {
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        },
      },
    });

    // Create pantry if it doesn't exist
    if (!pantry) {
      pantry = await prisma.userPantry.create({
        data: {
          userId: payload.userId,
        },
        include: {
          items: true,
        },
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
    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { name, quantity, unit, category, expiresAt, notes } = body;

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
    }

    if (quantity !== undefined && quantity !== null) {
      const parsed = parseFloat(quantity);
      if (isNaN(parsed) || !isFinite(parsed)) {
        return NextResponse.json({ error: 'Quantity must be a valid number' }, { status: 400 });
      }
      if (parsed < 0) {
        return NextResponse.json({ error: 'Quantity cannot be negative' }, { status: 400 });
      }
    }

    if (!unit || unit.trim().length === 0) {
      return NextResponse.json({ error: 'Unit is required' }, { status: 400 });
    }

    // Get or create user's pantry
    let pantry = await prisma.userPantry.findUnique({
      where: { userId: payload.userId },
    });

    if (!pantry) {
      pantry = await prisma.userPantry.create({
        data: { userId: payload.userId },
      });
    }

    // Create pantry item
    const item = await prisma.pantryItem.create({
      data: {
        pantryId: pantry.id,
        name: name.trim(),
        quantity: parseFloat(quantity),
        unit: unit.trim(),
        category: category?.trim() || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json(
      {
        item,
        message: 'Item added to pantry successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding pantry item:', error);
    return NextResponse.json({ error: 'Failed to add item to pantry' }, { status: 500 });
  }
}
