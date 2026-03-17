import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

// PUT - Update pantry item
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: itemId } = await params;

    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if item exists and belongs to user
    const item = await prisma.pantryItem.findUnique({
      where: { id: itemId },
      include: { pantry: true },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (item.pantry.userId !== payload.userId) {
      return NextResponse.json(
        { error: 'You do not have permission to update this item' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, quantity, unit, category, expiresAt, notes } = body;

    // Validation
    if (name !== undefined && name.trim().length === 0) {
      return NextResponse.json({ error: 'Item name cannot be empty' }, { status: 400 });
    }

    if (unit !== undefined && unit.trim().length === 0) {
      return NextResponse.json({ error: 'Unit cannot be empty' }, { status: 400 });
    }

    // Validate quantity: must be a valid non-negative number
    if (quantity !== undefined) {
      const parsed = parseFloat(quantity);
      if (isNaN(parsed)) {
        return NextResponse.json({ error: 'Quantity must be a valid number' }, { status: 400 });
      }
      if (parsed < 0) {
        return NextResponse.json({ error: 'Quantity cannot be negative' }, { status: 400 });
      }
    }

    // Update item
    const updatedItem = await prisma.pantryItem.update({
      where: { id: itemId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(quantity !== undefined && { quantity: parseFloat(quantity) }),
        ...(unit !== undefined && { unit: unit.trim() }),
        ...(category !== undefined && { category: category?.trim() || null }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
    });

    return NextResponse.json({
      item: updatedItem,
      message: 'Item updated successfully',
    });
  } catch (error) {
    console.error('Error updating pantry item:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

// DELETE - Delete pantry item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;

    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if item exists and belongs to user
    const item = await prisma.pantryItem.findUnique({
      where: { id: itemId },
      include: { pantry: true },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (item.pantry.userId !== payload.userId) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this item' },
        { status: 403 }
      );
    }

    // Delete item
    await prisma.pantryItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({
      message: 'Item deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting pantry item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
