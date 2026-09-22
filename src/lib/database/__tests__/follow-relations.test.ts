import { readFileSync } from 'fs';
import path from 'path';

/**
 * `User.followers` holds the people who follow that user, and `User.following` the people
 * that user follows — checked on the schema itself, because nothing else can check it.
 *
 * The relation names used to be paired the other way round. `followers` was joined on
 * `followerId`, so it held the accounts the user FOLLOWS, and every `_count.followers` in
 * the app printed the following count: every profile showed the two numbers swapped. The
 * follow button got the right number from its own route, so the count visibly jumped the
 * moment you tapped it, and swapped back on the next visit. Unit tests mock Prisma, so no
 * test could see which column a relation name sits on.
 */

const schema = readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

function modelBody(name: string): string {
  const match = schema.match(new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, 'm'));
  if (!match) throw new Error(`model ${name} not found in schema.prisma`);
  return match[1];
}

/** The relation name on a field of a model, e.g. User.followers -> "FollowsAsFollowed". */
function relationName(model: string, field: string): string {
  const line = modelBody(model)
    .split('\n')
    .find((l) => new RegExp(`^\\s*${field}\\s`).test(l));
  const name = line?.match(/@relation\("([^"]+)"/)?.[1];
  if (!name) throw new Error(`${model}.${field} has no named relation`);
  return name;
}

/** The column a Follow relation is joined on, found by its relation name. */
function followColumnFor(relation: string): string {
  const line = modelBody('Follow')
    .split('\n')
    .find((l) => l.includes(`@relation("${relation}"`));
  const column = line?.match(/fields:\s*\[(\w+)\]/)?.[1];
  if (!column) throw new Error(`no Follow field carries relation "${relation}"`);
  return column;
}

describe('the follow relations say who follows whom', () => {
  it("joins a user's followers on followingId — the rows where they are the one followed", () => {
    expect(followColumnFor(relationName('User', 'followers'))).toBe('followingId');
  });

  it('joins whom a user follows on followerId — the rows where they are the follower', () => {
    expect(followColumnFor(relationName('User', 'following'))).toBe('followerId');
  });
});
