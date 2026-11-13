// Daily ranked tournaments. The whole bracket is simulated when the brute enters and stored hidden in
// classic_tournaments; each round's fight is written to `fights` (and paid) only when the player opens it.
// Because unopened results never reach `fights`, no other read path can leak them.
import { randomInt } from "node:crypto";
import { bitsToHex, displayLevel, hexToChoices } from "@mybrute/engine";
import { simulateBracket, type BracketRound, type Npc, type Snapshot } from "./bracket";
import { ownedBrute, type BruteRow } from "./classic";
import { isUniqueViolation, withTx, type Db, type Tx } from "./db";
import { badRequest, conflict, notFound } from "./errors";
import { bracketSize, capFor, capsuleMaxTarget, classicDay, isWaiting, RANKS, titleXp } from "./rules";

const LIST_PAGE = 20;
const WIN_XP = 2;

interface TournamentRow {
  id: string; brute_id: string; day: string; rank: number; titles_before: number; size: number;
  snapshot: Snapshot; rounds: BracketRound[]; rounds_opened: number; champion: boolean;
}

type Opponent = { name: string; level: number; gfx: string };
export interface OpenedRound { round: number; fightId: string; result: "win" | "loss"; opponent: Opponent }
export interface TournamentView {
  id: string; day: string; rank: number; rankName: string; size: number; totalRounds: number; roundsOpened: number;
  finished: boolean; champion: boolean | null; placing: string | null; rounds: OpenedRound[]; next: { opponent: Opponent } | null;
}
export interface TournamentListItem {
  id: string; day: string; rank: number; rankName: string; size: number; roundsOpened: number; finished: boolean; placing: string | null;
}

const opponentOf = (n: Npc): Opponent => ({ name: n.name, level: displayLevel(n.levelUps), gfx: n.gfx });
const alreadyEntered = () => conflict("This brute already entered today's tournament.", "already_entered");

/**
 * What the player may see: the opened rounds and the next opponent only. Built field by field from the row so
 * later opponents, the round count and the champion flag never leave the server before every round is open.
 */
async function view(db: Db | Tx, t: TournamentRow): Promise<TournamentView> {
  const fightIds = (await db.query<{ id: string }>(
    "select id from fights where tournament_id = $1 order by tournament_round", [t.id])).rows.map((r) => r.id);
  const finished = t.rounds_opened === t.rounds.length;
  const next = t.rounds[t.rounds_opened]; // undefined once everything is open
  return {
    id: t.id, day: t.day, rank: t.rank, rankName: RANKS[t.rank].name, size: t.size,
    totalRounds: Math.log2(t.size), roundsOpened: t.rounds_opened, finished,
    champion: finished ? t.champion : null,
    placing: placingOf(finished, t.champion, t.size, t.rounds.length),
    rounds: t.rounds.slice(0, t.rounds_opened).map((r, i) => ({ round: i + 1, fightId: fightIds[i], result: r.result, opponent: opponentOf(r.opponent) })),
    next: next ? { opponent: opponentOf(next.opponent) } : null,
  };
}

/** Name of the round a brute lost in, from how many brutes were still in: 2 = final, 4 = semi-final, ... */
function placing(size: number, lostInRound: number): string {
  const left = size / 2 ** (lostInRound - 1);
  return left === 2 ? "Final" : left === 4 ? "Semi-final" : left === 8 ? "Quarter-final" : `Round of ${left}`;
}

/** The one place placing text is decided (view and list share it). Null until every round is open. */
function placingOf(finished: boolean, champion: boolean, size: number, played: number): string | null {
  return !finished ? null : champion ? "Champion" : placing(size, played);
}

async function tournamentRow(db: Db | Tx, bruteId: string, tid: string, lock = false): Promise<TournamentRow> {
  if (!/^\d{1,18}$/.test(tid)) throw notFound("That tournament doesn't exist.");
  const r = await db.query<TournamentRow>(
    `select * from classic_tournaments where id = $1 and brute_id = $2${lock ? " for update" : ""}`, [tid, bruteId]);
  if (!r.rows[0]) throw notFound("That tournament doesn't exist.");
  return r.rows[0];
}

