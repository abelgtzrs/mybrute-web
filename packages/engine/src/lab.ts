// Helpers for unrestricted Laboratory experiments. Classic Mode does not use these.
import { randomGfx } from "./gfx";
import type { Choice } from "./progression";
import type { FightSpec, SpecBrute } from "./payload";

const rand = (n: number) => Math.floor(Math.random() * n);

/** Same range as the original lab's "rand id" button. */
export function randomLabId(taken: Iterable<number> = []): number {
  const used = new Set(taken);
  let id: number;
  do id = 10_000_000 + rand(90_000_000); while (used.has(id));
  return id;
}

export const randomChoices = (n: number): Choice[] => Array.from({ length: n }, () => (rand(2) as Choice));
export const randomSeed = () => rand(2 ** 30);

export function newLabBrute(team: 0 | 1, opts: Partial<SpecBrute> & { takenIds?: number[]; randomBits?: boolean } = {}): SpecBrute {
  const levelUps = opts.levelUps ?? 9;
  const id = opts.id ?? randomLabId(opts.takenIds);
  return {
    name: opts.name ?? String(id),
    id,
    team,
    levelUps,
    gfx: opts.gfx ?? randomGfx(),
    choices: opts.choices ?? (opts.randomBits === false ? Array(levelUps).fill(0) : randomChoices(levelUps)),
  };
}

/** A fresh 1v1 fight that doesn't need a template payload. */
export function newLabFight(): FightSpec {
  const a = newLabBrute(0);
  const b = newLabBrute(1, { takenIds: [a.id] });
  return { seed: randomSeed(), arena: 2, brutes: [a, b], p0: null, p1: null, lang: "en" };
}
