import { buildApp } from "./app";
import { config } from "./config";
import { createPool } from "./db";
import { migrate } from "./migrate";

let url = config.databaseUrl;
let stopDevDb: (() => Promise<void>) | null = null;
if (!url) {
  if (process.env.NODE_ENV === "production") throw new Error("Set DATABASE_URL in production.");
  const { startDevDatabase } = await import("./devdb");
  const dev = await startDevDatabase();
  url = dev.url;
  stopDevDb = dev.stop;
  console.log("Using the embedded development database (apps/server/.pgdata).");
}

const db = createPool(url);
const applied = await migrate(db);
if (applied.length) console.log("Applied migrations:", applied.join(", "));
if (config.adminUsernames.length) {
  await db.query("update users set role = 'admin' where lower(username) = any($1) and role <> 'admin'", [config.adminUsernames]);
}

const app = await buildApp({ db, webDist: config.webDist, logger: true });
await app.listen({ port: config.port, host: config.host });

const shutdown = async () => {
  await app.close();
  await db.end();
  if (stopDevDb) await stopDevDb();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
