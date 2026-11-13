// Classic Mode: the authoritative game state. Every mutation runs in one transaction that locks the brute row,
// so concurrent requests for the same brute are serialised and XP can never be awarded twice.
// What a brute IS (stats, weapons, skills, pets, offers at level-up, fight outcomes) always comes from the
// original engine via @mybrute/engine; this file only adds the Classic rules on top.
import { randomInt } from "node:crypto";
import {
  bitsToHex, describe, displayLevel, extractStats, hexToChoices, isValidGfx, isValidSeedId, pendingOptions,
  randomGfx, runFight, type Choice, type Description, type FighterStats, type FightSpec, type LevelOption,
} from "@mybrute/engine";
import { isUniqueViolation, withTx, type Db, type Tx } from "./db";
import { badRequest, conflict, notFound } from "./errors";
import { bruteNameProblem, classicDay, capFor, fightsUsedToday, isWaiting, rankInfo, requiredXp, xpFor, type FightResult } from "./rules";

const ARENA = 2; // the arena every historical payload uses
const OPPONENTS_PER_VISIT = 8;
const HISTORY_PAGE = 20;

interface BruteRow {
  id: string; owner_id: string; name: string; seed_id: number; gfx: string; level_ups: number; bits: string;
  xp: number; pending_level_up: boolean; fights_day: string | null; fights_used: number; created_at: Date; appearance_changes: number;
  rank: number; rank_titles: number; admin_brute: boolean;
}

export interface Settings { maxBrutesDefault: number; dailyFights: number; maxImportLevel: number }
export async function getSettings(db: Db | Tx): Promise<Settings> {
  const rows = (await db.query<{ key: string; value: number }>("select key, value from settings")).rows;
  const get = (k: string, d: number) => Number(rows.find((r) => r.key === k)?.value ?? d);
  return { maxBrutesDefault: get("max_brutes_default", 5), dailyFights: get("daily_fights", 10), maxImportLevel: get("max_import_level", 1) };
}

const kit = (d: Description) => ({ weapons: d.fin.weapons, supers: d.fin.supers, followers: d.fin.followers, perms: d.fin.perms, talents: d.fin.talents });
const attributes = (d: Description) => ({ strength: d.fin.force, agility: d.fin.agility, speed: d.fin.speed, life: d.fin.life });
const choicesOf = (b: Pick<BruteRow, "bits" | "level_ups">) => hexToChoices(b.bits, b.level_ups);
// pg returns DATE columns as local-midnight Date objects; compare by calendar day string
const dayString = (d: string | Date | null) => (d == null ? null : typeof d === "string" ? d.slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);

function summary(b: BruteRow, s: Settings, record: { fights: number; wins: number; losses: number; draws: number }) {
  const level = displayLevel(b.level_ups);
  const used = fightsUsedToday(dayString(b.fights_day), b.fights_used);
  // at or above the cap, new XP is only banked until a rank-up lifts the cap
  const banked = level >= capFor(b.rank, b.admin_brute);
  return {
    id: b.id, name: b.name, seedId: b.seed_id, gfx: b.gfx, level, levelUps: b.level_ups,
    xp: b.xp, xpRequired: requiredXp(level), pendingLevelUp: b.pending_level_up,
    adminBrute: b.admin_brute, rank: rankInfo(b.rank, b.rank_titles, b.admin_brute), banked,
    fightsLeft: Math.max(0, s.dailyFights - used), dailyFights: s.dailyFights, record, createdAt: b.created_at,
  };
}

async function records(db: Db | Tx, bruteIds: string[]) {
  const out = new Map<string, { fights: number; wins: number; losses: number; draws: number }>();
  if (!bruteIds.length) return out;
  const r = await db.query<{ brute_id: string; fights: string; wins: string; losses: string; draws: string }>(
    `select brute_id, count(*) fights, count(*) filter (where result = 'win') wins,
            count(*) filter (where result = 'loss') losses, count(*) filter (where result = 'draw') draws
       from fights where brute_id = any($1::bigint[]) group by brute_id`, [bruteIds]);
  for (const row of r.rows) out.set(row.brute_id, { fights: +row.fights, wins: +row.wins, losses: +row.losses, draws: +row.draws });
  return out;
}
const emptyRecord = { fights: 0, wins: 0, losses: 0, draws: 0 };

