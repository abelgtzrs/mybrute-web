// Typed client for the MyBrute++ server. The server is authoritative; nothing here decides game outcomes.
import type { FighterStats, FightSpec, LevelOption, SpecBrute } from "@mybrute/engine";
import type { Tournament } from "./tournaments/model";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

/** Builds a query string, leaving out empty values. */
const qs = (q: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

async function request<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(method !== "GET" ? { "x-mybrute": "1" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "offline", "Couldn't reach the server. Check your connection and try again.");
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "error", data?.message ?? `The server answered ${res.status}.`);
  return data as T;
}

export type Role = "player" | "admin";
export interface User { id: string; username: string; role: Role; bruteCount?: number; maxBrutes?: number }
export interface Attributes { strength: number; agility: number; speed: number; life: number }
export interface Kit { weapons: string[]; supers: string[]; followers: string[]; perms: string[]; talents: string[] }
export type FightResult = "win" | "loss" | "draw";
/** Where a brute stands in the ranked ladder. cap is null for admin brutes (no limit). */
export interface RankInfo { rank: number; name: string; titles: number; titlesNeeded: number | null; cap: number | null; bracketSize: number }
export interface BruteSummary {
  adminBrute: boolean; rank: RankInfo; banked: boolean; // banked: at the level cap, so new XP is only stored
  id: string; name: string; seedId: number; gfx: string; level: number; levelUps: number;
  xp: number; xpRequired: number; pendingLevelUp: boolean; fightsLeft: number; dailyFights: number;
  record: { fights: number; wins: number; losses: number; draws: number }; createdAt: string; attributes?: Attributes;
}
export interface FightListItem {
  id: string; createdAt: string; result: FightResult; xpAwarded: number; level: number;
  opponent: { name: string; level: number; gfx: string }; damageDealt: number; damageReceived: number;
}
export interface LevelUpRecord { index: number; level: number; choice: 0 | 1; chosen: LevelOption; other: LevelOption; at: string }
export interface Cell {
  brute: BruteSummary; canChangeAppearance: boolean; bits: string; attributes: Attributes; kit: Kit; check: boolean;
  pendingOptions: [LevelOption, LevelOption] | null; lifetime: Record<string, number>;
  recentFights: FightListItem[]; levelUps: LevelUpRecord[];
  todayTournamentId: string | null; // set once the brute has entered today's tournament
  capsule: { maxTarget: number } | null; // set only while the time capsule is usable
}
export interface Opponent { offerId: string; name: string; seedId: number; level: number; levelUps: number; choices: number[]; gfx: string; attributes: Attributes; kit: Kit }
export interface FightDetail {
  id: string; createdAt: string; result: FightResult; events: number; xpAwarded: number; level: number;
  xpAfter: number; xpRequired: number; pendingAfter: boolean; spec: FightSpec;
  playerStats: FighterStats; opponentStats: FighterStats;
  player: { name: string; seedId: number; gfx: string; level: number };
  opponent: { name: string; seedId: number; gfx: string; level: number };
  tournament: { id: string; round: number; totalRounds: number } | null;
}
type TournamentOpponent = { name: string; level: number; gfx: string };
export interface TournamentView {
  id: string; day: string; rank: number; rankName: string; size: number; totalRounds: number; roundsOpened: number;
  finished: boolean; champion: boolean | null; placing: string | null; next: { opponent: TournamentOpponent } | null;
  rounds: { round: number; fightId: string; result: "win" | "loss"; opponent: TournamentOpponent }[];
  /** Every entrant in slot order; winners[r] (match order) exists only for revealed rounds. Null on old tournaments. */
  bracket: { entrants: (TournamentOpponent & { isBrute: boolean })[]; winners: number[][] } | null;
}
export interface TournamentListItem {
  id: string; day: string; rank: number; rankName: string; size: number; roundsOpened: number; finished: boolean; placing: string | null;
}