/**
 * Opens up to `count` rounds in order: writes each fight and pays its rewards. The caller holds the brute and
 * tournament row locks, so rounds_opened can't move underneath us and nothing is paid twice.
 * `b` and `t` are updated in place to match what was written.
 */
async function openNext(tx: Tx, b: BruteRow, t: TournamentRow, count: number): Promise<string[]> {
  const fightIds: string[] = [];
  while (fightIds.length < count && t.rounds_opened < t.rounds.length) {
    const round = t.rounds[t.rounds_opened];
    const roundNo = t.rounds_opened + 1;
    const award = round.result === "win" ? WIN_XP : 0;
    let xp = b.xp + award;
    // winning the last stored round is the title (the bracket stops at the brute's first loss)
    if (t.champion && roundNo === t.rounds.length) {
      xp += titleXp(t.titles_before);
      b.rank_titles += 1;
      const needed = RANKS[b.rank].titlesNeeded; // null on the top rank: it just keeps counting
      if (needed !== null && b.rank_titles >= needed) { b.rank += 1; b.rank_titles = 0; }
    }
    b.xp = xp;
    // the brute's current level and the possibly new cap decide whether a level-up now waits
    b.pending_level_up = isWaiting(xp, displayLevel(b.level_ups), capFor(b.rank, b.admin_brute));

    const fight = (await tx.query<{ id: string }>(
      `insert into fights (brute_id, tournament_id, tournament_round, spec, result, events, xp_awarded, level_ups,
                           xp_after, pending_after, player_stats, opponent_stats)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
      [b.id, t.id, roundNo, round.spec, round.result, round.events, award, t.snapshot.levelUps,
        b.xp, b.pending_level_up, round.playerStats, round.opponentStats])).rows[0];
    await tx.query("update brutes set xp = $2, pending_level_up = $3, rank = $4, rank_titles = $5 where id = $1",
      [b.id, b.xp, b.pending_level_up, b.rank, b.rank_titles]);
    t.rounds_opened = roundNo;
    await tx.query("update classic_tournaments set rounds_opened = $2 where id = $1", [t.id, roundNo]);
    fightIds.push(fight.id);
  }
  return fightIds;
}

async function refuseIfEntered(tx: Tx, bruteId: string, day: string) {
  const r = await tx.query("select 1 from classic_tournaments where brute_id = $1 and day = $2", [bruteId, day]);
  if (r.rows[0]) throw alreadyEntered();
}

export async function enterTournament(db: Db, userId: string, bruteId: string): Promise<{ tournament: TournamentView }> {
  const today = classicDay();
  // A past day's unopened rounds are opened (and paid) first, in their own transaction: the new tournament's
  // rank and size depend on them. The "already entered" check comes first so a double click never opens anything.
  await withTx(db, async (tx) => {
    const b = await ownedBrute(tx, userId, bruteId, true);
    await refuseIfEntered(tx, b.id, today);
    const old = (await tx.query<TournamentRow>(
      `select * from classic_tournaments where brute_id = $1 and day < $2 and rounds_opened < jsonb_array_length(rounds)
        order by day for update`, [b.id, today])).rows;
    for (const t of old) await openNext(tx, b, t, Infinity);
  });

  try {
    return await withTx(db, async (tx) => {
      const b = await ownedBrute(tx, userId, bruteId, true);
      await refuseIfEntered(tx, b.id, today);
      if (b.pending_level_up) throw conflict("Choose this brute's level-up before entering a tournament.", "level_up_pending");

      // later training, level-ups or a capsule rewind never change this tournament
      const snapshot: Snapshot = { seedId: b.seed_id, name: b.name, gfx: b.gfx, levelUps: b.level_ups, bits: b.bits };
      const size = bracketSize(b.rank_titles);
      const rounds = simulateBracket(snapshot, b.rank, size, (n) => randomInt(n));
      const champion = rounds[rounds.length - 1].result === "win";
      const row = (await tx.query<TournamentRow>(
        `insert into classic_tournaments (brute_id, day, rank, titles_before, size, snapshot, rounds, champion)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
        // stringified: pg would turn a JS array into a Postgres array, not JSON
        [b.id, today, b.rank, b.rank_titles, size, JSON.stringify(snapshot), JSON.stringify(rounds), champion])).rows[0];
      return { tournament: await view(tx, row) };
    });
  } catch (e) {
    // the brute lock already serialises entries; the unique key (brute_id, day) is the last line of defence
    if (isUniqueViolation(e, "classic_tournaments_brute_id_day_key")) throw alreadyEntered();
    throw e;
  }
}

