/**
 * @jest-environment node
 *
 * Guards the raw SQL in the codebase. Unit tests mock Prisma, so a raw query that
 * PostgreSQL rejects (wrong table name, wrong function signature) is never executed
 * by the rest of the suite — these checks catch those mistakes statically.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const SRC = path.join(ROOT, 'src');

interface RawQuery {
  location: string;
  sql: string;
}

/** Model name -> real table name, for every model that declares @@map in schema.prisma */
function readMappedModels(): Map<string, string> {
  const schema = fs.readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf8');
  const mapped = new Map<string, string>();
  for (const [, model, body] of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const table = body.match(/@@map\("([^"]+)"\)/)?.[1];
    if (table && table !== model) mapped.set(model, table);
  }
  return mapped;
}

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : listSourceFiles(fullPath);
    }
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [fullPath] : [];
  });
}

/** Extracts the template literal of every $executeRaw`...` / $queryRaw<T>`...` call */
function extractRawQueries(file: string): RawQuery[] {
  const source = fs.readFileSync(file, 'utf8');
  const queries: RawQuery[] = [];
  for (const match of source.matchAll(/\$(?:executeRaw|queryRaw)\b/g)) {
    const start = match.index ?? 0;
    const open = source.indexOf('`', start);
    const paren = source.indexOf('(', start);
    // `$queryRawUnsafe(...)`-style calls have no tagged template to inspect
    if (open === -1 || (paren !== -1 && paren < open)) continue;
    const close = source.indexOf('`', open + 1);
    const line = source.slice(0, start).split('\n').length;
    queries.push({
      location: `${path.relative(ROOT, file).replace(/\\/g, '/')}:${line}`,
      sql: source.slice(open + 1, close),
    });
  }
  return queries;
}

describe('raw SQL conventions', () => {
  const mappedModels = readMappedModels();
  const rawQueries = listSourceFiles(SRC).flatMap(extractRawQueries);

  it('should find the mapped models and the raw queries it is meant to guard', () => {
    expect(mappedModels.get('Post')).toBe('posts');
    expect(mappedModels.get('UserPantry')).toBe('user_pantries');
    expect(rawQueries.length).toBeGreaterThan(10);
  });

  it('should reference real table names (@@map), never Prisma model names', () => {
    const offenders = rawQueries.flatMap(({ location, sql }) =>
      [...mappedModels]
        .filter(([model]) => new RegExp(`\\b(?:FROM|JOIN|UPDATE|INTO)\\s+"${model}"`).test(sql))
        .map(([model, table]) => `${location} uses "${model}" — the table is "${table}"`)
    );

    expect(offenders).toEqual([]);
  });

  it('should cast the first key of two-key advisory locks to int', () => {
    // Prisma binds JS numbers as bigint and PostgreSQL only defines (int, int):
    // "function pg_advisory_xact_lock(bigint, integer) does not exist"
    const offenders = rawQueries
      .filter(({ sql }) => /pg_(?:try_)?advisory_(?:xact_)?lock\(\s*\$\{[^}]+\}\s*,/.test(sql))
      .map(({ location }) => `${location} must use \${KEY}::int`);

    expect(offenders).toEqual([]);
  });

  it('should not combine LIKE ANY(...) with an ESCAPE clause', () => {
    // PostgreSQL: syntax error at or near "ESCAPE"
    const offenders = rawQueries
      .filter(({ sql }) => /LIKE\s+ANY\s*\([\s\S]*?\)\s*ESCAPE\b/i.test(sql))
      .map(({ location }) => location);

    expect(offenders).toEqual([]);
  });

  it('should not use FOR UPDATE on an aggregate query', () => {
    // PostgreSQL: FOR UPDATE is not allowed with aggregate functions
    const offenders = rawQueries
      .filter(({ sql }) => /\bCOUNT\s*\(/i.test(sql) && /\bFOR\s+UPDATE\b/i.test(sql))
      .map(({ location }) => location);

    expect(offenders).toEqual([]);
  });
});
