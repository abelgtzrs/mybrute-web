// Applies migrations/*.sql in name order, each once, each in its own transaction.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config";
import { withTx, type Db } from "./db";

export async function migrate(db: Db, dir = config.migrationsDir): Promise<string[]> {
  await db.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await db.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    await withTx(db, async (tx) => {
      await tx.query(readFileSync(join(dir, file), "utf8"));
      await tx.query("insert into schema_migrations (name) values ($1)", [file]);
    });
    applied.push(file);
  }
  return applied;
}