/** Opens the next round, or all remaining ones with `{ all: true }`. Opening when everything is open changes nothing. */
export async function openRounds(db: Db, userId: string, bruteId: string, tid: string, body: unknown): Promise<{ fightIds: string[]; tournament: TournamentView }> {
  const all = (body as Record<string, unknown> | null)?.all === true;
  return withTx(db, async (tx) => {
    const b = await ownedBrute(tx, userId, bruteId, true);
    const t = await tournamentRow(tx, b.id, tid, true);
    const fightIds = await openNext(tx, b, t, all ? Infinity : 1);
    return { fightIds, tournament: await view(tx, t) };
  });
}

export async function getBruteTournament(db: Db, userId: string, bruteId: string, tid: string): Promise<{ tournament: TournamentView }> {
  const b = await ownedBrute(db, userId, bruteId);
  return { tournament: await view(db, await tournamentRow(db, b.id, tid)) };
}

export async function listBruteTournaments(db: Db, userId: string, bruteId: string, page: number) {
  const b = await ownedBrute(db, userId, bruteId);
  const p = Math.max(1, Math.floor(page) || 1);
  // only the round count leaves the database, never the stored rounds themselves
  const r = await db.query<{ id: string; day: string; rank: number; size: number; rounds_opened: number; champion: boolean; played: number; total: string }>(
    `select id, day, rank, size, rounds_opened, champion, jsonb_array_length(rounds) played, count(*) over () total
       from classic_tournaments where brute_id = $1 order by day desc, id desc limit $2 offset $3`,
    [b.id, LIST_PAGE, (p - 1) * LIST_PAGE]);
  const items: TournamentListItem[] = r.rows.map((t) => {
    const finished = t.rounds_opened === t.played;
    return {
      id: t.id, day: t.day, rank: t.rank, rankName: RANKS[t.rank].name, size: t.size, roundsOpened: t.rounds_opened, finished,
      placing: placingOf(finished, t.champion, t.size, t.played),
    };
  });
  return { total: Number(r.rows[0]?.total ?? 0), page: p, pageSize: LIST_PAGE, items };
}

/**
 * Time capsule: rewinds a brute that sits exactly at its cap to an earlier level. XP is kept (the bank), so the
 * brute usually climbs straight back and picks a new branch. Rank, titles, fights and unopened tournaments
 * (snapshotted at entry) are untouched.
 */
export async function useTimeCapsule(db: Db, userId: string, bruteId: string, body: unknown): Promise<{ ok: true; level: number }> {
  const target = (body as Record<string, unknown> | null)?.level;
  return withTx(db, async (tx) => {
    const b = await ownedBrute(tx, userId, bruteId, true);
    const cap = capFor(b.rank, b.admin_brute);
    const max = capsuleMaxTarget(displayLevel(b.level_ups), cap);
    if (max === null) throw conflict("The time capsule opens only when this brute is at its rank's level cap.", "capsule_unavailable");
    if (!Number.isInteger(target) || (target as number) < 1 || (target as number) > max) throw badRequest(`Pick a level from 1 to ${max}.`);

    const levelUps = (target as number) - 1; // the level-ups that stay
    const choices = hexToChoices(b.bits, b.level_ups).slice(0, levelUps);
    await tx.query("delete from level_ups where brute_id = $1 and idx >= $2", [b.id, levelUps]);
    await tx.query("update brutes set level_ups = $2, bits = $3, pending_level_up = $4 where id = $1",
      [b.id, levelUps, bitsToHex(choices, levelUps), isWaiting(b.xp, target as number, cap)]);
    // opponents found at the old level no longer match
    await tx.query("delete from opponent_offers where brute_id = $1 and consumed_at is null", [b.id]);
    return { ok: true, level: target as number };
  });
}
