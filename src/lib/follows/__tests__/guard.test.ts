/**
 * @jest-environment node
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import * as ts from 'typescript';

/**
 * "follows" and "follow_requests" are written by src/lib/follows and nothing else.
 *
 * Two rules keep following a private account safe, and the database can hold neither: a
 * pair is never in both tables, and every writer of a pair takes the same two locks in the
 * same order (requests.ts explains both). A writer anywhere else — a route that "just"
 * creates the follow — breaks both, and unit tests, which mock Prisma, would pass it: a
 * follow of a private account made without asking is a follower let in, with nothing
 * failing. This fails on it instead.
 *
 * Before the module, the follow and unfollow routes wrote "follows" themselves
 * (follow/route.ts: `prisma.follow.create`; unfollow/route.ts: `tx.follow.deleteMany`).
 * Nothing else did, the seed and the scripts included.
 *
 * Writes are found in the syntax tree rather than the text, so a comment quoting one is
 * not one, in three forms:
 * - a Prisma call: `<client>.follow.create(...)`, `tx.followRequest.deleteMany(...)`, ...;
 * - a nested write through a User relation: `data: { followers: { create: ... } }`;
 * - raw SQL: INSERT INTO, UPDATE, DELETE FROM or TRUNCATE on either table.
 */

const ROOT = path.resolve(__dirname, '../../../..');
const MODULE_DIR = 'src/lib/follows/';

/**
 * Where else a write is allowed, and why. By path rather than pinned to a line, because
 * neither place writes these tables today: both run by hand, outside any request, where
 * nothing races them and nobody should be notified — the two things the module is for.
 */
const MAY_WRITE: ReadonlyArray<{ path: RegExp; reason: string }> = [
  {
    path: /^prisma\/seed\.ts$/,
    reason:
      'fills an empty local database: it runs outside any request, before anyone could race ' +
      'it, and a seeded follow should not ring anyone',
  },
  {
    path: /^src\/scripts\//,
    reason:
      'one-off operations run by hand outside any request — a data fix, a pre-deploy check ' +
      'or conversion — where the owner decides what, if anything, anyone is told',
  },
];

/**
 * Every file of code in the repository, tracked or new — git's ignore rules keep
 * node_modules and build output out. Tests are left out: they mock these writes, and a
 * test's own fixture is not a writer.
 */
function codeFiles(): string[] {
  const out = execSync('git ls-files --cached --others --exclude-standard', {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => /\.[cm]?[jt]sx?$/.test(f))
    .filter((f) => !f.includes('__tests__/') && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(f))
    .filter((f) => existsSync(path.join(ROOT, f))); // deleted in the tree, not yet in the index
}

function parse(file: string, text = readFileSync(path.join(ROOT, file), 'utf8')): ts.SourceFile {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
}

/** The Prisma delegates of the two tables, and what writes through them. */
const MODELS = new Set(['follow', 'followRequest']);
const WRITES = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

/** The User relations onto the two tables, and what writes through them. */
const RELATIONS = new Set([
  'followers',
  'following',
  'followRequestsSent',
  'followRequestsReceived',
]);
const NESTED_WRITES = new Set([...WRITES, 'connect', 'connectOrCreate', 'set', 'disconnect']);

// Keywords in either case before a quoted table name; a bare name only after upper-case
// keywords, so a sentence such as 'Could not update follows' is not SQL.
const TABLE_WRITE = String.raw`(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+(?:ONLY\s+)?`;
const RAW_WRITE_QUOTED = new RegExp(String.raw`\b${TABLE_WRITE}"(?:follows|follow_requests)"`, 'i');
const RAW_WRITE_BARE = new RegExp(String.raw`\b${TABLE_WRITE}(?:follows|follow_requests)\b`);

const nameOf = (name: ts.PropertyName): string | null =>
  ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null;

interface Write {
  file: string;
  line: number;
  what: string;
}

function writeIn(node: ts.Node): string | null {
  // prisma.follow.create(...), tx.followRequest.deleteMany(...)
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    WRITES.has(node.expression.name.text) &&
    ts.isPropertyAccessExpression(node.expression.expression) &&
    MODELS.has(node.expression.expression.name.text)
  ) {
    return `${node.expression.expression.name.text}.${node.expression.name.text}`;
  }

  // data: { followers: { create: { ... } } }
  if (
    ts.isPropertyAssignment(node) &&
    RELATIONS.has(nameOf(node.name) ?? '') &&
    ts.isObjectLiteralExpression(node.initializer)
  ) {
    const op = node.initializer.properties
      .map((p) => (p.name ? nameOf(p.name) : null))
      .find((name) => name !== null && NESTED_WRITES.has(name));
    if (op) return `${nameOf(node.name)}.${op}`;
  }

  // DELETE FROM "follows" — in a raw template, or any other string of SQL
  if (ts.isStringLiteral(node) || ts.isTemplateLiteralToken(node)) {
    const sql = RAW_WRITE_QUOTED.exec(node.text) ?? RAW_WRITE_BARE.exec(node.text);
    if (sql) return `raw ${sql[0].replace(/\s+/g, ' ')}`;
  }

  return null;
}

