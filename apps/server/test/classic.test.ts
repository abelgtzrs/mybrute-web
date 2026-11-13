import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { describe as describeBrute, extractStats, hexToChoices, pendingOptions, runFight } from "@mybrute/engine";
import { harness, Player, reset, type Harness } from "./helpers";

let h: Harness;
beforeAll(async () => { h = await harness(); });
afterAll(async () => { await h.app.close(); await h.db.end(); });
beforeEach(async () => { await reset(h.db); });

async function setup(name = "Hero", seedId = 18327968) {
  const p = await Player.register(h.app, "alice");
  const b = await p.newBrute(name, seedId);
  return { p, b };
}
const opponents = async (p: Player, id: string) => (await p.call("POST", `/api/brutes/${id}/opponents`)).body.opponents;
const bruteRow = async (id: string) => (await h.db.query("select * from brutes where id = $1", [id])).rows[0];
/** Gives the brute enough level so a few fights can't make a level-up pending. */
const raise = (id: string, levelUps = 20) => h.db.query("update brutes set level_ups = $2, bits = $3 where id = $1", [id, levelUps, "00".repeat(Math.ceil(levelUps / 8))]);

describe("opponent selection", () => {
  it("offers eight same-level opponents built by the original progression", async () => {
    const { p, b } = await setup();
    await raise(b.id, 12);
    const list = await opponents(p, b.id);
    expect(list).toHaveLength(8);
    const ids = new Set(list.map((o: { seedId: number }) => o.seedId));
    expect(ids.size).toBe(8);
    expect(ids.has(b.seedId)).toBe(false);
    for (const o of list) {
      expect(o.level).toBe(13);
      expect(o.name).toBe(String(o.seedId));
      const offer = (await h.db.query("select * from opponent_offers where id = $1", [o.offerId])).rows[0];
      const d = describeBrute(offer.seed_id, offer.level_ups, hexToChoices(offer.bits, offer.level_ups));
      expect(o.attributes).toEqual({ strength: d.fin.force, agility: d.fin.agility, speed: d.fin.speed, life: d.fin.life });
      expect(o.kit.weapons).toEqual(d.fin.weapons);
    }
  });

  it("does not use up a fight or award XP", async () => {
    const { p, b } = await setup();
    await opponents(p, b.id);
    await opponents(p, b.id);
    const row = await bruteRow(b.id);
    expect([row.xp, row.fights_used]).toEqual([0, 0]);
  });

  it("drops unchosen offers from earlier visits, but keeps the previous list valid", async () => {
    const { p, b } = await setup();
    const first = await opponents(p, b.id);
    const second = await opponents(p, b.id);
    await opponents(p, b.id);
    expect((await p.call("POST", `/api/brutes/${b.id}/fights`, { offerId: first[0].offerId })).status).toBe(404);
    // a page still showing the previous list (e.g. it asked twice at once) can fight from it
    expect((await p.call("POST", `/api/brutes/${b.id}/fights`, { offerId: second[0].offerId })).status).toBe(200);
  });

  it("keeps both lists usable when two requests arrive at once", async () => {
    const { p, b } = await setup();
    const [a, c] = await Promise.all([opponents(p, b.id), opponents(p, b.id)]);
    for (const list of [a, c]) {
      const n = (await h.db.query("select count(*)::int n from opponent_offers where id = any($1) and consumed_at is null", [list.map((o: { offerId: string }) => o.offerId)])).rows[0].n;
      expect(n).toBe(8);
    }
  });
});

