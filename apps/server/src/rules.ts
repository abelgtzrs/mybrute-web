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

export interface Rank {
  name: string;
  npcMin: number; // NPC level range a brute of this rank fights
  npcMax: number;
  cap: number; // highest display level a non-admin brute can reach at this rank
  titlesNeeded: number | null; // null on the top rank
}

// The 12 ranks, in order. Index = rank number stored on the brute.
export const RANKS: readonly Rank[] = [
  { name: "Padawan", npcMin: 10, npcMax: 15, cap: 20, titlesNeeded: 3 },
  { name: "Finger Flicker", npcMin: 15, npcMax: 25, cap: 30, titlesNeeded: 3 },
  { name: "Plaster Puller", npcMin: 25, npcMax: 35, cap: 40, titlesNeeded: 3 },
  { name: "Cheeky Slapper", npcMin: 35, npcMax: 50, cap: 55, titlesNeeded: 3 },
  { name: "Fist of Steel", npcMin: 45, npcMax: 65, cap: 75, titlesNeeded: 4 },
  { name: "Blazing Avenger", npcMin: 60, npcMax: 80, cap: 90, titlesNeeded: 4 },
  { name: "Furious Soul", npcMin: 75, npcMax: 100, cap: 110, titlesNeeded: 4 },
  { name: "Haemogoblin", npcMin: 90, npcMax: 120, cap: 130, titlesNeeded: 4 },
  { name: "Sword Swallower", npcMin: 100, npcMax: 135, cap: 155, titlesNeeded: 5 },
  { name: "Satan's Bicep", npcMin: 115, npcMax: 150, cap: 170, titlesNeeded: 5 },
  { name: "Chaos Dentist", npcMin: 130, npcMax: 170, cap: 190, titlesNeeded: 5 },
  { name: "Brutal Legend", npcMin: 150, npcMax: 200, cap: 220, titlesNeeded: null },
];

export const TOP_RANK = 11;

/** Player level cap for a rank. Admin brutes have no cap (Infinity). */
export function capFor(rank: number, adminBrute: boolean): number {
  if (adminBrute) return Infinity;
  return RANKS[rank].cap;
}

/** Tournament bracket size: doubles with every title (16, 32, ...), but never above 256. */
export function bracketSize(rankTitles: number): number {
  return Math.min(256, 16 * 2 ** rankTitles);
}

/** XP paid for a title: 5, 10, 15, 20, then 25 for every title after that. */
export function titleXp(titlesBefore: number): number {
  return Math.min(5 * (titlesBefore + 1), 25);
}

/** A level-up waits only while the brute is under its cap and has enough XP. Above the cap, XP is just banked. */
export function isWaiting(xp: number, displayLevel: number, cap: number): boolean {
  return displayLevel < cap && xp >= requiredXp(displayLevel);
}

/** Everything the app shows about a brute's rank. cap is null for admin brutes (no limit). */
export function rankInfo(rank: number, rankTitles: number, adminBrute: boolean): {
  rank: number;
  name: string;
  titles: number;
  titlesNeeded: number | null;
  cap: number | null;
  bracketSize: number;
} {
  const row = RANKS[rank];
  return {
    rank,
    name: row.name,
    titles: rankTitles,
    titlesNeeded: row.titlesNeeded,
    cap: adminBrute ? null : row.cap,
    bracketSize: bracketSize(rankTitles),
  };
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
