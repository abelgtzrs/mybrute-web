import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliCompressSync } from "node:zlib";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inject } from "vitest";
import { buildApp } from "../src/app";
import { createPool, type Db } from "../src/db";

// a tiny fake web build: what `vite build` + compress-dist.mjs leave in dist
const dist = mkdtempSync(join(tmpdir(), "mybrute-dist-"));
const wasm = "ruffle/83706a63e1063cc265ba.wasm";
let db: Db, app: FastifyInstance;

beforeAll(async () => {
  mkdirSync(join(dist, "ruffle"));
  mkdirSync(join(dist, "swf"));
  writeFileSync(join(dist, "index.html"), "<!doctype html><title>app</title>");
  writeFileSync(join(dist, wasm), "x".repeat(4096));
  writeFileSync(join(dist, wasm + ".br"), brotliCompressSync("x".repeat(4096)));
  writeFileSync(join(dist, "ruffle/ruffle.js"), "// loader");
  writeFileSync(join(dist, "swf/inventory-transparent.swf"), "FWS");
  db = createPool(inject("dbUrl"));
  app = await buildApp({ db, webDist: dist });
});
afterAll(async () => { await app.close(); await db.end(); rmSync(dist, { recursive: true, force: true }); });

describe("static web build", () => {
  it("sends the brotli copy of Ruffle's wasm and lets browsers cache it for good", async () => {
    const res = await app.inject({ url: "/" + wasm, headers: { "accept-encoding": "br, gzip" } });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-encoding"]).toBe("br");
    expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  it("sends the raw wasm to browsers that don't accept brotli", async () => {
    const res = await app.inject({ url: "/" + wasm, headers: { "accept-encoding": "identity" } });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-encoding"]).toBeUndefined();
    expect(res.body).toBe("x".repeat(4096));
    expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  it("keeps files without a hash in their name revalidating", async () => {
    for (const url of ["/ruffle/ruffle.js", "/swf/inventory-transparent.swf"]) {
      const res = await app.inject({ url });
      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).not.toContain("immutable");
    }
  });
});
