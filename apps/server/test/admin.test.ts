import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { describe as describeBrute, pendingOptions } from "@mybrute/engine";
import { harness, Player, reset, type Harness } from "./helpers";

let h: Harness;
beforeAll(async () => { h = await harness(); });
afterAll(async () => { await h.app.close(); await h.db.end(); });
beforeEach(async () => { await reset(h.db); });

async function setup() {
  const admin = await Player.register(h.app, "boss");
  await h.db.query("update users set role = 'admin' where username = 'boss'");
  const alice = await Player.register(h.app, "alice");
  const b = await alice.newBrute("Hero", 18327968);
  const aliceId = (await alice.call("GET", "/api/auth/me")).body.user.id as string;
  return { admin, alice, aliceId, b };
}
const bruteRow = async (id: string) => (await h.db.query("select * from brutes where id = $1", [id])).rows[0];
const logActions = async () => (await h.db.query("select action from admin_log order by id")).rows.map((r) => r.action);

describe("admin access", () => {
  it("is refused to players and to anonymous visitors", async () => {
    const { alice, aliceId } = await setup();
    const anon = new Player(h.app, "anon");
    for (const [m, url] of [["GET", "/api/admin/overview"], ["GET", "/api/admin/users"], ["POST", `/api/admin/users/${aliceId}/role`], ["DELETE", `/api/admin/users/${aliceId}`]] as const) {
      expect((await alice.call(m, url, { role: "admin" })).status, `${m} ${url}`).toBe(403);
      expect((await anon.call(m, url, { role: "admin" })).status, `${m} ${url}`).toBe(401);
    }
    expect((await h.db.query("select role from users where username = 'alice'")).rows[0].role).toBe("player");
  });

  it("tells the web app who is an admin", async () => {
    const { admin, alice } = await setup();
    expect((await admin.call("GET", "/api/auth/me")).body.user.role).toBe("admin");
    expect((await alice.call("GET", "/api/auth/me")).body.user.role).toBe("player");
  });

  it("shows an overview with counts and recent changes", async () => {
    const { admin } = await setup();
    const r = (await admin.call("GET", "/api/admin/overview")).body;
    expect(r.counts).toMatchObject({ users: 2, admins: 1, brutes: 1, fights: 0 });
    expect(r.topBrutes[0]).toMatchObject({ name: "Hero", level: 1, owner: { username: "alice" } });
    expect(r.settings).toEqual({ maxBrutesDefault: 5, dailyFights: 10, maxImportLevel: 1 });
  });
});

