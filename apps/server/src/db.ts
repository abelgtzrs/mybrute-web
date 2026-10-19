import pg from "pg";

// DATE columns as plain "YYYY-MM-DD" strings (the default turns them into local-midnight Date objects)
pg.types.setTypeParser(1082, (v: string) => v);

export type Db = pg.Pool;
export type Tx = pg.PoolClient;

export function createPool(connectionString: string): Db {
  return new pg.Pool({ connectionString, max: 10 });
}

/** Runs fn in a transaction; rolls back on any error. */
export async function withTx<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const tx = await db.connect();
  try {
    await tx.query("begin");
    const out = await fn(tx);
    await tx.query("commit");
    return out;
  } catch (e) {
    await tx.query("rollback").catch(() => {});
    throw e;
  } finally {
    tx.release();
  }
}

/** Postgres error codes we turn into user-facing conflicts */
export const PG_UNIQUE_VIOLATION = "23505";
export const isUniqueViolation = (e: unknown, constraint?: string) =>
  (e as { code?: string }).code === PG_UNIQUE_VIOLATION && (!constraint || (e as { constraint?: string }).constraint === constraint);
