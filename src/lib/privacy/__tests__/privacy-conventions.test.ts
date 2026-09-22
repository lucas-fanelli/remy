/**
 * @jest-environment node
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import * as ts from 'typescript';

/**
 * Who may see a private account's recipes is decided in one file,
 * src/lib/privacy/visibility.ts. These checks keep it there.
 *
 * Before that file, the rule had been copied into eleven places, and the copies disagreed:
 * the `user: { isPrivate: false }` filters hid a private author's own recipes from them,
 * while the `isPrivate && viewer !== owner` checks let the author in. Unit tests mock
 * Prisma, so every copy passed its own suite. Part one fails on a new copy in any of the
 * three spellings the old ones used.
 *
 * Part one cannot see the worse leak: a route with no copy at all. Every recipe-scoped
 * route (like, save, rating, comments, cook-plan, mark-cooked) checked at most that the
 * recipe existed, and none of those checks spells anything part one looks for. So part two
 * asks the positive question of each handler reached through a recipe id: does it call
 * canSeePost?
 *
 * Both parts read the syntax tree rather than the text, so a comment that quotes the old
 * spelling while explaining why it went is not a copy.
 */

const ROOT = path.resolve(__dirname, '../../../..');
const RULE_FILE = 'src/lib/privacy/visibility.ts';
const MATCH_ROUTE = 'src/app/api/recipes/match/route.ts';

/**
 * Server source under src/app/api, src/infrastructure and src/lib, tracked or new — git's
 * ignore rules keep build output out. Tests are left out: their fixtures say
 * `isPrivate: false` because that is what a user row looks like.
 */
function serverFiles(): string[] {
  const out = execSync(
    'git ls-files --cached --others --exclude-standard -- src/app/api src/infrastructure src/lib',
    { cwd: ROOT, encoding: 'utf8' }
  );
  return out
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !f.includes('__tests__') && !/\.(test|spec)\./.test(f))
    .filter((f) => existsSync(path.join(ROOT, f))); // deleted in the tree, not yet in the index
}

function parse(file: string, text = readFileSync(path.join(ROOT, file), 'utf8')): ts.SourceFile {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
}

function lineOf(node: ts.Node): number {
  return node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

/** 'UserRepository.search', 'GET' — the named function or method a node sits in. */
function enclosingName(node: ts.Node): string {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isMethodDeclaration(n)) {
      const owner = ts.isClassLike(n.parent) && n.parent.name ? `${n.parent.name.text}.` : '';
      return owner + n.name.getText();
    }
    if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
    ) {
      return n.name.text;
    }
  }
  return '(top level)';
}

/** Whether `node` contains a call to a function or method called `name`. */
function callsFunction(node: ts.Node, name: string): boolean {
  if (ts.isCallExpression(node)) {
    const callee = node.expression;
    if (ts.isIdentifier(callee) && callee.text === name) return true;
    if (ts.isPropertyAccessExpression(callee) && callee.name.text === name) return true;
  }
  return ts.forEachChild(node, (child) => callsFunction(child, name) || undefined) ?? false;
}

// ---------------------------------------------------------------------------------------
// Part one: the rule is written in one file
// ---------------------------------------------------------------------------------------

type Spelling = 'isPrivate: false' | 'isPrivate &&' | '"isPrivate" = false';

interface RuleCopy {
  file: string;
  line: number;
  inside: string;
  spelling: Spelling;
}

// Also catches the SQL spelled `IS FALSE` or `IS NOT TRUE`, in any case.
const RAW_PUBLIC_ONLY = /"isPrivate"\s*(?:=\s*false|IS\s+(?:FALSE|NOT\s+TRUE))\b/i;

function readsIsPrivate(expression: ts.Expression): boolean {
  let e = expression;
  // `a && user.isPrivate && b` parses as `(a && user.isPrivate) && b`
  while (
    ts.isBinaryExpression(e) &&
    e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    e = e.right;
  }
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  return (
    (ts.isPropertyAccessExpression(e) && e.name.text === 'isPrivate') ||
    (ts.isIdentifier(e) && e.text === 'isPrivate')
  );
}

