// Zero-setup Postgres for development and tests: a real PostgreSQL 17 from the embedded-postgres package,
// stored in apps/server/.pgdata (gitignored). Production sets DATABASE_URL and never loads this.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config";

export interface DevDatabase { url: string; stop(): Promise<void> }

async function isUp(port: number): Promise<boolean> {
  const { default: pg } = await import("pg");
  const c = new pg.Client({ connectionString: `postgres://mybrute:mybrute@localhost:${port}/postgres`, connectionTimeoutMillis: 1500 });
  try { await c.connect(); await c.end(); return true; } catch { return false; }
}

export async function startDevDatabase(opts: { dir?: string; port?: number; database?: string } = {}): Promise<DevDatabase> {
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const dir = opts.dir ?? join(config.serverRoot, ".pgdata");
  const port = opts.port ?? 54329;
  const database = opts.database ?? "mybrute";
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: "mybrute", password: "mybrute", port, persistent: true, onLog: () => {} });
  if (!existsSync(join(dir, "PG_VERSION"))) await pg.initialise();
  // a previous run that was killed may have left this database running: reuse it instead of failing
  if (!(await isUp(port))) await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  const exists = await client.query("select 1 from pg_database where datname = $1", [database]);
  if (!exists.rowCount) await client.query(`create database "${database.replace(/"/g, "")}"`);
  await client.end();
  return { url: `postgres://mybrute:mybrute@localhost:${port}/${database}`, stop: () => pg.stop() };
}
