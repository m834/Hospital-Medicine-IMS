import { Prisma } from '@prisma/client';

/**
 * Daily numbers (PV-…, REC-…, tokens) are "highest so far + 1". Two desks
 * saving at the same moment can both reach for the same number; the database
 * refuses the second with a unique-constraint error (P2002).
 */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Runs `run` again when it fails on a unique constraint, so a collision on a
 * generated number is retried with a fresh number instead of reaching the
 * desk as a 500. `run` must be the whole unit of work — normally one
 * $transaction — because Postgres aborts a transaction on the error, so
 * retrying a single statement inside it cannot succeed. A short random pause
 * keeps two desks that collided from colliding again in lockstep.
 */
export async function retryOnUniqueViolation<T>(run: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= attempts || !isUniqueViolation(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 + Math.floor(Math.random() * 80)));
    }
  }
}

/**
 * The next sequence for numbers shaped `<prefix><digits>` (e.g. PV-20261101-),
 * read as an integer so 10000 sorts after 9999 — ordering the strings would
 * not. Only numbers whose tail is all digits are considered.
 *
 * Must run inside a transaction. It first takes a transaction-scoped advisory
 * lock on this prefix, so desks saving at the same moment take their numbers
 * one after another instead of all reading the same highest number; the lock
 * is released when the transaction commits or rolls back, so a crash cannot
 * leave it held. Under READ COMMITTED the read after the lock sees the number
 * the previous holder just committed.
 */
export async function nextNumberAfterHighest(
  db: Prisma.TransactionClient,
  table: 'visits',
  column: 'visit_number',
  prefix: string,
): Promise<number> {
  // Where the digits start. A literal, not a parameter: Prisma would send a
  // number as bigint, and Postgres has no substring(text, bigint). It is
  // computed here from our own prefix, never from input.
  const digitsFrom = Prisma.raw(String(prefix.length + 1));
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${table}:${prefix}`}))`;
  const rows = await db.$queryRaw<{ highest: number | null }[]>`
    SELECT MAX(CAST(substring(${Prisma.raw(column)} FROM ${digitsFrom}) AS INTEGER)) AS highest
    FROM ${Prisma.raw(table)}
    WHERE ${Prisma.raw(column)} LIKE ${`${prefix}%`}
      AND substring(${Prisma.raw(column)} FROM ${digitsFrom}) ~ '^[0-9]+$'`;
  return Number(rows[0]?.highest ?? 0) + 1;
}
