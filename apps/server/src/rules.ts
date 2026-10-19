// Classic Mode rules. These are MyBrute++ additions on top of the original mechanics (the XP curve,
// daily limits, pending level-ups). Everything about what a brute IS comes from the original engine.

export type FightResult = "win" | "loss" | "draw";

/** XP needed to advance from a displayed level: requiredXP(level) = level * 2 (no cap). */
export function requiredXp(displayLevel: number): number {
  if (!Number.isInteger(displayLevel) || displayLevel < 1) throw new Error("level must be a whole number of 1 or more");
  return displayLevel * 2;
}

/** XP for a finished training fight. A draw (the arena's 1000-action limit) counts like a defeat. */
export function xpFor(result: FightResult): number {
  return result === "win" ? 2 : 1;
}

/** Reaching the requirement never levels up by itself: the brute waits for a level-up choice. */
export function isPending(xp: number, displayLevel: number): boolean {
  return xp >= requiredXp(displayLevel);
}

export const DAILY_TIME_ZONE = "Europe/Paris";

/** The Classic "day" (YYYY-MM-DD) in Bordeaux time; daily fights reset at local midnight. */
export function classicDay(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DAILY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Fights used today, given what's stored (a stored day other than today means none used yet). */
export function fightsUsedToday(storedDay: string | null, storedUsed: number, today = classicDay()): number {
  return storedDay === today ? storedUsed : 0;
}

export const NAME_RULES = { min: 2, max: 20, pattern: /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u } as const;
export const USERNAME_RULES = { min: 3, max: 24, pattern: /^[A-Za-z0-9_-]+$/ } as const;
export const PASSWORD_RULES = { min: 8, max: 200 } as const;

export function bruteNameProblem(name: unknown): string | null {
  if (typeof name !== "string") return "Give your brute a name.";
  const n = name.trim();
  if (n.length < NAME_RULES.min || n.length > NAME_RULES.max) return `Names are ${NAME_RULES.min} to ${NAME_RULES.max} characters.`;
  if (!NAME_RULES.pattern.test(n)) return "Use letters, numbers, spaces, - and _. Start with a letter or number.";
  return null;
}
