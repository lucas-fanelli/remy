import { PrismaClient } from '@prisma/client';

/**
 * Read-only safety check to run before migration `3_drop_cooked_rating_notes`.
 *
 * That migration drops `cooked_recipes.rating` and `cooked_recipes.notes`, and dropping a
 * column cannot be undone. Nothing in the app has ever written them — the only code that
 * could required a `rating` in the body of POST /api/cooked-recipes, which no client ever
 * sent — but "should be empty" is worth turning into "is empty" before destroying them.
 *
 * Raw SQL on purpose: once the schema drops the fields, a typed query cannot name them.
 *
 * Writes nothing. Run it with DATABASE_URL pointing at the database you are about to
 * migrate, and read the host it prints before you trust the answer.
 */
async function main() {
  const prisma = new PrismaClient();

  try {
    const [{ host }] = await prisma.$queryRaw<[{ host: string }]>`
      SELECT inet_server_addr()::text || ':' || inet_server_port()::text AS host
    `;
    const [{ database }] = await prisma.$queryRaw<[{ database: string }]>`
      SELECT current_database() AS database
    `;

    console.log(`\nDatabase: ${database}`);
    console.log(`Server:   ${host ?? '(local socket)'}\n`);

    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cooked_recipes' AND column_name IN ('rating', 'notes')
    `;

    if (columns.length === 0) {
      console.log('Both columns are already gone — this migration has been applied here.\n');
      return;
    }

    const [counts] = await prisma.$queryRaw<[{ with_rating: bigint; with_notes: bigint }]>`
      SELECT count(*) FILTER (WHERE rating IS NOT NULL) AS with_rating,
             count(*) FILTER (WHERE notes  IS NOT NULL) AS with_notes
      FROM cooked_recipes
    `;

    const withRating = Number(counts.with_rating);
    const withNotes = Number(counts.with_notes);

    console.log(`Rows with a rating: ${withRating}`);
    console.log(`Rows with notes:    ${withNotes}\n`);

    if (withRating === 0 && withNotes === 0) {
      console.log('Nothing would be lost. Safe to run the migration.\n');
    } else {
      console.log('STOP. Something wrote these columns, which nothing was supposed to do.');
      console.log('Do not run the migration yet — the values would be gone for good.\n');
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('\nCould not check the columns:', error);
  process.exitCode = 1;
});