function spellingOf(node: ts.Node): Spelling | null {
  // where: { user: { isPrivate: false } }
  if (
    ts.isPropertyAssignment(node) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
    node.name.text === 'isPrivate' &&
    node.initializer.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return 'isPrivate: false';
  }
  // if (user.isPrivate && currentUserId !== user.id)
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
    readsIsPrivate(node.left)
  ) {
    return 'isPrivate &&';
  }
  // WHERE u."isPrivate" = false — in a $queryRaw template, or any other string of SQL
  if (
    (ts.isStringLiteral(node) || ts.isTemplateLiteralToken(node)) &&
    RAW_PUBLIC_ONLY.test(node.text)
  ) {
    return '"isPrivate" = false';
  }
  return null;
}

function ruleCopiesIn(source: ts.SourceFile): RuleCopy[] {
  const copies: RuleCopy[] = [];
  const visit = (node: ts.Node) => {
    const spelling = spellingOf(node);
    if (spelling) {
      copies.push({
        file: source.fileName,
        line: lineOf(node),
        inside: enclosingName(node),
        spelling,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return copies;
}

/**
 * Copies that are not the content rule, or cannot call visiblePostsWhere. Each is pinned to
 * the function it sits in and to one spelling, so the match route's raw SQL being allowed
 * does not let a Prisma filter back into the same file.
 */
const ALLOWED: ReadonlyArray<Omit<RuleCopy, 'line'> & { reason: string }> = [
  {
    file: 'src/infrastructure/repositories/UserRepository.ts',
    inside: 'UserRepository.search',
    spelling: 'isPrivate: false',
    reason:
      'people search hides private ACCOUNTS, which is a header decision, not content; S3 ' +
      'drops the filter so a private account can be found and asked to follow',
  },
  {
    file: MATCH_ROUTE,
    inside: 'GET',
    spelling: '"isPrivate" = false',
    reason:
      'raw SQL cannot call visiblePostsWhere; the rule stays inline so ' +
      'raw-sql-conventions.test.ts keeps checking its table names, and a test below pins ' +
      'its owner arm',
  },
];

const isAllowed = (copy: RuleCopy) =>
  ALLOWED.some(
    (a) => a.file === copy.file && a.inside === copy.inside && a.spelling === copy.spelling
  );

describe('the privacy rule is written in one file', () => {
  const files = serverFiles();
  const copies = files.filter((f) => f !== RULE_FILE).flatMap((f) => ruleCopiesIn(parse(f)));

  it('scans the server code it is guarding', () => {
    // A guard reading an empty file list passes forever.
    expect(files.length).toBeGreaterThan(50);
    expect(files).toEqual(
      expect.arrayContaining([
        RULE_FILE,
        MATCH_ROUTE,
        'src/app/api/recipes/route.ts',
        'src/app/api/search/route.ts',
        'src/app/api/users/[username]/profile/route.ts',
        'src/infrastructure/services/RecipeService.ts',
        'src/infrastructure/repositories/UserRepository.ts',
      ])
    );
  });

  it('recognises the spelling in the one file allowed to write it', () => {
    // visiblePostsWhere is built on `user: { isPrivate: false }` — if the scan cannot see it
    // there, it cannot see it anywhere.
    expect(ruleCopiesIn(parse(RULE_FILE)).map((c) => c.spelling)).toContain('isPrivate: false');
  });

  it.each<[string, string, Spelling[]]>([
    ['a Prisma filter', 'const where = { user: { isPrivate: false } };', ['isPrivate: false']],
    ['a quoted key', "const where = { 'isPrivate': false };", ['isPrivate: false']],
    ['an inline check', 'if (user.isPrivate && viewerId !== user.id) deny();', ['isPrivate &&']],
    ['a check mid-chain', 'if (ok && owner.isPrivate && !mine) deny();', ['isPrivate &&']],
    [
      'raw SQL',
      'db.$queryRaw`SELECT p.id FROM "posts" p JOIN "users" u ON u.id = p."userId" WHERE u."isPrivate" = false`;',
      ['"isPrivate" = false'],
    ],
    [
      'raw SQL between parameters',
      'db.$queryRaw`SELECT ${a} FROM "users" u WHERE u."isPrivate" IS FALSE AND u.id = ${b}`;',
      ['"isPrivate" = false'],
    ],
    ['a select', 'const args = { select: { isPrivate: true } };', []],
    ['a value passed along', 'const body = { isPrivate: user.isPrivate };', []],
    ['a negated check', 'if (!user.isPrivate) show();', []],
    [
      'a comment quoting the old code',
      '// was `user: { isPrivate: false }`, and `user.isPrivate && x`, and "isPrivate" = false\nconst a = 1;',
      [],
    ],
  ])('in %s finds %p', (_what, code, expected) => {
    expect(ruleCopiesIn(parse('probe.ts', code)).map((c) => c.spelling)).toEqual(expected);
  });

  it('writes the rule nowhere but visibility.ts', () => {
    // Filter lists with `AND: [visiblePostsWhere(viewerId)]`; decide for one owner with
    // canViewContentOf; gate a recipe id with canSeePost.
    const offenders = copies
      .filter((copy) => !isAllowed(copy))
      .map(({ file, line, inside, spelling }) => `${file}:${line} (${inside}) ${spelling}`);

    expect(offenders).toEqual([]);
  });

  it('has no allowance left over', () => {
    // An allowance nothing uses any more would quietly let the next copy in.
    const unused = ALLOWED.filter(
      (a) =>
        !copies.some((c) => c.file === a.file && c.inside === a.inside && c.spelling === a.spelling)
    ).map((a) => `${a.file} (${a.inside}) ${a.spelling}`);

    expect(unused).toEqual([]);
  });

  it("keeps the viewer's own recipes in the pantry match's raw SQL", () => {
    // The candidate query is the one copy that cannot call visiblePostsWhere, so its arms are
    // pinned here: public authors, OR the viewer's own recipes, in parentheses so the AND
    // conditions after them still apply to both. It used to have the public arm alone.
    //
    // S3 widens it to
    //   (u."isPrivate" = false OR p."userId" = ${user.id} OR EXISTS (SELECT 1 FROM "follows" f
    //     WHERE f."followerId" = ${user.id} AND f."followingId" = p."userId"))
    // and checks for `FROM "follows" f` here as well.
    const rawSql: string[] = [];
    const visit = (node: ts.Node) => {
      if (
        ts.isTaggedTemplateExpression(node) &&
        /\$(?:queryRaw|executeRaw)$/.test(node.tag.getText())
      ) {
        rawSql.push(node.template.getText());
      }
      ts.forEachChild(node, visit);
    };
    visit(parse(MATCH_ROUTE));

    const filtering = rawSql.filter((sql) => sql.includes('"isPrivate"'));
    expect(filtering.length).toBeGreaterThan(0);
    for (const sql of filtering) {
      expect(sql).toMatch(
        /\(\s*u\."isPrivate"\s*=\s*false\s+OR\s+p\."userId"\s*=\s*\$\{\s*user\.id\s*\}\s*\)/
      );
    }
  });
});

// ---------------------------------------------------------------------------------------
// Part two: every handler reached through a recipe id asks canSeePost
// ---------------------------------------------------------------------------------------

const HTTP_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

/** The routes under a recipe id, and the cooking history, which takes one in its body. */
const isRecipeScoped = (file: string) =>
  /^src\/app\/api\/recipes\/\[id\]\/(?:.+\/)?route\.ts$/.test(file) ||
  /^src\/app\/api\/cooked-recipes\/(?:.+\/)?route\.ts$/.test(file);

interface Handler {
  name: string;
  node: ts.Node;
}

/**
 * Every exported handler, in each form Next reads: `export async function GET`,
 * `export const GET = ...` and `export { get as GET }`. The last carries no body here to
 * inspect, so it counts as ungated — gate the handler in the route file itself.
 */
function handlersIn(source: ts.SourceFile): Handler[] {
  const file = source.fileName;
  return source.statements.flatMap((statement): Handler[] => {
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      return statement.exportClause.elements
        .filter((specifier) => HTTP_METHODS.has(specifier.name.text))
        .map((specifier) => ({ name: `${file} ${specifier.name.text}`, node: specifier }));
    }
    const exported =
      ts.canHaveModifiers(statement) &&
      ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) return [];
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      HTTP_METHODS.has(statement.name.text)
    ) {
      return [{ name: `${file} ${statement.name.text}`, node: statement }];
    }
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations
        .filter((d) => ts.isIdentifier(d.name) && HTTP_METHODS.has(d.name.text))
        .map((d) => ({ name: `${file} ${d.name.getText()}`, node: d }));
    }
    return [];
  });
}

