import { NextRequest, NextResponse } from 'next/server';
import striptags from 'striptags';
import { requireAuth } from '@/lib/api/auth';
import { MAX_ITEM_NAME_LENGTH, MAX_NOTES_LENGTH, MAX_QUANTITY, UUID_REGEX } from '@/lib/constants';
import prisma from '@/lib/database/prisma';
import { logServerError } from '@/lib/utils/logger';
import { requireJsonContentType } from '@/lib/utils/request';

// PUT - Update pantry item
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

    const { id: itemId } = await params;

    if (!UUID_REGEX.test(itemId)) {
      return NextResponse.json(
        { error: 'Invalid ID format', code: 'request.invalidId' },
        { status: 400 }
      );
    }

    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'invalidRequest' },
        { status: 400 }
      );
    }
    const { name, quantity, unit, category, expiresAt, notes } = body;

    // Validation
    if (name !== undefined && name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Item name cannot be empty', code: 'pantry.nameEmpty' },
        { status: 400 }
      );
    }

    if (name !== undefined && name.length > MAX_ITEM_NAME_LENGTH) {
      return NextResponse.json(
        { error: 'Item name too long (max 200 characters)', code: 'pantry.nameTooLong' },
        { status: 400 }
      );
    }

    if (unit !== undefined && unit.trim().length === 0) {
      return NextResponse.json(
        { error: 'Unit cannot be empty', code: 'pantry.unitEmpty' },
        { status: 400 }
      );
    }

    if (unit && unit.length > 50) {
      return NextResponse.json(
        { error: 'Unit too long (max 50 characters)', code: 'pantry.unitTooLong' },
        { status: 400 }
      );
    }

    // quantity: 0 is valid (represents "to taste" or "as needed" items)
    let normalizedQuantity: number | undefined;
    if (quantity !== undefined) {
      normalizedQuantity = parseFloat(quantity);
      if (isNaN(normalizedQuantity) || !isFinite(normalizedQuantity)) {
        return NextResponse.json(
          { error: 'Quantity must be a valid number', code: 'pantry.quantityInvalid' },
          { status: 400 }
        );
      }
      if (normalizedQuantity < 0) {
        return NextResponse.json(
          { error: 'Quantity cannot be negative', code: 'pantry.quantityNegative' },
          { status: 400 }
        );
      }
      if (normalizedQuantity > MAX_QUANTITY) {
        return NextResponse.json(
          { error: 'Quantity too large', code: 'pantry.quantityTooLarge' },
          { status: 400 }
        );
      }
      // Normalize -0 to 0
      if (Object.is(normalizedQuantity, -0)) normalizedQuantity = 0;
    }

    if (expiresAt !== undefined && expiresAt !== null) {
      const parsedDate = new Date(expiresAt);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid expiry date', code: 'pantry.invalidExpiryDate' },
          { status: 400 }
        );
      }
    }

    if (notes !== undefined && notes !== null && notes.length > MAX_NOTES_LENGTH) {
      return NextResponse.json(
        {
          error: `Notes too long (max ${MAX_NOTES_LENGTH} characters)`,
          code: 'pantry.notesTooLong',
        },
        { status: 400 }
      );
    }

    // Custom categories are intentionally allowed (freeSolo Autocomplete on the client).
    // The length limit is the only server-side constraint.
    if (category !== undefined && category !== null && category.length > MAX_ITEM_NAME_LENGTH) {
      return NextResponse.json(
        {
          error: `Category too long (max ${MAX_ITEM_NAME_LENGTH} characters)`,
          code: 'pantry.categoryTooLong',
        },
        { status: 400 }
      );
    }

    // Sanitize category to strip any HTML tags
    const sanitizedCategory =
      category !== undefined ? (category ? striptags(category).trim() : category) : undefined;

    // Atomic ownership check + update in one query, returning the updated item directly.
    // Uses Prisma's compound where to enforce ownership without a separate findUnique.
    try {
      const updatedItem = await prisma.pantryItem.update({
        where: {
          id: itemId,
          pantry: { userId: user.id },
        },
        data: {
          ...(name !== undefined && { name: striptags(name.trim()) }),
          ...(normalizedQuantity !== undefined && { quantity: normalizedQuantity }),
          ...(unit !== undefined && { unit: unit.trim() }),
          ...(sanitizedCategory !== undefined && { category: sanitizedCategory?.trim() || null }),
          ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
          ...(notes !== undefined && { notes: notes ? striptags(notes.trim()) || null : null }),
        },
      });

      return NextResponse.json({
        item: updatedItem,
        message: 'Item updated successfully',
      });
    } catch (e) {
      // Prisma throws P2025 when the where clause (including ownership) doesn't match
      if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
        return NextResponse.json(
          { error: 'Item not found or unauthorized', code: 'pantry.itemNotFound' },
          { status: 404 }
        );
      }
      throw e;
    }
  } catch (error) {
    logServerError('Error updating pantry item:', error);
    return NextResponse.json(
      { error: 'Failed to update item', code: 'pantry.updateFailed' },
      { status: 500 }
    );
  }
}

// DELETE - Delete pantry item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;

    if (!UUID_REGEX.test(itemId)) {
      return NextResponse.json(
        { error: 'Invalid ID format', code: 'request.invalidId' },
        { status: 400 }
      );
    }

    let user;
    try {
      user = await requireAuth(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    // Atomic ownership check + delete (no TOCTOU)
    const { count } = await prisma.pantryItem.deleteMany({
      where: {
        id: itemId,
        pantry: { userId: user.id },
      },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: 'Item not found or unauthorized', code: 'pantry.itemNotFound' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Item deleted successfully',
    });
  } catch (error) {
    logServerError('Error deleting pantry item:', error);
    return NextResponse.json(
      { error: 'Failed to delete item', code: 'pantry.deleteFailed' },
      { status: 500 }
    );
  }
}
