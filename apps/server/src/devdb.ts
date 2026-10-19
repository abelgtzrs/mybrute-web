// Zero-setup Postgres for development and tests: a real PostgreSQL 17 from the embedded-postgres package,
// stored in apps/server/.pgdata (gitignored). Production sets DATABASE_URL and never loads this.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config";

export interface DevDatabase { url: string; stop(): Promise<void> }

export async function startDevDatabase(opts: { dir?: string; port?: number; database?: string } = {}): Promise<DevDatabase> {
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const dir = opts.dir ?? join(config.serverRoot, ".pgdata");
  const port = opts.port ?? 54329;
  const database = opts.database ?? "mybrute";
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: "mybrute", password: "mybrute", port, persistent: true, onLog: () => {} });
  if (!existsSync(join(dir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  const exists = await client.query("select 1 from pg_database where datname = $1", [database]);
  if (!exists.rowCount) await client.query(`create database "${database.replace(/"/g, "")}"`);
  await client.end();
  return { url: `postgres://mybrute:mybrute@localhost:${port}/${database}`, stop: () => pg.stop() };
}
