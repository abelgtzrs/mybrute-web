// Adapters around the original Gladiator progression (glad.js). No progression logic lives here:
// every reward, stat and option comes from GladAPI.describe, which replays Gladiator.nextLevel / setLevels.
//
// Conventions (verified against glad.js and confirmed by the project owner):
//  - "levelUps" n is the original engine's lvl: the number of level-ups taken. Displayed level = n + 1.
//  - choice i (0 or 1) is the option picked at level-up i, the one that reaches displayed level i + 2.
//  - Packed bits: byte i >> 3, bit i & 7, least significant bit first (Gladiator.setLevels).
//  - Choosing option 1 also perturbs the brute's RNG (mt_Rand.addSeed), so it changes every LATER option.
//    Options offered at level-up i depend only on choices 0..i-1.
import { GladAPI, Gladiator, LaBrute, type Description, type LevelOption } from "./vendor";
import { BONUSES } from "./generated/bonuses.js";

export type Choice = 0 | 1;

export const MAX_LAB_LEVEL = 5000;
export const MIN_SEED_ID = 1;
/** Payload integers go through the Haxe serializer as Flash signed 32-bit ints. */
export const MAX_SEED_ID = 2 ** 31 - 1;

export const displayLevel = (levelUps: number) => levelUps + 1;
export const levelUpsFor = (displayed: number) => Math.max(0, displayed - 1);

export function isValidSeedId(id: unknown): id is number {
  return Number.isInteger(id) && (id as number) >= MIN_SEED_ID && (id as number) <= MAX_SEED_ID;
}

/** Choices normalised to exactly n entries of 0/1 (missing ones are 0, as in Gladiator.setLevels). */
export function normalizeChoices(choices: readonly number[], n: number): Choice[] {
  return Array.from({ length: n }, (_, i) => (choices[i] === 1 ? 1 : 0));
}

export function describe(id: number, levelUps: number, choices: readonly number[]): Description {
  return GladAPI.describe(id, levelUps, normalizeChoices(choices, levelUps));
}

/**
 * What the seed decided before any level-up (Gladiator.initDestiny): the rare idle stance (null for almost every brute,
 * else 0 or 1) and the rewards whose weight it set to 0, which the brute can never be offered.
 */
export function destiny(id: number): { stance: number | null; banned: (typeof BONUSES)[number][] } {
  const g = new Gladiator(id, "x");
  return { stance: g.stanceId ?? null, banned: BONUSES.filter((_, i) => g.bonusWeight[i].w === 0) };
}

/** The valid id closest to `from` (ties go up) whose destiny has `stance`, skipping `taken`; null if none within `range`. */
export function nearestIdWithStance(from: number, stance: number | null, taken: readonly number[] = [], range = 1_000_000): number | null {
  for (let d = 0; d <= range; d++) {
    for (const id of d ? [from + d, from - d] : [from]) {
      if (isValidSeedId(id) && !taken.includes(id) && destiny(id).stance === stance) return id;
    }
  }
  return null;
}

/** The two authentic options for the NEXT level-up of a brute that has taken `levelUps` level-ups. */
export function pendingOptions(id: number, levelUps: number, choices: readonly number[]): [LevelOption, LevelOption] {
  const d = GladAPI.describe(id, levelUps + 1, [...normalizeChoices(choices, levelUps), 0]);
  return d.levels[levelUps].opts;
}

export function bitsToHex(choices: readonly number[], n: number): string {
  return LaBrute.choicesToBytes(normalizeChoices(choices, n), n).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToChoices(hex: string, n: number): Choice[] {
  const bytes = (hex.replace(/[^0-9a-fA-F]/g, "").match(/../g) ?? []).map((x) => parseInt(x, 16));
  return normalizeChoices(LaBrute.bytesToChoices(bytes, n), n);
}

export function bitsToB64(choices: readonly number[], n: number): string {
  return LaBrute.b64enc(LaBrute.choicesToBytes(normalizeChoices(choices, n), n));
}

export const CARAC_NAMES = ["Strength", "Agility", "Speed", "Life"] as const;
export type { Description, LevelOption };
