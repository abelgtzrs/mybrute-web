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

/** Plays the whole bracket and returns only the rounds the brute fought (it stops at its first loss). */
export function simulateBracket(snapshot: Snapshot, rank: number, size: number, rand: (n: number) => number): BracketRound[] {
  let slots: Snapshot[] = makeNpcs(snapshot, rank, size - 1, rand);
  slots.splice(rand(size), 0, snapshot);
  const rounds: BracketRound[] = [];

  while (slots.length > 1) {
    const next: Snapshot[] = [];
    for (let i = 0; i < slots.length; i += 2) {
      const [left, right] = [slots[i], slots[i + 1]];
      const isPlayer = left === snapshot || right === snapshot;
      // the brute is always team 0; between two NPCs the left slot is team 0
      const [a, b] = right === snapshot ? [right, left] : [left, right];
      const { spec, win, events, stats } = decideFight({
        seed: rand(SEED_LIMIT), arena: ARENA, lang: "en", p0: null, p1: null,
        brutes: [fighter(a, 0), fighter(b, 1)],
      });
      next.push(win === 0 ? a : b);
      if (isPlayer) {
        rounds.push({
          opponent: b, spec, result: win === 0 ? "win" : "loss", events,
          playerStats: stats.get(a.seedId)!, opponentStats: stats.get(b.seedId)!,
        });
        if (win === 1) return rounds;
      }
    }
    slots = next;
  }
  return rounds;
}
