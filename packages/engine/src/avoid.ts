// Laboratory helper: steer a brute's level-up choices away from chosen rewards.
// Uses only the original progression (GladAPI.describe). In Gladiator.nextLevel a reward
// (weapon, skill, super, pet, talent) is always option 0 and option 1 is always a stat boost,
// so "avoid this reward" means "take option 1 at that level-up". Taking option 1 reseeds the
// brute's RNG, which changes every later offer, so offers are re-read after each forced choice.
import { BONUSES } from "./generated/bonuses.js";
import { describe, normalizeChoices, type Choice } from "./progression";
import type { LevelOption } from "./vendor";

export type BonusKind = (typeof BONUSES)[number]["kind"];
export { BONUSES };

/** Stable key for a reward, e.g. "Weapons:AXE" */
export const bonusKey = (kind: string, id: string) => `${kind}:${id}`;

export function isAvoided(opt: LevelOption, avoid: ReadonlySet<string>): boolean {
  return opt.t === "b" && avoid.has(bonusKey(opt.kind, opt.id));
}

/**
 * Returns the choices with option 1 taken wherever an avoided reward is offered as option 0.
 * Other choices are kept as they are. `forced` lists the level-up indexes that were changed.
 */
export function applyAvoid(id: number, levelUps: number, choices: readonly number[], avoid: Iterable<string>): { choices: Choice[]; forced: number[] } {
  const set = new Set(avoid);
  const out = normalizeChoices(choices, levelUps);
  const forced: number[] = [];
  if (!set.size || !levelUps) return { choices: out, forced };
  let from = 0;
  for (;;) {
    // offers at level-up i depend only on choices before i, so one describe covers everything up to the next fix
    const levels = describe(id, levelUps, out).levels;
    let fixed = -1;
    for (let i = from; i < levelUps; i++) {
      if (out[i] === 0 && isAvoided(levels[i].opts[0], set)) { out[i] = 1; forced.push(i); fixed = i; break; }
    }
    if (fixed < 0) return { choices: out, forced };
    from = fixed + 1;
  }
}