/**
 * Recipe-scoped handlers that do not call canSeePost, and why. When the reason is another
 * function that applies the rule, `calls` names it and the test checks the handler calls it.
 */
const NOT_GATED: ReadonlyArray<{ handler: string; calls?: string; reason: string }> = [
  {
    handler: 'src/app/api/recipes/[id]/route.ts GET',
    calls: 'getRecipeForViewer',
    reason:
      'the recipe itself: RecipeService.getRecipeForViewer applies canViewContent, and the ' +
      'route answers the same 404 and 403',
  },
  {
    handler: 'src/app/api/recipes/[id]/route.ts PUT',
    calls: 'updateRecipe',
    reason: 'the author editing their own recipe; RecipeService refuses anyone else',
  },
  {
    handler: 'src/app/api/recipes/[id]/route.ts DELETE',
    calls: 'deleteRecipe',
    reason: 'the author deleting their own recipe; RecipeService refuses anyone else',
  },
  {
    handler: 'src/app/api/cooked-recipes/route.ts GET',
    calls: 'visiblePostsWhere',
    reason:
      "the viewer's own cooking history, a list: an entry whose recipe they can no longer " +
      'see comes back with post: null',
  },
  {
    handler: 'src/app/api/cooked-recipes/route.ts DELETE',
    reason:
      "undoes the viewer's own cook entry and puts their pantry back; it answers with " +
      'nothing of the recipe',
  },
];

