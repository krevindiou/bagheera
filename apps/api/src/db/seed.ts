import 'dotenv/config';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { category, paymentMethod } from './schema';
import { categorySeeds, paymentMethodSeeds, CategorySeed } from './seed-data';

type Db = ReturnType<typeof drizzle>;

async function seed(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    await db
      .insert(paymentMethod)
      .values(paymentMethodSeeds)
      .onConflictDoNothing();

    await insertCategories(db, categorySeeds, null);

    console.log('Seed complete.');
  } finally {
    await pool.end();
  }
}

// Idempotent: re-running the seed leaves existing rows (matched by
// name + parent) untouched instead of duplicating them.
async function insertCategories(
  db: Db,
  seeds: CategorySeed[],
  parentId: number | null,
): Promise<void> {
  for (const seed of seeds) {
    const [existing] = await db
      .select({ id: category.id })
      .from(category)
      .where(
        and(
          eq(category.name, seed.name),
          parentId === null
            ? isNull(category.parentId)
            : eq(category.parentId, parentId),
        ),
      )
      .limit(1);

    const id =
      existing?.id ??
      (
        await db
          .insert(category)
          .values({
            name: seed.name,
            type: seed.type,
            isSalaryCategory: seed.isSalaryCategory ?? false,
            parentId,
          })
          .returning({ id: category.id })
      )[0].id;

    if (seed.children?.length) {
      await insertCategories(db, seed.children, id);
    }
  }
}

seed().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