describe("managing players", () => {
  it("searches and opens a player with their brutes", async () => {
    const { admin, aliceId } = await setup();
    const list = (await admin.call("GET", "/api/admin/users?q=ali")).body;
    expect(list.users.map((u: { username: string }) => u.username)).toEqual(["alice"]);
    const u = (await admin.call("GET", `/api/admin/users/${aliceId}`)).body;
    expect(u.user).toMatchObject({ username: "alice", brutes: 1, sessions: 1, effectiveMaxBrutes: 5 });
    expect(u.brutes[0].name).toBe("Hero");
  });

  it("suspends: ends sessions, blocks sign-in with the reason, and lifting it restores access", async () => {
    const { admin, alice, aliceId } = await setup();
    expect((await admin.call("POST", `/api/admin/users/${aliceId}/suspend`, { reason: "Cheating" })).status).toBe(200);
    expect((await alice.call("GET", "/api/brutes")).status).toBe(401);
    const login = await alice.call("POST", "/api/auth/login", { username: "alice", password: "correct horse battery" });
    expect(login.status).toBe(403);
    expect(login.body.message).toContain("Cheating");
    // a wrong password doesn't reveal the suspension
    expect((await alice.call("POST", "/api/auth/login", { username: "alice", password: "wrong password" })).status).toBe(401);
    await admin.call("POST", `/api/admin/users/${aliceId}/unsuspend`);
    expect((await alice.call("POST", "/api/auth/login", { username: "alice", password: "correct horse battery" })).status).toBe(200);
    expect(await logActions()).toEqual(["user.suspend", "user.unsuspend"]);
  });

  it("protects admins from locking themselves out and from suspending other admins", async () => {
    const { admin } = await setup();
    const bossId = (await admin.call("GET", "/api/auth/me")).body.user.id;
    for (const [m, url, body] of [["POST", "role", { role: "player" }], ["POST", "suspend", {}], ["POST", "password", { password: "a new password" }], ["POST", "sign-out"], ["DELETE", ""]] as const) {
      expect((await admin.call(m, `/api/admin/users/${bossId}${url ? `/${url}` : ""}`, body)).body.error, `${m} ${url}`).toBe("self");
    }
    const other = await Player.register(h.app, "deputy");
    await h.db.query("update users set role = 'admin' where username = 'deputy'");
    const deputyId = (await other.call("GET", "/api/auth/me")).body.user.id;
    expect((await admin.call("POST", `/api/admin/users/${deputyId}/suspend`, {})).body.error).toBe("is_admin");
    expect((await admin.call("DELETE", `/api/admin/users/${deputyId}`)).body.error).toBe("is_admin");
  });

  it("grants and removes admin rights, and the change applies to the next request", async () => {
    const { admin, alice, aliceId } = await setup();
    await admin.call("POST", `/api/admin/users/${aliceId}/role`, { role: "admin" });
    expect((await alice.call("GET", "/api/admin/overview")).status).toBe(200);
    await admin.call("POST", `/api/admin/users/${aliceId}/role`, { role: "player" });
    expect((await alice.call("GET", "/api/admin/overview")).status).toBe(403);
  });

  it("sets a per-player brute limit and the global default", async () => {
    const { admin, alice, aliceId } = await setup();
    await admin.call("POST", `/api/admin/users/${aliceId}/limit`, { maxBrutes: 1 });
    expect((await alice.call("POST", "/api/brutes", { name: "Second", seedId: 7, gfx: "0;0;1;2;3;4;5;6;7;8;9;10;11;12;13;14" })).body.error).toBe("brute_limit");
    await admin.call("POST", `/api/admin/users/${aliceId}/limit`, { maxBrutes: null });
    await admin.call("POST", "/api/admin/settings", { maxBrutesDefault: 2, dailyFights: 3 });
    expect((await alice.call("GET", "/api/auth/me")).body.user.maxBrutes).toBe(2);
    expect((await alice.call("GET", "/api/brutes")).body.brutes[0].dailyFights).toBe(3);
    expect((await admin.call("POST", "/api/admin/settings", { dailyFights: -1 })).status).toBe(400);
    expect((await admin.call("POST", `/api/admin/users/${aliceId}/limit`, { maxBrutes: 2.5 })).status).toBe(400);
  });

  it("resets a password and ends that player's sessions", async () => {
    const { admin, alice, aliceId } = await setup();
    await admin.call("POST", `/api/admin/users/${aliceId}/password`, { password: "brand new secret" });
    expect((await alice.call("GET", "/api/brutes")).status).toBe(401);
    expect((await alice.call("POST", "/api/auth/login", { username: "alice", password: "brand new secret" })).status).toBe(200);
    expect((await admin.call("POST", `/api/admin/users/${aliceId}/password`, { password: "short" })).status).toBe(400);
  });

  it("deletes an account with everything in it, and the log keeps its name", async () => {
    const { admin, aliceId, b } = await setup();
    await admin.call("DELETE", `/api/admin/users/${aliceId}`);
    expect(await bruteRow(b.id)).toBeUndefined();
    const log = (await admin.call("GET", "/api/admin/log")).body.entries;
    expect(log[0]).toMatchObject({ action: "user.delete", target: { kind: "user", label: "alice" }, admin: { username: "boss" } });
  });
});

