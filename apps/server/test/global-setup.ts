// Starts a real PostgreSQL for the test run (embedded, in apps/server/.pgdata-test) unless TEST_DATABASE_URL
// is set, and recreates an empty, migrated mybrute_test database each run.
import { join } from "node:path";
import pg from "pg";
import type { TestProject } from "vitest/node";
import { config } from "../src/config";
import { createPool } from "../src/db";
import { migrate } from "../src/migrate";

declare module "vitest" {
  export interface ProvidedContext { dbUrl: string }
}

export default async function setup(project: TestProject) {
  let url = process.env.TEST_DATABASE_URL;
  let stop: (() => Promise<void>) | null = null;
  if (!url) {
    const { startDevDatabase } = await import("../src/devdb");
    const dev = await startDevDatabase({ dir: join(config.serverRoot, ".pgdata-test"), port: 54330, database: "postgres" });
    stop = dev.stop;
    const admin = new pg.Client({ connectionString: dev.url });
    await admin.connect();
    await admin.query("drop database if exists mybrute_test with (force)");
    await admin.query("create database mybrute_test");
    await admin.end();
    url = dev.url.replace(/\/postgres$/, "/mybrute_test");
  }
  const db = createPool(url);
  await migrate(db);
  await db.end();
  project.provide("dbUrl", url);
  return async () => { if (stop) await stop(); };
}