const isGated = (handler: Handler) => callsFunction(handler.node, 'canSeePost');

describe('every handler reached through a recipe id asks canSeePost', () => {
  const files = serverFiles().filter(isRecipeScoped);
  const handlersByFile = files.map((file) => ({ file, handlers: handlersIn(parse(file)) }));
  const handlers = handlersByFile.flatMap((entry) => entry.handlers);

  it.each<[string, string, boolean]>([
    [
      'a handler that asks first',
      'export async function POST() { const access = await canSeePost(prisma, id, null); }',
      true,
    ],
    [
      'a handler that asks inside its transaction',
      'export async function PUT() { await prisma.$transaction(async (tx) => { await canSeePost(tx, id, user.id); }); }',
      true,
    ],
    ['an arrow handler', 'export const GET = async () => canSeePost(prisma, id, null);', true],
    [
      'a handler that only checks the recipe exists',
      'export async function POST() { await tx.post.findUnique({ where: { id } }); }',
      false,
    ],
    ['a handler re-exported from elsewhere', 'export { post as POST };', false],
  ])('counts %s as gated: %p', (_what, code, gated) => {
    const found = handlersIn(parse('probe/route.ts', code));

    expect(found).toHaveLength(1);
    expect(isGated(found[0])).toBe(gated);
  });

  it('finds the handlers it is guarding', () => {
    expect(files).toEqual(
      expect.arrayContaining([
        'src/app/api/recipes/[id]/route.ts',
        'src/app/api/recipes/[id]/comments/route.ts',
        'src/app/api/recipes/[id]/comments/[commentId]/route.ts',
        'src/app/api/recipes/[id]/cook-plan/route.ts',
        'src/app/api/recipes/[id]/like/route.ts',
        'src/app/api/recipes/[id]/rating/route.ts',
        'src/app/api/recipes/[id]/save/route.ts',
        'src/app/api/cooked-recipes/route.ts',
      ])
    );
    expect(handlers.length).toBeGreaterThanOrEqual(15);
  });

  it('sees a handler in every route file', () => {
    // A route file whose handlers the scan cannot find would pass the next test unread.
    const blind = handlersByFile
      .filter((entry) => entry.handlers.length === 0)
      .map((entry) => entry.file);

    expect(blind).toEqual([]);
  });

  it('calls canSeePost in every handler not listed as exempt', () => {
    // Before anything else about the recipe:
    //   const access = await canSeePost(tx, recipeId, user.id);
    //   if (access.status !== 'ok') return deniedPostResponse(access);
    const exempt = new Set(NOT_GATED.map((entry) => entry.handler));
    const ungated = handlers.filter((h) => !exempt.has(h.name) && !isGated(h)).map((h) => h.name);

    expect(ungated).toEqual([]);
  });

  it('holds every exemption to its reason', () => {
    const broken = NOT_GATED.flatMap(({ handler, calls }) => {
      const found = handlers.find((h) => h.name === handler);
      if (!found) return [`${handler} is gone — drop its exemption`];
      if (calls && !callsFunction(found.node, calls)) return [`${handler} does not call ${calls}`];
      return [];
    });

    expect(broken).toEqual([]);
  });
});