/** Loads a brute the user owns, optionally locking it. Someone else's brute looks exactly like a missing one. */
async function ownedBrute(db: Db | Tx, userId: string, bruteId: string, lock = false): Promise<BruteRow> {
  if (!/^\d{1,18}$/.test(bruteId)) throw notFound("That brute doesn't exist.");
  const r = await db.query<BruteRow>(`select * from brutes where id = $1 and owner_id = $2${lock ? " for update" : ""}`, [bruteId, userId]);
  if (!r.rows[0]) throw notFound("That brute doesn't exist.");
  return r.rows[0];
}

// ---------------------------------------------------------------- brutes

// admins may start a brute at any level (the game's maximum is 500); everyone else is capped by the import setting
export const ADMIN_MAX_LEVEL = 500;

export async function listBrutes(db: Db, userId: string, role: string = "player") {
  const s = await getSettings(db);
  const rows = (await db.query<BruteRow>("select * from brutes where owner_id = $1 order by created_at, id", [userId])).rows;
  const rec = await records(db, rows.map((r) => r.id));
  const limit = (await db.query<{ max_brutes: number | null }>("select max_brutes from users where id = $1", [userId])).rows[0]?.max_brutes ?? s.maxBrutesDefault;
  return { brutes: rows.map((b) => ({ ...summary(b, s, rec.get(b.id) ?? emptyRecord), attributes: attributes(describe(b.seed_id, b.level_ups, choicesOf(b))) })), maxBrutes: limit, maxImportLevel: role === "admin" ? ADMIN_MAX_LEVEL : Math.max(1, s.maxImportLevel) };
}

export async function createBrute(db: Db, userId: string, body: unknown, role: string = "player") {
  const b = (body ?? {}) as Record<string, unknown>;
  const nameProblem = bruteNameProblem(b.name);
  if (nameProblem) throw badRequest(nameProblem);
  if (!isValidSeedId(b.seedId)) throw badRequest("The id is a whole number from 1 to 2147483647.");
  if (!isValidGfx(b.gfx)) throw badRequest("The appearance needs 16 numbers separated by semicolons.");
  // a Lab import may start above level 1, up to the admin's cap; choices are its level-up picks (0/1)
  const levelUps = b.levelUps ?? 0;
  if (!Number.isInteger(levelUps) || (levelUps as number) < 0 || (levelUps as number) > 499) throw badRequest("The level is a whole number from 1 to 500.");
  const choices = b.choices ?? [];
  if (!Array.isArray(choices) || choices.length < (levelUps as number) || !choices.every((c) => c === 0 || c === 1)) throw badRequest("Send one level-up choice (0 or 1) per level.");
  const name = (b.name as string).trim();
  try {
    return await withTx(db, async (tx) => {
      // lock the account row so two creations at once can't both slip under the limit
      const user = (await tx.query<{ max_brutes: number | null }>("select max_brutes from users where id = $1 for update", [userId])).rows[0];
      const settings = await getSettings(tx);
      const limit = user.max_brutes ?? settings.maxBrutesDefault;
      const count = Number((await tx.query<{ c: string }>("select count(*) c from brutes where owner_id = $1", [userId])).rows[0].c);
      if (count >= limit) throw conflict(`You already have ${count} of ${limit} brutes. Delete one to make room.`, "brute_limit");
      const cap = role === "admin" ? ADMIN_MAX_LEVEL : Math.max(1, settings.maxImportLevel);
      if (displayLevel(levelUps as number) > cap) throw badRequest(`Brutes can be imported up to level ${cap}.`);
      const row = (await tx.query<BruteRow>(
        "insert into brutes (owner_id, name, seed_id, gfx, level_ups, bits, admin_brute) values ($1, $2, $3, $4, $5, $6, $7) returning *",
        [userId, name, b.seedId, b.gfx, levelUps, bitsToHex(choices as Choice[], levelUps as number), role === "admin"])).rows[0];
      return { brute: summary(row, settings, emptyRecord) };
    });
  } catch (e) {
    if (isUniqueViolation(e, "brutes_name_unique")) throw conflict("Another brute already has that name.", "name_taken");
    throw e;
  }
}