export const api = {
  me: () => request<{ user: User | null }>("GET", "/api/auth/me"),
  register: (username: string, password: string) => request<{ user: User }>("POST", "/api/auth/register", { username, password }),
  login: (username: string, password: string) => request<{ user: User }>("POST", "/api/auth/login", { username, password }),
  logout: () => request<{ ok: true }>("POST", "/api/auth/logout"),

  brutes: () => request<{ brutes: BruteSummary[]; maxBrutes: number; maxImportLevel: number }>("GET", "/api/brutes"),
  createBrute: (b: { name: string; seedId: number; gfx: string; levelUps?: number; choices?: number[] }) => request<{ brute: BruteSummary }>("POST", "/api/brutes", b),
  cell: (id: string) => request<Cell>("GET", `/api/brutes/${id}`),
  changeAppearance: (id: string, gfx: string) => request<{ ok: true; gfx: string }>("PUT", `/api/brutes/${id}/appearance`, { gfx }),
  deleteBrute: (id: string) => request<{ ok: true }>("DELETE", `/api/brutes/${id}`),
  opponents: (id: string) => request<{ opponents: Opponent[] }>("POST", `/api/brutes/${id}/opponents`),
  fight: (id: string, offerId: string) => request<{ fightId: string; repeated: boolean }>("POST", `/api/brutes/${id}/fights`, { offerId }),
  history: (id: string, page: number, result?: string) =>
    request<{ total: number; page: number; pageSize: number; fights: FightListItem[] }>("GET", `/api/brutes/${id}/fights?page=${page}${result ? `&result=${result}` : ""}`),
  levelUp: (id: string, index: number, choice: 0 | 1) => request<{ ok: true; level: number }>("POST", `/api/brutes/${id}/level-up`, { index, choice }),
  // "brute" prefix: the admin Lab already has api.tournaments
  enterTournament: (id: string) => request<{ tournament: TournamentView }>("POST", `/api/brutes/${id}/tournament`),
  bruteTournament: (id: string, tid: string) => request<{ tournament: TournamentView }>("GET", `/api/brutes/${id}/tournaments/${tid}`),
  bruteTournaments: (id: string, page: number) =>
    request<Paged & { items: TournamentListItem[] }>("GET", `/api/brutes/${id}/tournaments?page=${page}`),
  // round: 1-based number of the round to open; asking for one that is already open just returns its fight
  openRounds: (id: string, tid: string, body: { all: true } | { round: number }) =>
    request<{ fightIds: string[]; tournament: TournamentView }>("POST", `/api/brutes/${id}/tournaments/${tid}/open`, body),
  timeCapsule: (id: string, level: number) => request<{ ok: true; level: number }>("POST", `/api/brutes/${id}/time-capsule`, { level }),
  getFight: (fightId: string) => request<{ fight: FightDetail; brute: BruteSummary }>("GET", `/api/fights/${fightId}`),

  labPayloads: () => request<{ items: { key: string; label: string; params: string; savedAt: string }[] }>("GET", "/api/lab/payloads"),
  saveLabPayload: (label: string, params: string) => request<{ item: { key: string; label: string; params: string; savedAt: string } }>("POST", "/api/lab/payloads", { label, params }),
  deleteLabPayload: (key: string) => request<{ ok: true }>("DELETE", `/api/lab/payloads/${key}`),
  labBrutes: () => request<{ items: { key: string; label: string; brute: SpecBrute; savedAt: string }[] }>("GET", "/api/lab/brutes"),
  saveLabBrute: (label: string, brute: SpecBrute) => request<{ item: { key: string; label: string; brute: SpecBrute; savedAt: string } }>("POST", "/api/lab/brutes", { label, brute }),
  deleteLabBrute: (key: string) => request<{ ok: true }>("DELETE", `/api/lab/brutes/${key}`),
  tournaments: () => request<{ items: { key: string; label: string; tournament: Tournament; savedAt: string }[] }>("GET", "/api/tournaments"),
  saveTournament: (label: string, tournament: Tournament, key?: string) =>
    request<{ item: { key: string; label: string; tournament: Tournament; savedAt: string } }>("POST", key ? `/api/tournaments/${key}` : "/api/tournaments", { label, tournament }),
  deleteTournament: (key: string) => request<{ ok: true }>("DELETE", `/api/tournaments/${key}`),
};

// ---------------------------------------------------------------- admin