function writesIn(source: ts.SourceFile): Write[] {
  const writes: Write[] = [];
  const visit = (node: ts.Node) => {
    const what = writeIn(node);
    if (what) {
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      writes.push({ file: source.fileName, line, what });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return writes;
}

describe('follows and follow_requests are written only by src/lib/follows', () => {
  const files = codeFiles();
  const writes = files.flatMap((file) => writesIn(parse(file)));

  it('scans the code it is guarding', () => {
    // A guard reading an empty file list passes forever.
    expect(files.length).toBeGreaterThan(200);
    expect(files).toEqual(
      expect.arrayContaining([
        `${MODULE_DIR}requests.ts`,
        'src/app/api/users/[username]/follow/route.ts',
        'src/app/api/users/[username]/unfollow/route.ts',
        'src/infrastructure/repositories/UserRepository.ts',
        'prisma/seed.ts',
      ])
    );
  });

  it('recognises the writes of the one module allowed to make them', () => {
    // If the scan cannot see them there, it cannot see them anywhere.
    const own = writesIn(parse(`${MODULE_DIR}requests.ts`)).map((w) => w.what);

    expect(own).toEqual(
      expect.arrayContaining([
        'follow.createMany',
        'follow.deleteMany',
        'followRequest.createMany',
        'followRequest.deleteMany',
        'raw DELETE FROM "follow_requests"',
      ])
    );
  });

  it.each<[string, string, string[]]>([
    ['a create', 'await prisma.follow.create({ data });', ['follow.create']],
    ['a delete in a transaction', 'await tx.follow.deleteMany({ where });', ['follow.deleteMany']],
    [
      'a request insert through a repository',
      'await this.prisma.followRequest.createMany({ data });',
      ['followRequest.createMany'],
    ],
    ['an upsert', 'db.follow.upsert({ where, create, update });', ['follow.upsert']],
    [
      'a nested create through a user',
      'prisma.user.update({ where, data: { followers: { create: { followerId } } } });',
      ['followers.create'],
    ],
    [
      'a nested delete of requests',
      "prisma.user.update({ where, data: { 'followRequestsSent': { deleteMany: {} } } });",
      ['followRequestsSent.deleteMany'],
    ],
    [
      'raw SQL',
      'tx.$executeRaw`DELETE FROM "follows" WHERE "followerId" = ${id}`;',
      ['raw DELETE FROM "follows"'],
    ],
    [
      'raw SQL with a bare table name',
      'tx.$executeRaw`INSERT INTO follow_requests (id) VALUES (${id})`;',
      ['raw INSERT INTO follow_requests'],
    ],
    [
      'raw SQL in lower case',
      'db.$executeRawUnsafe(\'update "follows" set "createdAt" = now()\');',
      ['raw update "follows"'],
    ],
    ['a count', 'prisma.follow.count({ where });', []],
    ['a lookup', 'tx.followRequest.findUnique({ where });', []],
    ['a relation count', 'const a = { _count: { select: { followers: true } } };', []],
    ['a relation filter', 'const where = { followers: { some: { followerId: id } } };', []],
    [
      'a relation select',
      'const select = { following: { select: { username: true }, take: 10 } };',
      [],
    ],
    ['a raw read', 'tx.$queryRaw`SELECT 1 FROM "follows" f WHERE f."followerId" = ${id}`;', []],
    [
      'a comment quoting a write',
      '// was prisma.follow.create(...), then DELETE FROM "follows"\nconst a = 1;',
      [],
    ],
    ['a sentence', "const message = 'Could not update follows';", []],
  ])('in %s finds %p', (_what, code, expected) => {
    expect(writesIn(parse('probe.ts', code)).map((w) => w.what)).toEqual(expected);
  });

  it('finds no write anywhere else', () => {
    // Follow, unfollow, accept, decline, remove a follower, the private → public sweep:
    // call src/lib/follows/requests.ts. Read the state with src/lib/follows/state.ts.
    const offenders = writes
      .filter((w) => !w.file.startsWith(MODULE_DIR))
      .filter((w) => !MAY_WRITE.some((allowed) => allowed.path.test(w.file)))
      .map(({ file, line, what }) => `${file}:${line} ${what}`);

    expect(offenders).toEqual([]);
  });

  it('allows only places that exist', () => {
    // An allowance whose files were moved would let the next writer at its old path in.
    const dangling = MAY_WRITE.filter((allowed) => !files.some((f) => allowed.path.test(f))).map(
      (allowed) => String(allowed.path)
    );

    expect(dangling).toEqual([]);
  });
});