describe("managing brutes", () => {
  it("opens any brute's cell and fights, with the owner", async () => {
    const { admin, alice, b } = await setup();
    const [o] = (await alice.call("POST", `/api/brutes/${b.id}/opponents`)).body.opponents;
    const fightId = (await alice.call("POST", `/api/brutes/${b.id}/fights`, { offerId: o.offerId })).body.fightId;
    const cell = (await admin.call("GET", `/api/admin/brutes/${b.id}`)).body;
    expect(cell).toMatchObject({ brute: { name: "Hero" }, owner: { username: "alice" } });
    expect(cell.recentFights).toHaveLength(1);
    expect((await admin.call("GET", `/api/admin/fights/${fightId}`)).body.fight.id).toBe(fightId);
    expect((await admin.call("GET", `/api/admin/fights?q=Hero`)).body.fights).toHaveLength(1);
    expect((await admin.call("GET", "/api/admin/brutes?q=18327968")).body.brutes).toHaveLength(1);
  });

  it("sets XP and the level-up flag follows the normal rule", async () => {
    const { admin, b } = await setup();
    await admin.call("POST", `/api/admin/brutes/${b.id}/xp`, { xp: 2 });
    expect(await bruteRow(b.id)).toMatchObject({ xp: 2, pending_level_up: true });
    await admin.call("POST", `/api/admin/brutes/${b.id}/xp`, { xp: 1 });
    expect(await bruteRow(b.id)).toMatchObject({ xp: 1, pending_level_up: false });
    expect((await admin.call("POST", `/api/admin/brutes/${b.id}/xp`, { xp: -3 })).status).toBe(400);
  });

  it("set XP follows the cap", async () => {
    const { admin, b } = await setup();
    await h.db.query("update brutes set level_ups = 19, bits = $2 where id = $1", [b.id, "000000"]);
    const r = await admin.call("POST", `/api/admin/brutes/${b.id}/xp`, { xp: 500 });
    expect(r.body.pendingLevelUp).toBe(false);
  });

  it("gives back today's fights", async () => {
    const { admin, alice, b } = await setup();
    await h.db.query("update settings set value = '1' where key = 'daily_fights'");
    await h.db.query("update brutes set level_ups = 20, bits = '000000' where id = $1", [b.id]);
    const [o] = (await alice.call("POST", `/api/brutes/${b.id}/opponents`)).body.opponents;
    await alice.call("POST", `/api/brutes/${b.id}/fights`, { offerId: o.offerId });
    expect((await alice.call("GET", `/api/brutes/${b.id}`)).body.brute.fightsLeft).toBe(0);
    await admin.call("POST", `/api/admin/brutes/${b.id}/reset-fights`);
    expect((await alice.call("GET", `/api/brutes/${b.id}`)).body.brute.fightsLeft).toBe(1);
  });

  it("undoes the last level-up exactly: XP back, the same two options offered again", async () => {
    const { admin, alice, b } = await setup();
    await h.db.query("update brutes set xp = 2, pending_level_up = true where id = $1", [b.id]);
    await alice.call("POST", `/api/brutes/${b.id}/level-up`, { index: 0, choice: 1 });
    expect(await bruteRow(b.id)).toMatchObject({ level_ups: 1, bits: "01", xp: 0 });
    expect((await admin.call("POST", `/api/admin/brutes/${b.id}/undo-level-up`)).status).toBe(200);
    expect(await bruteRow(b.id)).toMatchObject({ level_ups: 0, bits: "", xp: 2, pending_level_up: true });
    const cell = (await alice.call("GET", `/api/brutes/${b.id}`)).body;
    expect(cell.pendingOptions).toEqual(pendingOptions(b.seedId, 0, []));
    expect(cell.levelUps).toHaveLength(0);
    const d = describeBrute(b.seedId, 0, []);
    expect(cell.attributes.life).toBe(d.fin.life);
    expect((await admin.call("POST", `/api/admin/brutes/${b.id}/undo-level-up`)).body.error).toBe("no_level_ups");
  });

  it("renames with the usual rules and moves a brute to another player", async () => {
    const { admin, alice, b } = await setup();
    const bob = await Player.register(h.app, "bob");
    await bob.newBrute("Taken");
    expect((await admin.call("POST", `/api/admin/brutes/${b.id}/rename`, { name: "taken" })).body.error).toBe("name_taken");
    expect((await admin.call("POST", `/api/admin/brutes/${b.id}/rename`, { name: "!" })).status).toBe(400);
    await admin.call("POST", `/api/admin/brutes/${b.id}/rename`, { name: "Renamed" });
    expect((await admin.call("POST", `/api/admin/brutes/${b.id}/transfer`, { username: "nobody" })).status).toBe(404);
    await admin.call("POST", `/api/admin/brutes/${b.id}/transfer`, { username: "BOB" });
    expect((await alice.call("GET", `/api/brutes/${b.id}`)).status).toBe(404);
    expect((await bob.call("GET", `/api/brutes/${b.id}`)).body.brute.name).toBe("Renamed");
    expect(await logActions()).toEqual(["brute.rename", "brute.transfer"]);
  });

  it("deletes a brute", async () => {
    const { admin, b } = await setup();
    await admin.call("DELETE", `/api/admin/brutes/${b.id}`);
    expect(await bruteRow(b.id)).toBeUndefined();
    expect((await admin.call("GET", `/api/admin/brutes/${b.id}`)).status).toBe(404);
  });
});