// Players may change a brute's appearance once; admins may change it any time and their changes don't use up that one change.
export async function changeAppearance(db: Db, userId: string, bruteId: string, body: unknown, role: string = "player") {
  const req = (body ?? {}) as Record<string, unknown>;
  if (!isValidGfx(req.gfx)) throw badRequest("The appearance needs 16 numbers separated by semicolons.");
  return withTx(db, async (tx) => {
    const b = await ownedBrute(tx, userId, bruteId, true);
    const admin = role === "admin";
    if (!admin && b.appearance_changes >= 1) throw conflict("You can change a brute's appearance only once.", "appearance_used");
    await tx.query("update brutes set gfx = $2, appearance_changes = appearance_changes + $3 where id = $1",
      [b.id, req.gfx, admin ? 0 : 1]);
    return { ok: true, gfx: req.gfx as string };
  });
}

export async function deleteBrute(db: Db, userId: string, bruteId: string) {
  await withTx(db, async (tx) => {
    await ownedBrute(tx, userId, bruteId, true);
    await tx.query("delete from brutes where id = $1", [bruteId]);
  });
  return { ok: true };
}

const STAT_KEYS = [
  "damageDealt", "petDamageDealt", "totalDamageDealt", "damageReceived", "poisonDamageReceived", "petDamageReceived",
  "attacks", "hits", "dodges", "blocks", "attacksDodgedByOpponent", "attacksBlockedByOpponent", "weaponsDrawn",
  "weaponsThrown", "disarms", "timesDisarmed", "weaponsDestroyed", "shieldsBroken", "steals", "nets", "grabs",
  "hypnosis", "bombs", "downpours", "potions", "meals", "lifeRestored", "petsKilled", "petsLost", "enemyBrutesDown",
] as const;
const COUNTER_KEYS = ["COUNTER", "RIPOSTE", "DISARM", "STRIKE", "MISSILE_LIGHT"] as const;

/** Lifetime statistics, summed from the stored per-fight results. */
async function lifetime(db: Db | Tx, bruteId: string) {
  const sums = STAT_KEYS.map((k) => `coalesce(sum((player_stats->>'${k}')::int), 0) as "${k}"`).join(", ");
  const counters = COUNTER_KEYS.map((k) => `coalesce(sum((player_stats->'teamCounters'->>'${k}')::int), 0) as "c_${k}"`).join(", ");
  const r = await db.query(
    `select count(*)::int fights, coalesce(max((player_stats->>'highestHit')::int), 0) as "highestHit",
            coalesce(max((player_stats->>'totalDamageDealt')::int), 0) as "bestFightDamage",
            coalesce(sum(xp_awarded), 0)::int as "xpFromFights", ${sums}, ${counters}
       from fights where brute_id = $1`, [bruteId]);
  const row = r.rows[0] as Record<string, string | number>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(row)) out[k.startsWith("c_") ? k.slice(2).toLowerCase() : k] = Number(v);
  return out;
}

