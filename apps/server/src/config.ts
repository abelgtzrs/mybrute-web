import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const config = {
  /** Postgres connection string. When unset in development, an embedded Postgres is started (see devdb.ts). */
  databaseUrl: process.env.DATABASE_URL ?? null,
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "127.0.0.1",
  /** set COOKIE_SECURE=1 when served over HTTPS */
  cookieSecure: process.env.COOKIE_SECURE === "1",
  /** built web app to serve in production (npm run build); ignored when missing */
  webDist: process.env.WEB_DIST ?? join(here, "../../web/dist"),
  migrationsDir: join(here, "../migrations"),
  serverRoot: join(here, ".."),
  sessionDays: 30,
};
