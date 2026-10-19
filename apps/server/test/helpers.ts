import type { FastifyInstance } from "fastify";
import { inject } from "vitest";
import { buildApp } from "../src/app";
import { createPool, type Db } from "../src/db";

export interface Harness { db: Db; app: FastifyInstance }

export async function harness(): Promise<Harness> {
  const db = createPool(inject("dbUrl"));
  const app = await buildApp({ db });
  return { db, app };
}

export async function reset(db: Db) {
  await db.query("truncate users, sessions, brutes, level_ups, opponent_offers, fights, lab_payloads, lab_brutes, admin_log restart identity cascade");
  await db.query("update settings set value = '5' where key = 'max_brutes_default'");
  await db.query("update settings set value = '10' where key = 'daily_fights'");
}

/** A signed-in API client for one player. */
export class Player {
  cookie = "";
  constructor(private app: FastifyInstance, public username: string) {}

  async call(method: "GET" | "POST" | "DELETE", url: string, body?: unknown, opts: { csrf?: boolean } = {}) {
    const res = await this.app.inject({
      method, url, payload: body as object | undefined,
      headers: { ...(opts.csrf === false ? {} : { "x-mybrute": "1" }), ...(this.cookie ? { cookie: this.cookie } : {}) },
    });
    const setCookie = res.headers["set-cookie"];
    const c = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (c) this.cookie = c.split(";")[0];
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
  }

  static async register(app: FastifyInstance, username: string, password = "correct horse battery") {
    const p = new Player(app, username);
    const r = await p.call("POST", "/api/auth/register", { username, password });
    if (r.status !== 201) throw new Error(`register failed: ${JSON.stringify(r.body)}`);
    return p;
  }

  async newBrute(name: string, seedId = 1000 + Math.floor(Math.random() * 1e6), gfx = "0;0;1;2;3;4;5;6;7;8;9;10;11;12;13;14") {
    const r = await this.call("POST", "/api/brutes", { name, seedId, gfx });
    if (r.status !== 201) throw new Error(`create failed: ${JSON.stringify(r.body)}`);
    return r.body.brute as { id: string; seedId: number };
  }
}