export async function getCell(db: Db, userId: string, bruteId: string, role: string = "player") {
  const b = await ownedBrute(db, userId, bruteId);
  const s = await getSettings(db);
  const choices = choicesOf(b);
  const d = describe(b.seed_id, b.level_ups, choices);
  const rec = (await records(db, [b.id])).get(b.id) ?? emptyRecord;
  const recent = (await listFights(db, userId, bruteId, { page: 1, pageSize: 5 })).fights;
  const levelUps = (await db.query<{ idx: number; choice: number; options: [LevelOption, LevelOption]; created_at: Date }>(
    "select idx, choice, options, created_at from level_ups where brute_id = $1 order by idx", [b.id])).rows
    .map((l) => ({ index: l.idx, level: l.idx + 2, choice: l.choice, chosen: l.options[l.choice], other: l.options[1 - l.choice], at: l.created_at }));
  return {
    brute: summary(b, s, rec),
    canChangeAppearance: role === "admin" || b.appearance_changes < 1,
    bits: b.bits,
    attributes: attributes(d), kit: kit(d), check: d.check,
    pendingOptions: b.pending_level_up ? pendingOptions(b.seed_id, b.level_ups, choices) : null,
    lifetime: await lifetime(db, b.id),
    recentFights: recent,
    levelUps,
  };
}

// ---------------------------------------------------------------- opponents

const rand = (n: number) => randomInt(n);

/** Eight fresh same-level opponents built by the original progression from random ids and random choices. */
export async function newOpponents(db: Db, userId: string, bruteId: string) {
  return withTx(db, async (tx) => {
    const b = await ownedBrute(tx, userId, bruteId, true);
    // unchosen offers older than the latest list are dropped; chosen ones stay because fights reference them.
    // The latest list stays valid: two requests close together (a double-loaded page, a second tab) would otherwise
    // delete the list the page is showing. A list's offers share created_at, since now() is fixed per transaction.
    await tx.query(
      `delete from opponent_offers where brute_id = $1 and consumed_at is null
         and created_at < (select max(created_at) from opponent_offers where brute_id = $1 and consumed_at is null)`, [b.id]);
    const used = new Set([b.seed_id]);
    const offers = [];
    for (let i = 0; i < OPPONENTS_PER_VISIT; i++) {
      let seedId: number;
      do seedId = randomInt(1, 2147483648); while (used.has(seedId));
      used.add(seedId);
      const choices = Array.from({ length: b.level_ups }, () => rand(2) as Choice);
      const bits = bitsToHex(choices, b.level_ups);
      const gfx = randomGfx(rand);
      const row = (await tx.query<{ id: string }>(
        "insert into opponent_offers (brute_id, level_ups, seed_id, name, gfx, bits) values ($1, $2, $3, $4, $5, $6) returning id",
        [b.id, b.level_ups, seedId, String(seedId), gfx, bits])).rows[0];
      const d = describe(seedId, b.level_ups, choices);
      offers.push({ offerId: row.id, name: String(seedId), seedId, level: displayLevel(b.level_ups), levelUps: b.level_ups, choices, gfx, attributes: attributes(d), kit: kit(d) });
    }
    return { opponents: offers };
  });
}

// ---------------------------------------------------------------- fights

interface OfferRow { id: string; brute_id: string; level_ups: number; seed_id: number; name: string; gfx: string; bits: string; consumed_at: Date | null }

/**
 * Runs and records a training fight against one of the brute's current offers. Idempotent per offer:
 * repeating the request returns the fight that was already recorded.
 */