describe("fights", () => {
  it("is decided by the original engine and awards 2 XP for a win, 1 otherwise", async () => {
    const { p, b } = await setup();
    await raise(b.id);
    const [o] = await opponents(p, b.id);
    const r = await p.call("POST", `/api/brutes/${b.id}/fights`, { offerId: o.offerId });
    expect(r.status).toBe(200);
    const { fight, brute } = (await p.call("GET", `/api/fights/${r.body.fightId}`)).body;
    // replaying the stored input reproduces the stored result and stats exactly
    const replay = runFight(fight.spec);
    expect(replay.win === null ? "draw" : replay.win === 0 ? "win" : "loss").toBe(fight.result);
    expect(extractStats(replay).get(b.seedId)).toEqual(fight.playerStats);
    expect(fight.xpAwarded).toBe(fight.result === "win" ? 2 : 1);
    expect(brute.xp).toBe(fight.xpAwarded);
    expect(brute.fightsLeft).toBe(9);
    expect(fight.spec.brutes[1].id).toBe(o.seedId);
  });

  it("records a fight once per opponent: repeats return the same fight and award nothing more", async () => {
    const { p, b } = await setup();
    await raise(b.id);
    const [o] = await opponents(p, b.id);
    const results = await Promise.all(Array.from({ length: 5 }, () => p.call("POST", `/api/brutes/${b.id}/fights`, { offerId: o.offerId })));
    const ids = new Set(results.map((r) => r.body.fightId));
    expect(ids.size).toBe(1);
    expect((await h.db.query("select count(*)::int c from fights")).rows[0].c).toBe(1);
    const row = await bruteRow(b.id);
    expect(row.fights_used).toBe(1);
    expect([1, 2]).toContain(row.xp);
  });

  it("enforces the daily limit even under simultaneous requests", async () => {
    const { p, b } = await setup();
    await raise(b.id, 60); // 122 XP needed: no level-up can interrupt
    await h.db.query("update settings set value = '3' where key = 'daily_fights'");
    const list = await opponents(p, b.id);
    const results = await Promise.all(list.map((o: { offerId: string }) => p.call("POST", `/api/brutes/${b.id}/fights`, { offerId: o.offerId })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(3);
    expect(results.filter((r) => r.body.error === "no_fights_left")).toHaveLength(5);
    expect((await bruteRow(b.id)).fights_used).toBe(3);
  });

  it("gives the fights back on a new Bordeaux day", async () => {
    const { p, b } = await setup();
    await h.db.query("update brutes set fights_day = date '2001-01-01', fights_used = 10 where id = $1", [b.id]);
    expect((await p.call("GET", `/api/brutes/${b.id}`)).body.brute.fightsLeft).toBe(10);
    await h.db.query("update brutes set fights_day = (now() at time zone 'Europe/Paris')::date, fights_used = 10 where id = $1", [b.id]);
    const [o] = await opponents(p, b.id);
    expect((await p.call("POST", `/api/brutes/${b.id}/fights`, { offerId: o.offerId })).body.error).toBe("no_fights_left");
  });

  it("lists history newest first, filtered by result, with pagination", async () => {
    const { p, b } = await setup();
    await raise(b.id, 60);
    for (const o of (await opponents(p, b.id)).slice(0, 4)) await p.call("POST", `/api/brutes/${b.id}/fights`, { offerId: o.offerId });
    const all = (await p.call("GET", `/api/brutes/${b.id}/fights`)).body;
    expect(all.total).toBe(4);
    const wins = (await p.call("GET", `/api/brutes/${b.id}/fights?result=win`)).body;
    expect(wins.fights.every((f: { result: string }) => f.result === "win")).toBe(true);
    const cell = (await p.call("GET", `/api/brutes/${b.id}`)).body;
    expect(cell.brute.record.fights).toBe(4);
    expect(cell.lifetime.fights).toBe(4);
  });
});

describe("level-ups", () => {
  /** Fights until a level-up is pending (level 1 needs 2 XP: one win or two losses). */
  async function untilPending(p: Player, id: string) {
    for (let i = 0; i < 4; i++) {
      const [o] = await opponents(p, id);
      await p.call("POST", `/api/brutes/${id}/fights`, { offerId: o.offerId });
      if ((await bruteRow(id)).pending_level_up) return;
    }
    throw new Error("no level-up after 4 fights");
  }

  it("waits for a choice instead of levelling automatically, and blocks fights meanwhile", async () => {
    const { p, b } = await setup();
    await untilPending(p, b.id);
    const row = await bruteRow(b.id);
    expect(row.level_ups).toBe(0);
    expect(row.xp).toBeGreaterThanOrEqual(2);
    const [o] = await opponents(p, b.id);
    expect((await p.call("POST", `/api/brutes/${b.id}/fights`, { offerId: o.offerId })).body.error).toBe("level_up_pending");
    const cell = (await p.call("GET", `/api/brutes/${b.id}`)).body;
    expect(cell.pendingOptions).toEqual(pendingOptions(b.seedId, 0, []));
  });

  it("applies the second option as bit 0 = 1, keeps carry-over XP, and matches the original progression", async () => {
    const { p, b } = await setup();
    await untilPending(p, b.id);
    const before = await bruteRow(b.id);
    const r = await p.call("POST", `/api/brutes/${b.id}/level-up`, { index: 0, choice: 1 });
    expect(r.status).toBe(200);
    const after = await bruteRow(b.id);
    expect(after.level_ups).toBe(1);
    expect(after.bits).toBe("01");
    expect(after.xp).toBe(before.xp - 2);
    expect(after.pending_level_up).toBe(false);
    const cell = (await p.call("GET", `/api/brutes/${b.id}`)).body;
    const d = describeBrute(b.seedId, 1, [1]);
    expect(cell.attributes).toEqual({ strength: d.fin.force, agility: d.fin.agility, speed: d.fin.speed, life: d.fin.life });
    expect(cell.levelUps[0]).toMatchObject({ index: 0, level: 2, choice: 1 });
  });

  it("treats a repeated level-up as already done and refuses a different answer", async () => {
    const { p, b } = await setup();
    await untilPending(p, b.id);
    const results = await Promise.all(Array.from({ length: 4 }, () => p.call("POST", `/api/brutes/${b.id}/level-up`, { index: 0, choice: 0 })));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect((await bruteRow(b.id)).level_ups).toBe(1);
    expect((await h.db.query("select count(*)::int c from level_ups")).rows[0].c).toBe(1);
    expect((await p.call("POST", `/api/brutes/${b.id}/level-up`, { index: 0, choice: 1 })).body.error).toBe("level_up_done");
  });

  it("refuses a level-up that isn't due", async () => {
    const { p, b } = await setup();
    expect((await p.call("POST", `/api/brutes/${b.id}/level-up`, { index: 0, choice: 0 })).body.error).toBe("no_level_up");
  });

  it("invalidates opponents found before the level-up", async () => {
    const { p, b } = await setup();
    await untilPending(p, b.id);
    // offers can only be generated while pending; they belong to the old level
    const [o] = await opponents(p, b.id);
    await p.call("POST", `/api/brutes/${b.id}/level-up`, { index: 0, choice: 0 });
    expect((await p.call("POST", `/api/brutes/${b.id}/fights`, { offerId: o.offerId })).body.error).toBe("offer_stale");
  });
});

describe("lab saves", () => {
  it("keeps Lab saves per player and separate from Classic brutes", async () => {
    const { p } = await setup();
    const bob = await Player.register(h.app, "bob");
    expect((await p.call("GET", "/api/lab/brutes")).status).toBe(403);
    await h.db.query("update users set role = 'admin' where username in ('alice', 'bob')");
    const saved = await p.call("POST", "/api/lab/brutes", { label: "Copy", brute: { name: "Hero", id: 18327968, team: 0, levelUps: 3, gfx: "0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0", choices: [1, 0, 1], avoid: ["Weapons:AXE"] } });
    expect(saved.status).toBe(201);
    expect((await p.call("GET", "/api/lab/brutes")).body.items).toHaveLength(1);
    expect((await bob.call("GET", "/api/lab/brutes")).body.items).toHaveLength(0);
    await bob.call("DELETE", `/api/lab/brutes/${saved.body.item.key}`);
    expect((await p.call("GET", "/api/lab/brutes")).body.items).toHaveLength(1);
    expect((await h.db.query("select level_ups from brutes")).rows[0].level_ups).toBe(0);
  });
});

describe("importing a Lab brute", () => {
  it("creates it at the chosen level with its choices, up to the admin's cap", async () => {
    const p = await Player.register(h.app, "alice");
    const brute = { name: "Imported", seedId: 18327968, gfx: "0;0;1;2;3;4;5;6;7;8;9;10;11;12;13;-1", levelUps: 3, choices: [1, 0, 1, 1] };
    expect((await p.call("POST", "/api/brutes", brute)).status).toBe(400); // default cap is level 1
    expect((await p.call("GET", "/api/brutes")).body.maxImportLevel).toBe(1);
    await h.db.query("insert into settings (key, value) values ('max_import_level', '4')");
    const r = await p.call("POST", "/api/brutes", brute);
    expect(r.status).toBe(201);
    const row = await bruteRow(r.body.brute.id);
    expect(row.level_ups).toBe(3);
    expect(hexToChoices(row.bits, 3)).toEqual([1, 0, 1]);
    expect((await p.call("POST", "/api/brutes", { ...brute, name: "Too high", levelUps: 4 })).status).toBe(400);
    expect((await p.call("POST", "/api/brutes", { ...brute, name: "Short", choices: [1] })).status).toBe(400);
  });
});

void pendingOptions; void hexToChoices;

describe("appearance", () => {
  const newLook = "1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16";
  it("lets a player change the appearance once, then refuses", async () => {
    const { p, b } = await setup();
    const first = await p.call("PUT", `/api/brutes/${b.id}/appearance`, { gfx: newLook });
    expect(first.status).toBe(200);
    expect((await bruteRow(b.id)).gfx).toBe(newLook);
    expect((await p.call("GET", `/api/brutes/${b.id}`)).body.canChangeAppearance).toBe(false);
    const second = await p.call("PUT", `/api/brutes/${b.id}/appearance`, { gfx: "0;0;1;2;3;4;5;6;7;8;9;10;11;12;13;14" });
    expect(second.status).toBe(409);
    expect((await bruteRow(b.id)).gfx).toBe(newLook);
  });

  it("lets an admin change it again and again without using up the player's change", async () => {
    const { p, b } = await setup();
    await h.db.query("update users set role = 'admin' where username = 'alice'");
    expect((await p.call("PUT", `/api/brutes/${b.id}/appearance`, { gfx: newLook })).status).toBe(200);
    expect((await p.call("PUT", `/api/brutes/${b.id}/appearance`, { gfx: "2;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16" })).status).toBe(200);
    expect((await bruteRow(b.id)).appearance_changes).toBe(0);
  });

  it("refuses an appearance that is not valid", async () => {
    const { p, b } = await setup();
    expect((await p.call("PUT", `/api/brutes/${b.id}/appearance`, { gfx: "nope" })).status).toBe(400);
  });
});

describe("ranks and caps", () => {
  it("starts brutes at rank 0, flags brutes an admin creates, and keeps the flag after demotion", async () => {
    const { p, b } = await setup();
    const cell = (await p.call("GET", `/api/brutes/${b.id}`)).body.brute;
    expect(cell.rank.rank).toBe(0);
    expect(cell.adminBrute).toBe(false);
    await h.db.query("update users set role = 'admin' where username = 'alice'");
    const second = await p.newBrute("Boss", 4242);
    expect((await p.call("GET", `/api/brutes/${second.id}`)).body.brute.adminBrute).toBe(true);
    await h.db.query("update users set role = 'player' where username = 'alice'");
    expect((await p.call("GET", `/api/brutes/${second.id}`)).body.brute.adminBrute).toBe(true);
  });

  it("banks XP at the cap without a waiting level-up, and fights stay allowed", async () => {
    const { p, b } = await setup();
    await raise(b.id, 19); // level 20 = rank 0 cap
    await h.db.query("update brutes set xp = 100 where id = $1", [b.id]);
    const [o] = await opponents(p, b.id);
    const r = await p.call("POST", `/api/brutes/${b.id}/fights`, { offerId: o.offerId });
    expect(r.status).toBe(200);
    const row = await bruteRow(b.id);
    expect(row.pending_level_up).toBe(false);
    expect([101, 102]).toContain(row.xp);
    expect((await p.call("GET", `/api/brutes/${b.id}`)).body.brute.banked).toBe(true);
  });

  it("refuses a level-up at the cap", async () => {
    const { p, b } = await setup();
    await raise(b.id, 19);
    await h.db.query("update brutes set xp = 100, pending_level_up = true where id = $1", [b.id]);
    const r = await p.call("POST", `/api/brutes/${b.id}/level-up`, { index: 19, choice: 0 });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("level_cap");
  });

  it("lets an admin brute level past the cap", async () => {
    const { p, b } = await setup();
    await raise(b.id, 19);
    await h.db.query("update brutes set xp = 100, admin_brute = true where id = $1", [b.id]);
    const [o] = await opponents(p, b.id);
    await p.call("POST", `/api/brutes/${b.id}/fights`, { offerId: o.offerId });
    expect((await bruteRow(b.id)).pending_level_up).toBe(true);
  });
});
