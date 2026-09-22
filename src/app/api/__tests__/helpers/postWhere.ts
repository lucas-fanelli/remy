import { Prisma } from '@prisma/client';

/** A post as the mocked database holds it: its columns, plus `user` for the author. */
export type PostRow = Record<string, unknown>;

/**
 * Whether a Post `where` lets `row` through — a small stand-in for PostgreSQL, so a route
 * test can back its mocked prisma.post.findMany with a few rows and get back the ones the
 * route's filter really admits:
 *
 *   findMany: jest.fn(({ where }) => rows.filter((row) => admits(where, row)))
 *
 * Asserting the where's shape instead would pin how a route spells its filter; this pins
 * what the filter does. It is what catches the mistake visibility.ts warns about: the
 * privacy rule spread beside a text search's OR, where one OR silently replaces the other
 * and the object still looks plausible.
 *
 * It knows only the filters the recipe lists use, and throws on anything else, so a filter
 * cannot pass a test by being ignored. The follower arm S3 adds to visiblePostsWhere
 * (`user: { followers: { some: ... } }`) is one it will have to learn.
 */
export function admits(where: object, row: PostRow): boolean {
  return Object.entries(where).every(([field, condition]) => {
    if (condition === undefined) return true;
    if (field === 'AND') return ([] as object[]).concat(condition).every((w) => admits(w, row));
    if (field === 'OR') return (condition as object[]).some((w) => admits(w, row));

    const value = row[field];
    // A to-one relation, like `user: { isPrivate: false }`: the same question, one level down.
    if (isRecord(value)) return admits(condition as object, value);
    if (isRecord(condition)) return meets(value, condition, field);
    return value === condition;
  });
}

/** A plain object: a relation's row, or a filter. Not an array, a Date or Prisma.DbNull. */
function isRecord(value: unknown): value is PostRow {
  return (
    typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

/** A scalar filter: `{ contains, mode }`, `{ in }`, `{ lte, gte }` or `{ not }`. */
function meets(value: unknown, filter: PostRow, field: string): boolean {
  const insensitive = filter.mode === 'insensitive';
  return Object.entries(filter).every(([operator, operand]) => {
    switch (operator) {
      case 'mode':
        return true;
      case 'contains': {
        if (typeof value !== 'string') return false;
        const needle = String(operand);
        return insensitive
          ? value.toLowerCase().includes(needle.toLowerCase())
          : value.includes(needle);
      }
      case 'in':
        return (operand as unknown[]).includes(value);
      case 'lte':
        return typeof value === 'number' && value <= (operand as number);
      case 'gte':
        return typeof value === 'number' && value >= (operand as number);
      case 'not':
        return operand === Prisma.DbNull
          ? value !== null && value !== undefined
          : value !== operand;
      default:
        throw new Error(
          `admits() does not know ${field}.${operator}; teach it before relying on it`
        );
    }
  });
}