export async function startFight(db: Db, userId: string, bruteId: string, body: unknown) {
  const offerId = String((body as Record<string, unknown> | null)?.offerId ?? "");
  if (!/^\d{1,18}$/.test(offerId)) throw badRequest("Pick an opponent.");
  return withTx(db, async (tx) => {
    const b = await ownedBrute(tx, userId, bruteId, true);
    const offer = (await tx.query<OfferRow>("select * from opponent_offers where id = $1 and brute_id = $2 for update", [offerId, b.id])).rows[0];
    if (!offer) throw notFound("That opponent is no longer available. Pick another.");
    if (offer.consumed_at) {
      const existing = (await tx.query<{ id: string }>("select id from fights where offer_id = $1", [offer.id])).rows[0];
      if (existing) return { fightId: existing.id, repeated: true };
      throw conflict("That opponent is no longer available. Pick another.", "offer_used");
    }
    if (b.pending_level_up) throw conflict("Choose this brute's level-up before fighting again.", "level_up_pending");
    if (offer.level_ups !== b.level_ups) throw conflict("Your brute has levelled up since these opponents were found. Pick from a new list.", "offer_stale");
    const s = await getSettings(tx);
    const today = classicDay();
    const used = fightsUsedToday(dayString(b.fights_day), b.fights_used, today);
    if (used >= s.dailyFights) throw conflict("No fights left today for this brute. They come back at midnight (Bordeaux time).", "no_fights_left");

    const spec: FightSpec = {
      seed: randomInt(0, 2 ** 30), // chosen only now, after the opponent is picked, so outcomes can't be scouted
      arena: ARENA, lang: "en", p0: null, p1: null,
      brutes: [
        { name: b.name, id: b.seed_id, team: 0, levelUps: b.level_ups, gfx: b.gfx, choices: choicesOf(b) },
        { name: offer.name, id: offer.seed_id, team: 1, levelUps: offer.level_ups, gfx: offer.gfx, choices: hexToChoices(offer.bits, offer.level_ups) },
      ],
    };
    const r = runFight(spec);
    const stats = extractStats(r);
    const result: FightResult = r.win === null ? "draw" : r.win === 0 ? "win" : "loss";
    const award = xpFor(result);
    const xpAfter = b.xp + award;
    const pendingAfter = isWaiting(xpAfter, displayLevel(b.level_ups), capFor(b.rank, b.admin_brute));

    const fight = (await tx.query<{ id: string }>(
      `insert into fights (brute_id, offer_id, spec, result, events, xp_awarded, level_ups, xp_after, pending_after, player_stats, opponent_stats)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [b.id, offer.id, spec, result, r.history.length, award, b.level_ups, xpAfter, pendingAfter,
        stats.get(b.seed_id), stats.get(offer.seed_id)])).rows[0];
    await tx.query("update brutes set xp = $2, pending_level_up = $3, fights_day = $4, fights_used = $5 where id = $1",
      [b.id, xpAfter, pendingAfter, today, used + 1]);
    await tx.query("update opponent_offers set consumed_at = now() where id = $1", [offer.id]);
    return { fightId: fight.id, repeated: false };
  });
}

interface FightRow {
  id: string; brute_id: string; created_at: Date; spec: FightSpec; result: FightResult; events: number; xp_awarded: number;
  level_ups: number; xp_after: number; pending_after: boolean; player_stats: FighterStats; opponent_stats: FighterStats;
}

export async function getFight(db: Db, userId: string, fightId: string) {
  if (!/^\d{1,18}$/.test(fightId)) throw notFound("That fight doesn't exist.");
  const f = (await db.query<FightRow & { owner_id: string }>(
    "select f.*, b.owner_id from fights f join brutes b on b.id = f.brute_id where f.id = $1 and b.owner_id = $2", [fightId, userId])).rows[0];
  if (!f) throw notFound("That fight doesn't exist.");
  const b = await ownedBrute(db, userId, f.brute_id);
  const s = await getSettings(db);
  const [player, opponent] = f.spec.brutes;
  const level = displayLevel(f.level_ups);
  return {
    fight: {
      id: f.id, createdAt: f.created_at, result: f.result, events: f.events, xpAwarded: f.xp_awarded,
      level, xpAfter: f.xp_after, xpRequired: requiredXp(level), pendingAfter: f.pending_after,
      spec: f.spec, playerStats: f.player_stats, opponentStats: f.opponent_stats,
      player: { name: player.name, seedId: player.id, gfx: player.gfx, level },
      opponent: { name: opponent.name, seedId: opponent.id, gfx: opponent.gfx, level: displayLevel(opponent.levelUps) },
    },
    brute: summary(b, s, (await records(db, [b.id])).get(b.id) ?? emptyRecord),
  };
}

export async function listFights(db: Db, userId: string, bruteId: string, q: { page?: number; pageSize?: number; result?: string }) {
  const b = await ownedBrute(db, userId, bruteId);
  const pageSize = Math.min(50, Math.max(1, q.pageSize ?? HISTORY_PAGE));
  const page = Math.max(1, Math.floor(q.page ?? 1));
  const filter = q.result === "win" || q.result === "loss" || q.result === "draw" ? q.result : null;
  const r = await db.query<FightRow & { total: string }>(
    `select *, count(*) over () total from fights where brute_id = $1 and ($2::text is null or result = $2)
      order by created_at desc, id desc limit $3 offset $4`, [b.id, filter, pageSize, (page - 1) * pageSize]);
  return {
    total: Number(r.rows[0]?.total ?? 0), page, pageSize,
    fights: r.rows.map((f) => ({
      id: f.id, createdAt: f.created_at, result: f.result, xpAwarded: f.xp_awarded, level: displayLevel(f.level_ups),
      opponent: { name: f.spec.brutes[1].name, level: displayLevel(f.spec.brutes[1].levelUps), gfx: f.spec.brutes[1].gfx },
      damageDealt: f.player_stats.totalDamageDealt, damageReceived: f.player_stats.damageReceived,
    })),
  };
}

// ---------------------------------------------------------------- level-ups

/**
 * Applies the player's pick between the two authentic options. `index` is the level-up being decided
 * (the brute's current level-up count); repeating a request that already went through returns the same state.
 */
export async function levelUp(db: Db, userId: string, bruteId: string, body: unknown) {
  const b0 = (body ?? {}) as Record<string, unknown>;
  const index = b0.index, choice = b0.choice;
  if (!Number.isInteger(index) || (index as number) < 0) throw badRequest("Missing which level-up this is.");
  if (choice !== 0 && choice !== 1) throw badRequest("Pick one of the two rewards.");
  return withTx(db, async (tx) => {
    const b = await ownedBrute(tx, userId, bruteId, true);
    if (b.level_ups > (index as number)) {
      const done = (await tx.query<{ choice: number }>("select choice from level_ups where brute_id = $1 and idx = $2", [b.id, index])).rows[0];
      if (done && done.choice === choice) return { ok: true, repeated: true, level: displayLevel(b.level_ups) };
      throw conflict("That level-up was already decided.", "level_up_done");
    }
    const cap = capFor(b.rank, b.admin_brute);
    if (displayLevel(b.level_ups) >= cap) throw conflict("This brute has reached its rank's level cap. Win tournaments to raise it.", "level_cap");
    if (b.level_ups !== index || !b.pending_level_up) throw conflict("This brute has no level-up waiting.", "no_level_up");

    const choices = choicesOf(b);
    const options = pendingOptions(b.seed_id, b.level_ups, choices);
    const next = [...choices, choice as Choice];
    const levelUps = b.level_ups + 1;
    const check = describe(b.seed_id, levelUps, next);
    if (!check.check) throw new Error(`progression check failed for brute ${b.id}`);
    const spent = requiredXp(displayLevel(b.level_ups));
    const xp = b.xp - spent;
    const pending = isWaiting(xp, displayLevel(levelUps), cap);
    await tx.query("insert into level_ups (brute_id, idx, choice, options, xp_spent) values ($1, $2, $3, $4, $5)",
      [b.id, index, choice, JSON.stringify(options), spent]);
    await tx.query("update brutes set level_ups = $2, bits = $3, xp = $4, pending_level_up = $5 where id = $1",
      [b.id, levelUps, bitsToHex(next, levelUps), xp, pending]);
    return { ok: true, repeated: false, level: displayLevel(levelUps), chosen: options[choice as number] };
  });
}