export interface Paged { total: number; page: number; pageSize: number }
export interface Settings { maxBrutesDefault: number; dailyFights: number; maxImportLevel: number }
export interface LogEntry {
  id: string; at: string; admin: { id: string | null; username: string }; action: string;
  target: { kind: "user" | "brute" | "settings"; id: string | null; label: string }; detail: Record<string, unknown>;
}
export interface AdminUser {
  id: string; username: string; role: Role; maxBrutes: number | null; createdAt: string; lastLoginAt: string | null;
  suspended: { at: string; reason: string | null } | null; brutes: number; fights: number;
}
export interface AdminUserDetail extends AdminUser { sessions: number; labPayloads: number; labBrutes: number; effectiveMaxBrutes: number }
export interface AdminBrute {
  id: string; name: string; seedId: number; gfx: string; level: number; xp: number; xpRequired: number; pendingLevelUp: boolean;
  fightsLeft: number; fights: number; createdAt: string; owner: { id: string; username: string };
}
export interface AdminFight {
  id: string; createdAt: string; result: FightResult; xpAwarded: number; events: number; level: number;
  brute: { id: string; name: string }; owner: { id: string; username: string };
  opponent: { name: string; level: number }; damageDealt: number; damageReceived: number;
}
export interface Overview {
  counts: Record<"users" | "admins" | "suspended" | "newUsers" | "brutes" | "pendingLevelUps" | "fights" | "fightsToday" | "levelUps" | "sessions", number>;
  resultsToday: Record<FightResult, number>;
  topBrutes: { id: string; name: string; gfx: string; level: number; xp: number; owner: { id: string; username: string } }[];
  settings: Settings; recentLog: LogEntry[]; day: string;
}
type Ok = { ok: true; changed?: boolean };

export const admin = {
  overview: () => request<Overview>("GET", "/api/admin/overview"),

  users: (q: { q?: string; filter?: string; page?: number }) => request<Paged & { users: AdminUser[] }>("GET", `/api/admin/users${qs(q)}`),
  user: (id: string) => request<{ user: AdminUserDetail; brutes: BruteSummary[]; log: LogEntry[] }>("GET", `/api/admin/users/${id}`),
  setRole: (id: string, role: Role) => request<Ok>("POST", `/api/admin/users/${id}/role`, { role }),
  suspend: (id: string, reason: string) => request<Ok>("POST", `/api/admin/users/${id}/suspend`, { reason }),
  unsuspend: (id: string) => request<Ok>("POST", `/api/admin/users/${id}/unsuspend`),
  setLimit: (id: string, maxBrutes: number | null) => request<Ok>("POST", `/api/admin/users/${id}/limit`, { maxBrutes }),
  resetPassword: (id: string, password: string) => request<Ok>("POST", `/api/admin/users/${id}/password`, { password }),
  signOut: (id: string) => request<Ok & { sessionsEnded: number }>("POST", `/api/admin/users/${id}/sign-out`),
  deleteUser: (id: string) => request<Ok>("DELETE", `/api/admin/users/${id}`),

  brutes: (q: { q?: string; filter?: string; sort?: string; owner?: string; page?: number }) =>
    request<Paged & { brutes: AdminBrute[] }>("GET", `/api/admin/brutes${qs(q)}`),
  brute: (id: string) => request<Cell & { owner: { id: string; username: string }; log: LogEntry[] }>("GET", `/api/admin/brutes/${id}`),
  setXp: (id: string, xp: number) => request<Ok & { pendingLevelUp: boolean }>("POST", `/api/admin/brutes/${id}/xp`, { xp }),
  resetFights: (id: string) => request<Ok>("POST", `/api/admin/brutes/${id}/reset-fights`),
  rename: (id: string, name: string) => request<Ok>("POST", `/api/admin/brutes/${id}/rename`, { name }),
  transfer: (id: string, username: string) => request<Ok>("POST", `/api/admin/brutes/${id}/transfer`, { username }),
  undoLevelUp: (id: string) => request<Ok>("POST", `/api/admin/brutes/${id}/undo-level-up`),
  deleteBrute: (id: string) => request<Ok>("DELETE", `/api/admin/brutes/${id}`),

  fights: (q: { q?: string; result?: string; brute?: string; page?: number }) => request<Paged & { fights: AdminFight[] }>("GET", `/api/admin/fights${qs(q)}`),
  fight: (id: string) => request<{ fight: FightDetail; brute: BruteSummary; owner: { id: string; username: string } }>("GET", `/api/admin/fights/${id}`),

  settings: () => request<{ settings: Settings; limits: { maxBrutes: number; dailyFights: number; importLevel: number; xp: number; reason: number } }>("GET", "/api/admin/settings"),
  saveSettings: (s: Partial<Settings>) => request<{ settings: Settings }>("POST", "/api/admin/settings", s),

  log: (q: { page?: number; kind?: string }) => request<Paged & { entries: LogEntry[] }>("GET", `/api/admin/log${qs(q)}`),
};
