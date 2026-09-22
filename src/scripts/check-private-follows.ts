import { PrismaClient } from '@prisma/client';

/**
 * Read-only look at a database before the follow-approval release reaches it.
 *
 * Until that release, following a private account was instant and unlocked nothing, so
 * anyone could follow one. From that release on, a follow is what opens a private account's
 * recipes, and following a private account asks its owner first. The decision for the
 * follows already there: they STAY. Nobody is turned back into a request, and each owner can
 * remove a follower they did not mean to let in. So this is information, not a gate: how
 * many follows of private accounts become access the moment the release is live, and how
 * many requests are waiting.
 *
 * Run again once the release is out, it is a health check: no request should ever wait on a
 * PUBLIC account, because making an account public accepts its requests in the same save.
 *
 * Raw SQL, so it also runs before migration `4_follow_requests`, when the typed client
 * would name a table that is not there yet.
 *
 * Writes nothing. Run it with DATABASE_URL pointing at the database the release is about to
 * reach, and read the host it prints before you trust the answer.
 */
async function main() {
  const prisma = new PrismaClient();

  try {
    const [{ database }] = await prisma.$queryRaw<[{ database: string }]>`
      SELECT current_database() AS database
    `;

    console.log(`\nHost:     ${databaseHost()}`);
    console.log(`Database: ${database}\n`);

    // One statement, so every number comes from the same snapshot
    const [follows] = await prisma.$queryRaw<
      [{ private_accounts: bigint; follows: bigint; followed_accounts: bigint; followers: bigint }]
    >`
      SELECT (SELECT count(*) FROM "users" WHERE "isPrivate") AS private_accounts,
             count(f."id") AS follows,
             count(DISTINCT f."followingId") AS followed_accounts,
             count(DISTINCT f."followerId") AS followers
      FROM "follows" f
      JOIN "users" u ON u."id" = f."followingId"
      WHERE u."isPrivate"
    `;

    const privateAccounts = Number(follows.private_accounts);
    const followsOfPrivate = Number(follows.follows);

    console.log(`Private accounts:                  ${privateAccounts}`);
    console.log(`  with at least one follower:      ${Number(follows.followed_accounts)}`);
    console.log(`Follows of private accounts:       ${followsOfPrivate}`);
    console.log(`  by this many different people:   ${Number(follows.followers)}`);

    const [{ migrated }] = await prisma.$queryRaw<[{ migrated: boolean }]>`
      SELECT to_regclass('"follow_requests"') IS NOT NULL AS migrated
    `;

    let waitingOnPublic = 0;
    if (migrated) {
      const [requests] = await prisma.$queryRaw<[{ pending: bigint; to_public: bigint }]>`
        SELECT count(*) AS pending,
               count(*) FILTER (WHERE NOT u."isPrivate") AS to_public
        FROM "follow_requests" r
        JOIN "users" u ON u."id" = r."targetId"
      `;
      waitingOnPublic = Number(requests.to_public);
      console.log(`Pending follow requests:           ${Number(requests.pending)}`);
      console.log(`  waiting on a PUBLIC account:     ${waitingOnPublic}\n`);
    } else {
      console.log('Pending follow requests:           none — migration 4_follow_requests');
      console.log('                                   has not been applied here yet.\n');
    }

    if (followsOfPrivate === 0) {
      console.log('Nobody follows a private account: the release opens nothing to anyone.\n');
    } else {
      console.log(`These ${followsOfPrivate} follows stay when the release is live, and from then`);
      console.log("on their followers see those accounts' recipes. Nothing is converted into a");
      console.log('request; an owner who wants someone out removes them from their followers.\n');
    }

    if (waitingOnPublic > 0) {
      console.log(`${waitingOnPublic} requests wait on a public account, and nobody will be asked`);
      console.log("to approve them. The requester's next tap on Seguir turns each into a follow,");
      console.log('but find out what left them: going public accepts every request in the same');
      console.log('save, so there should be none.\n');
    }
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Host and port of DATABASE_URL, and nothing else from it: the rest of the URL carries the
 * password (or, for Prisma Postgres, the API key), and this output gets pasted into chats.
 * Read after the client exists, because constructing it is what loads .env.
 */
function databaseHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return '(DATABASE_URL is not set)';
  try {
    return new URL(url).host || '(no host in DATABASE_URL)';
  } catch {
    return '(DATABASE_URL is not a URL)';
  }
}

main().catch((error) => {
  console.error('\nCould not check the follows:', error);
  process.exitCode = 1;
});
