import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { harness, Player, reset, type Harness } from "./helpers";

let h: Harness;
beforeAll(async () => { h = await harness(); });
afterAll(async () => { await h.app.close(); await h.db.end(); });
beforeEach(async () => { await reset(h.db); });

describe("accounts and sessions", () => {
  it("registers, remembers the session, signs out", async () => {
    const p = await Player.register(h.app, "alice");
    expect((await p.call("GET", "/api/auth/me")).body.user).toMatchObject({ username: "alice", bruteCount: 0, maxBrutes: 5 });
    await p.call("POST", "/api/auth/logout");
    expect((await p.call("GET", "/api/auth/me")).body.user).toBeNull();
  });

  it("never stores the password or the session token in clear", async () => {
    const p = await Player.register(h.app, "alice", "my secret password");
    const u = (await h.db.query("select password_hash from users")).rows[0];
    expect(u.password_hash).toMatch(/^scrypt\$/);
    expect(u.password_hash).not.toContain("my secret password");
    const token = p.cookie.split("=")[1];
    const s = (await h.db.query("select token_hash from sessions")).rows[0];
    expect(Buffer.from(s.token_hash).toString("base64url")).not.toBe(token);
  });

  it("rejects wrong passwords and taken usernames", async () => {
    await Player.register(h.app, "alice");
    const p = new Player(h.app, "alice");
    expect((await p.call("POST", "/api/auth/login", { username: "alice", password: "wrong password" })).status).toBe(401);
    expect((await p.call("POST", "/api/auth/login", { username: "ALICE", password: "correct horse battery" })).status).toBe(200);
    expect((await p.call("POST", "/api/auth/register", { username: "Alice", password: "another one!" })).status).toBe(409);
  });

  it("refuses state changes without the MyBrute++ header (cross-site requests)", async () => {
    const p = await Player.register(h.app, "alice");
    const r = await p.call("POST", "/api/brutes", { name: "Sneaky", seedId: 5, gfx: "0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0" }, { csrf: false });
    expect(r.status).toBe(403);
    expect((await h.db.query("select count(*)::int c from brutes")).rows[0].c).toBe(0);
  });

  it("requires signing in for game routes", async () => {
    const anon = new Player(h.app, "anon");
    expect((await anon.call("GET", "/api/brutes")).status).toBe(401);
    expect((await anon.call("POST", "/api/brutes", {})).status).toBe(401);
  });
});

describe("brute ownership and limits", () => {
  it("hides other players' brutes completely", async () => {
    const alice = await Player.register(h.app, "alice");
    const bob = await Player.register(h.app, "bob");
    const b = await alice.newBrute("Warcott");
    for (const [m, url, body] of [
      ["GET", `/api/brutes/${b.id}`], ["DELETE", `/api/brutes/${b.id}`], ["POST", `/api/brutes/${b.id}/opponents`],
      ["POST", `/api/brutes/${b.id}/fights`, { offerId: "1" }], ["POST", `/api/brutes/${b.id}/level-up`, { index: 0, choice: 0 }],
      ["GET", `/api/brutes/${b.id}/fights`],
    ] as const) {
      expect((await bob.call(m, url, body)).status, `${m} ${url}`).toBe(404);
    }
    expect((await alice.call("GET", `/api/brutes/${b.id}`)).status).toBe(200);
  });

  it("enforces the configurable brute limit, and deleting frees a slot", async () => {
    const p = await Player.register(h.app, "alice");
    for (let i = 0; i < 5; i++) await p.newBrute(`Brute${i}`);
    expect((await p.call("POST", "/api/brutes", { name: "Sixth", seedId: 6, gfx: "0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0" })).body.error).toBe("brute_limit");
    await h.db.query("update settings set value = '6' where key = 'max_brutes_default'");
    await p.newBrute("Sixth");
    const first = (await p.call("GET", "/api/brutes")).body.brutes[0];
    await h.db.query("update settings set value = '5' where key = 'max_brutes_default'");
    expect((await p.call("DELETE", `/api/brutes/${first.id}`)).status).toBe(200);
    expect((await p.call("POST", "/api/brutes", { name: "Seventh", seedId: 7, gfx: "0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0" })).body.error).toBe("brute_limit");
  });

  it("can't exceed the limit with simultaneous requests", async () => {
    const p = await Player.register(h.app, "alice");
    await h.db.query("update settings set value = '2' where key = 'max_brutes_default'");
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) =>
      p.call("POST", "/api/brutes", { name: `Rush${i}`, seedId: 100 + i, gfx: "0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0" })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
  });

  it("keeps names unique across players, ignoring case", async () => {
    const alice = await Player.register(h.app, "alice");
    const bob = await Player.register(h.app, "bob");
    await alice.newBrute("Fifitzi");
    const r = await bob.call("POST", "/api/brutes", { name: "fifitzi", seedId: 9, gfx: "0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0" });
    expect(r.body.error).toBe("name_taken");
  });

  it("allows the same deterministic id for different players", async () => {
    const alice = await Player.register(h.app, "alice");
    const bob = await Player.register(h.app, "bob");
    await alice.newBrute("One", 18327968);
    await bob.newBrute("Two", 18327968);
  });

  it("validates new brutes", async () => {
    const p = await Player.register(h.app, "alice");
    const bad = [
      { name: "x", seedId: 5, gfx: "0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0" },
      { name: "Okay", seedId: 0, gfx: "0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0" },
      { name: "Okay", seedId: 2 ** 31, gfx: "0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0" },
      { name: "Okay", seedId: 5, gfx: "1;2;3" },
    ];
    for (const body of bad) expect((await p.call("POST", "/api/brutes", body)).status).toBe(400);
  });

  it("has no way to change a brute's appearance after creation", async () => {
    const p = await Player.register(h.app, "alice");
    const b = await p.newBrute("Locked");
    const gfx = "1;1;1;1;1;1;1;1;1;1;1;1;1;1;1;1";
    for (const method of ["PUT", "PATCH", "POST"] as const) {
      await h.app.inject({ method, url: `/api/brutes/${b.id}`, payload: { gfx }, headers: { "x-mybrute": "1", cookie: p.cookie } });
    }
    await p.call("POST", `/api/brutes/${b.id}/level-up`, { index: 0, choice: 0, gfx });
    expect((await h.db.query("select gfx from brutes where id = $1", [b.id])).rows[0].gfx).toBe("0;0;1;2;3;4;5;6;7;8;9;10;11;12;13;14");
  });
});
