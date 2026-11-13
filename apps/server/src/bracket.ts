// Pure single-elimination bracket: no database, so it is easy to test. The caller supplies the randomness.
import {
  bitsToHex, extractStats, hexToChoices, randomGfx, runFight,
  type Choice, type FighterStats, type FightSpec,
} from "@mybrute/engine";
import { RANKS } from "./rules";

export interface Snapshot { seedId: number; name: string; gfx: string; levelUps: number; bits: string }
export interface Npc { seedId: number; name: string; gfx: string; levelUps: number; bits: string }
export interface BracketRound {
  opponent: Npc; spec: FightSpec; result: "win" | "loss"; events: number;
  playerStats: FighterStats; opponentStats: FighterStats;
}

const ARENA = 2; // the arena every historical payload uses
const SEED_LIMIT = 2 ** 30;
const MAX_TRIES = 20;

/** Runs a fight until someone wins. A draw is rerun with the next seed, up to 20 tries in total. */
export function decideFight(spec: FightSpec): { spec: FightSpec; win: 0 | 1; events: number; stats: Map<number, FighterStats> } {
  for (let i = 0; i < MAX_TRIES; i++) {
    const tried = { ...spec, seed: (spec.seed + i) % SEED_LIMIT };
    const r = runFight(tried);
    if (r.win !== null) return { spec: tried, win: r.win, events: r.history.length, stats: extractStats(r) };
  }
  // all 20 drew: the original seed's parity picks the winner, and the original spec is kept
  const r = runFight(spec);
  return { spec, win: (spec.seed & 1) as 0 | 1, events: r.history.length, stats: extractStats(r) };
}

/** Makes size - 1 NPCs for the given rank: unique ids (never the brute's), level inside the rank's NPC range. */
function makeNpcs(snapshot: Snapshot, rank: number, count: number, rand: (n: number) => number): Npc[] {
  const { npcMin, npcMax } = RANKS[rank];
  const used = new Set([snapshot.seedId]);
  return Array.from({ length: count }, () => {
    let seedId: number;
    do seedId = 1 + rand(2147483647); while (used.has(seedId));
    used.add(seedId);
    const levelUps = npcMin + rand(npcMax - npcMin + 1) - 1; // display level = levelUps + 1
    const choices = Array.from({ length: levelUps }, () => rand(2) as Choice);
    return { seedId, name: String(seedId), gfx: randomGfx(rand), levelUps, bits: bitsToHex(choices, levelUps) };
  });
}

const fighter = (e: Snapshot, team: 0 | 1) =>
  ({ name: e.name, id: e.seedId, team, levelUps: e.levelUps, gfx: e.gfx, choices: hexToChoices(e.bits, e.levelUps) });

/** What the page needs to draw a slot (no fight bits). */
export interface Entrant { seedId: number; name: string; gfx: string; levelUps: number }

/**
 * Plays the whole bracket to a champion, even after the brute is knocked out.
 * `rounds` holds only the brute's own fights (with full specs). `winners[r]` lists the winning slot of each match
 * in round r, so the page can draw the bracket without any fight data.
 */
export function simulateBracket(snapshot: Snapshot, rank: number, size: number, rand: (n: number) => number):
  { rounds: BracketRound[]; entrants: Entrant[]; bruteSlot: number; winners: number[][] } {
  const slots: Snapshot[] = makeNpcs(snapshot, rank, size - 1, rand);
  const bruteSlot = rand(size);
  slots.splice(bruteSlot, 0, snapshot);
  const rounds: BracketRound[] = [];
  const winners: number[][] = [];
  let alive = slots.map((_, i) => i); // slot numbers still in the bracket
  let bruteOut = false;

  while (alive.length > 1) {
    const next: number[] = [];
    for (let i = 0; i < alive.length; i += 2) {
      // the brute is always team 0; between two NPCs the left slot is team 0
      const [ia, ib] = alive[i + 1] === bruteSlot ? [alive[i + 1], alive[i]] : [alive[i], alive[i + 1]];
      const [a, b] = [slots[ia], slots[ib]];
      const { spec, win, events, stats } = decideFight({
        seed: rand(SEED_LIMIT), arena: ARENA, lang: "en", p0: null, p1: null,
        brutes: [fighter(a, 0), fighter(b, 1)],
      });
      next.push(win === 0 ? ia : ib);
      if (ia === bruteSlot && !bruteOut) {
        rounds.push({
          opponent: b, spec, result: win === 0 ? "win" : "loss", events,
          playerStats: stats.get(a.seedId)!, opponentStats: stats.get(b.seedId)!,
        });
        if (win === 1) bruteOut = true;
      }
    }
    // winners are listed in match order, which is the order the matches were played
    winners.push(next);
    alive = next;
  }
  const entrants = slots.map(({ seedId, name, gfx, levelUps }) => ({ seedId, name, gfx, levelUps }));
  return { rounds, entrants, bruteSlot, winners };
}
