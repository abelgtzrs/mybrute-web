import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bitsToHex, hexToChoices, type Choice } from "@mybrute/engine";
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
const bruteRow = async (id: string) => (await h.db.query("select * from brutes where id = $1", [id])).rows[0];
const raise = (id: string, levelUps: number) => h.db.query("update brutes set level_ups = $2, bits = $3 where id = $1", [id, levelUps, "00".repeat(Math.ceil(levelUps / 8))]);
const enter = (p: Player, id: string) => p.call("POST", `/api/brutes/${id}/tournament`);
const open = (p: Player, id: string, tid: string, body: unknown = {}) => p.call("POST", `/api/brutes/${id}/tournaments/${tid}/open`, body);
const list = async (p: Player, id: string) => (await p.call("GET", `/api/brutes/${id}/tournaments`)).body;
const tournamentFights = async () => Number((await h.db.query("select count(*) c from fights where tournament_id is not null")).rows[0].c);
const SURE_WIN = 499; // a level-500 brute against level 10–200 NPCs

describe("entering", () => {
  it("enters once a day and refuses a second entry without opening anything", async () => {
    const { p, b } = await setup();
    const first = await enter(p, b.id);
    expect(first.status).toBe(200);
    expect(first.body.tournament.roundsOpened).toBe(0);
    expect(first.body.tournament.rounds).toEqual([]);

    const second = await enter(p, b.id);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("already_entered");
    expect(await tournamentFights()).toBe(0);
    const view = await p.call("GET", `/api/brutes/${b.id}/tournaments/${first.body.tournament.id}`);
    expect(view.body.tournament.roundsOpened).toBe(0);

    // two requests at once: exactly one gets in
    const other = await p.newBrute("Other");
    const both = await Promise.all([enter(p, other.id), enter(p, other.id)]);
    expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("refuses entry while a level-up is waiting", async () => {
    const { p, b } = await setup();
    await h.db.query("update brutes set pending_level_up = true where id = $1", [b.id]);
    const r = await enter(p, b.id);
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("level_up_pending");
  });

  it("opening a past day's unopened tournament happens before a new entry", async () => {
    const { p, b } = await setup();
    await raise(b.id, SURE_WIN);
    const old = (await enter(p, b.id)).body.tournament;
    await h.db.query("update classic_tournaments set day = day - 1 where id = $1", [old.id]);

    const fresh = await enter(p, b.id);
    expect(fresh.status).toBe(200);
    const oldRow = (await h.db.query("select rounds_opened from classic_tournaments where id = $1", [old.id])).rows[0];
    expect(oldRow.rounds_opened).toBe(4);
    expect(await tournamentFights()).toBe(4);
    const row = await bruteRow(b.id);
    expect([row.xp, row.rank_titles]).toEqual([13, 1]);
    // the new tournament uses the title the old one paid
    expect(fresh.body.tournament.size).toBe(32);
    expect(fresh.body.tournament.roundsOpened).toBe(0);
  });
});

describe("hiding and opening", () => {
  it("hides results until rounds are opened", async () => {
    const { p, b } = await setup();
    await raise(b.id, SURE_WIN);
    const r = await enter(p, b.id);
    const t = r.body.tournament;
    expect(t.rounds).toEqual([]);
    expect(t.champion).toBeNull();
    expect(t.finished).toBe(false);
    expect(t.totalRounds).toBe(4);
    expect(t.next.opponent.name).toBeTruthy();
    expect((await list(p, b.id)).items[0].placing).toBeNull();

    const stored = (await h.db.query("select rounds from classic_tournaments where id = $1", [t.id])).rows[0].rounds;
    expect(t.next.opponent.name).toBe(stored[0].opponent.name);
    const later = String(stored[1].opponent.seedId);
    expect(JSON.stringify(r.body)).not.toContain(later);
    expect(JSON.stringify(await p.call("GET", `/api/brutes/${b.id}/tournaments/${t.id}`))).not.toContain(later);
    expect(JSON.stringify(await list(p, b.id))).not.toContain(later);
  });

  it("opens rounds in order and pays each once", async () => {
    const { p, b } = await setup();
    await raise(b.id, SURE_WIN);
    expect((await p.call("GET", `/api/brutes/${b.id}`)).body.todayTournamentId).toBeNull();
    const t = (await enter(p, b.id)).body.tournament;
    expect((await p.call("GET", `/api/brutes/${b.id}`)).body.todayTournamentId).toBe(t.id);

    const one = await open(p, b.id, t.id);
    expect(one.status).toBe(200);
    expect(one.body.fightIds).toHaveLength(1);
    expect((await bruteRow(b.id)).xp).toBe(2);
    const fight = (await h.db.query("select * from fights where id = $1", [one.body.fightIds[0]])).rows[0];
    expect([fight.tournament_round, fight.offer_id, fight.xp_awarded, fight.xp_after]).toEqual([1, null, 2, 2]);
    expect(one.body.tournament.rounds).toHaveLength(1);
    expect(one.body.tournament.rounds[0]).toMatchObject({ round: 1, fightId: one.body.fightIds[0], result: "win" });

    const rest = await open(p, b.id, t.id, { all: true });
    expect(rest.body.fightIds).toHaveLength(3);
    expect(rest.body.tournament).toMatchObject({ finished: true, champion: true, roundsOpened: 4, next: null });
    const row = await bruteRow(b.id);
    expect([row.xp, row.rank_titles]).toEqual([13, 1]);
    expect((await list(p, b.id)).items[0].placing).toBe("Champion");
    expect(rest.body.tournament.placing).toBe("Champion"); // the view and the list share one wording

    const again = await open(p, b.id, t.id, { all: true });
    expect(again.status).toBe(200);
    expect(again.body.fightIds).toEqual([]);
    expect((await bruteRow(b.id)).xp).toBe(13);
    expect(await tournamentFights()).toBe(4);
  });

  it("two concurrent opens pay once", async () => {
    const { p, b } = await setup();
    await raise(b.id, SURE_WIN);
    const t = (await enter(p, b.id)).body.tournament;
    const both = await Promise.all([open(p, b.id, t.id, { all: true }), open(p, b.id, t.id, { all: true })]);
    expect(both.map((r) => r.status)).toEqual([200, 200]);
    expect(both.map((r) => r.body.fightIds.length).sort()).toEqual([0, 4]);
    expect((await bruteRow(b.id)).xp).toBe(13);
    expect(await tournamentFights()).toBe(4);
  });

  it("opening by round number is idempotent and in order", async () => {
    const { p, b } = await setup();
    await raise(b.id, SURE_WIN);
    const t = (await enter(p, b.id)).body.tournament;
    const both = await Promise.all([open(p, b.id, t.id, { round: 1 }), open(p, b.id, t.id, { round: 1 })]);
    expect(both.map((r) => r.status)).toEqual([200, 200]);
    expect(both[0].body.fightIds).toHaveLength(1);
    expect(both[1].body.fightIds).toEqual(both[0].body.fightIds);
    expect((await bruteRow(b.id)).xp).toBe(2);
    expect(await tournamentFights()).toBe(1);
    expect(both[0].body.tournament.roundsOpened).toBe(1);

    const later = await open(p, b.id, t.id, { round: 1 });
    expect(later.body.fightIds).toEqual(both[0].body.fightIds);
    const skip = await open(p, b.id, t.id, { round: 3 });
    expect([skip.status, skip.body.error]).toEqual([409, "round_out_of_order"]);
    expect((await open(p, b.id, t.id, { round: 0 })).status).toBe(400);
  });

  it("opening works while a level-up is waiting", async () => {
    const { p, b } = await setup();
    const t = (await enter(p, b.id)).body.tournament;
    await h.db.query("update brutes set pending_level_up = true where id = $1", [b.id]);
    expect((await open(p, b.id, t.id)).status).toBe(200);
  });

  it("fights use the snapshot taken at entry", async () => {
    const { p, b } = await setup();
    await raise(b.id, 30);
    const t = (await enter(p, b.id)).body.tournament;
    await raise(b.id, 60);
    await open(p, b.id, t.id, { all: true });
    const fights = (await h.db.query("select spec, level_ups from fights where tournament_id = $1", [t.id])).rows;
    expect(fights.length).toBeGreaterThan(0);
    for (const f of fights) expect([f.spec.brutes[0].levelUps, f.level_ups]).toEqual([30, 30]);
  });
});

describe("rewards", () => {
  it("third title ranks up and resets the bracket to 16", async () => {
    const { p, b } = await setup();
    await raise(b.id, SURE_WIN);
    await h.db.query("update brutes set rank_titles = 2 where id = $1", [b.id]);
    const t = (await enter(p, b.id)).body.tournament;
    expect([t.size, t.totalRounds]).toEqual([64, 6]);
    await open(p, b.id, t.id, { all: true });
    const row = await bruteRow(b.id);
    expect([row.rank, row.rank_titles, row.xp]).toEqual([1, 0, 6 * 2 + 15]);
    const cell = (await p.call("GET", `/api/brutes/${b.id}`)).body;
    expect(cell.brute.rank.bracketSize).toBe(16);
  });

  it("rank 11 keeps counting titles and pays at most 25", async () => {
    const { p, b } = await setup();
    await raise(b.id, SURE_WIN);
    await h.db.query("update brutes set rank = 11, rank_titles = 7 where id = $1", [b.id]);
    const t = (await enter(p, b.id)).body.tournament;
    expect(t.size).toBe(256);
    await open(p, b.id, t.id, { all: true });
    const row = await bruteRow(b.id);
    expect([row.rank, row.rank_titles, row.xp]).toEqual([11, 8, 8 * 2 + 25]);
  });

  it("a knocked-out brute keeps XP for its wins and gains no title", async () => {
    const { p, b } = await setup(); // level 1 against level 10–15 NPCs
    const t = (await enter(p, b.id)).body.tournament;
    const r = await open(p, b.id, t.id, { all: true });
    expect(r.body.tournament).toMatchObject({ finished: true, champion: false, roundsOpened: 1 });
    expect(r.body.tournament.rounds[0].result).toBe("loss");
    const row = await bruteRow(b.id);
    expect([row.xp, row.rank_titles]).toEqual([0, 0]);
    expect((await list(p, b.id)).items[0].placing).toBe("Round of 16");
  });
});

describe("privacy", () => {
  it("other players see 404", async () => {
    const { p, b } = await setup();
    const t = (await enter(p, b.id)).body.tournament;
    const fightId = (await open(p, b.id, t.id)).body.fightIds[0];
    const bob = await Player.register(h.app, "bob");
    expect((await bob.call("GET", `/api/brutes/${b.id}/tournaments/${t.id}`)).status).toBe(404);
    expect((await open(bob, b.id, t.id)).status).toBe(404);
    expect((await bob.call("GET", `/api/brutes/${b.id}/tournaments`)).status).toBe(404);
    expect((await bob.call("GET", `/api/fights/${fightId}`)).status).toBe(404);
  });
});

describe("training-only records", () => {
  it("keeps tournament fights out of records, lifetime and fight history, and labels them on the fight page", async () => {
    const { p, b } = await setup();
    await raise(b.id, SURE_WIN);
    const admin = await Player.register(h.app, "root");
    await h.db.query("update users set role = 'admin' where username = 'root'");
    const adminFights = async () => (await admin.call("GET", "/api/admin/overview")).body.counts.fights;
    const cell = async () => (await p.call("GET", `/api/brutes/${b.id}`)).body;
    const history = async () => (await p.call("GET", `/api/brutes/${b.id}/fights`)).body;
    const before = { record: (await cell()).brute.record.fights, lifetime: (await cell()).lifetime.fights, total: (await history()).total, admin: await adminFights() };

    const t = (await enter(p, b.id)).body.tournament;
    const fightId = (await open(p, b.id, t.id, { all: true })).body.fightIds[0];

    const after = await cell();
    expect([after.brute.record.fights, after.lifetime.fights, (await history()).total]).toEqual([before.record, before.lifetime, before.total]);
    expect(after.recentFights ?? []).toHaveLength(0);
    expect(await adminFights()).toBe(before.admin + 4);
    const fight = (await p.call("GET", `/api/fights/${fightId}`)).body.fight;
    expect(fight.tournament).toMatchObject({ round: 1, totalRounds: 4 });
  });
});

describe("time capsule", () => {
  const capsule = (p: Player, id: string, level: number) => p.call("POST", `/api/brutes/${id}/time-capsule`, { level });
  // a brute at its cap (level 20) with known choices and one level_ups row per choice
  async function atCap(id: string) {
    const choices = Array.from({ length: 19 }, (_, i) => (i % 3 === 0 ? 1 : 0)) as Choice[];
    await h.db.query("update brutes set level_ups = 19, bits = $2 where id = $1", [id, bitsToHex(choices, 19)]);
    for (let i = 0; i < 19; i++) {
      await h.db.query("insert into level_ups (brute_id, idx, choice, options, xp_spent) values ($1, $2, $3, '[]', 2)", [id, i, choices[i]]);
    }
    return choices;
  }

  it("rewinds to the chosen level, keeps banked XP and the choices before it", async () => {
    const { p, b } = await setup();
    const choices = await atCap(b.id);
    await h.db.query("update brutes set xp = 300, rank_titles = 2 where id = $1", [b.id]);
    expect((await p.call("GET", `/api/brutes/${b.id}`)).body.capsule).toEqual({ maxTarget: 15 });

    const r = await capsule(p, b.id, 5);
    expect(r.status).toBe(200);
    const row = await bruteRow(b.id);
    expect([row.level_ups, row.xp, row.pending_level_up, row.rank, row.rank_titles]).toEqual([4, 300, true, 0, 2]);
    expect(hexToChoices(row.bits, 4)).toEqual(choices.slice(0, 4));
    expect(Number((await h.db.query("select count(*) c from level_ups where brute_id = $1 and idx >= 4", [b.id])).rows[0].c)).toBe(0);
    expect((await p.call("GET", `/api/brutes/${b.id}`)).body.capsule).toBeNull();
  });

  it("refuses below the cap, above cap minus 5, and for admin brutes", async () => {
    const { p, b } = await setup();
    await raise(b.id, 18); // level 19, one short of the cap
    const early = await capsule(p, b.id, 5);
    expect([early.status, early.body.error]).toEqual([409, "capsule_unavailable"]);

    await raise(b.id, 19);
    expect((await capsule(p, b.id, 16)).status).toBe(400);
    expect((await capsule(p, b.id, 0)).status).toBe(400);

    await h.db.query("update brutes set admin_brute = true where id = $1", [b.id]);
    const admin = await capsule(p, b.id, 5);
    expect([admin.status, admin.body.error]).toEqual([409, "capsule_unavailable"]);
  });

  it("an unopened tournament keeps its snapshot after a rewind", async () => {
    const { p, b } = await setup();
    await raise(b.id, 19);
    const t = (await enter(p, b.id)).body.tournament;
    expect((await capsule(p, b.id, 5)).status).toBe(200);
    await open(p, b.id, t.id, { all: true });
    const fights = (await h.db.query("select spec from fights where tournament_id = $1", [t.id])).rows;
    expect(fights.length).toBeGreaterThan(0);
    for (const f of fights) expect(f.spec.brutes[0].levelUps).toBe(19);
  });
});
