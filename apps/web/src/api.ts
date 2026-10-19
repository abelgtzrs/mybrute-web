// Typed client for the MyBrute++ server. The server is authoritative; nothing here decides game outcomes.
import type { FighterStats, FightSpec, LevelOption, SpecBrute } from "@mybrute/engine";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function request<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
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

export interface User { id: string; username: string; bruteCount?: number; maxBrutes?: number }
export interface Attributes { strength: number; agility: number; speed: number; life: number }
export interface Kit { weapons: string[]; supers: string[]; followers: string[]; perms: string[]; talents: string[] }
export type FightResult = "win" | "loss" | "draw";
export interface BruteSummary {
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
  brute: BruteSummary; bits: string; attributes: Attributes; kit: Kit; check: boolean;
  pendingOptions: [LevelOption, LevelOption] | null; lifetime: Record<string, number>;
  recentFights: FightListItem[]; levelUps: LevelUpRecord[];
}
export interface Opponent { offerId: string; name: string; seedId: number; level: number; gfx: string; attributes: Attributes; kit: Kit }
export interface FightDetail {
  id: string; createdAt: string; result: FightResult; events: number; xpAwarded: number; level: number;
  xpAfter: number; xpRequired: number; pendingAfter: boolean; spec: FightSpec;
  playerStats: FighterStats; opponentStats: FighterStats;
  player: { name: string; seedId: number; gfx: string; level: number };
  opponent: { name: string; seedId: number; gfx: string; level: number };
}

export const api = {
  me: () => request<{ user: User | null }>("GET", "/api/auth/me"),
  register: (username: string, password: string) => request<{ user: User }>("POST", "/api/auth/register", { username, password }),
  login: (username: string, password: string) => request<{ user: User }>("POST", "/api/auth/login", { username, password }),
  logout: () => request<{ ok: true }>("POST", "/api/auth/logout"),

  brutes: () => request<{ brutes: BruteSummary[]; maxBrutes: number }>("GET", "/api/brutes"),
  createBrute: (b: { name: string; seedId: number; gfx: string }) => request<{ brute: BruteSummary }>("POST", "/api/brutes", b),
  cell: (id: string) => request<Cell>("GET", `/api/brutes/${id}`),
  deleteBrute: (id: string) => request<{ ok: true }>("DELETE", `/api/brutes/${id}`),
  opponents: (id: string) => request<{ opponents: Opponent[] }>("POST", `/api/brutes/${id}/opponents`),
  fight: (id: string, offerId: string) => request<{ fightId: string; repeated: boolean }>("POST", `/api/brutes/${id}/fights`, { offerId }),
  history: (id: string, page: number, result?: string) =>
    request<{ total: number; page: number; pageSize: number; fights: FightListItem[] }>("GET", `/api/brutes/${id}/fights?page=${page}${result ? `&result=${result}` : ""}`),
  levelUp: (id: string, index: number, choice: 0 | 1) => request<{ ok: true; level: number }>("POST", `/api/brutes/${id}/level-up`, { index, choice }),
  getFight: (fightId: string) => request<{ fight: FightDetail; brute: BruteSummary }>("GET", `/api/fights/${fightId}`),

  labPayloads: () => request<{ items: { key: string; label: string; params: string; savedAt: string }[] }>("GET", "/api/lab/payloads"),
  saveLabPayload: (label: string, params: string) => request<{ item: { key: string; label: string; params: string; savedAt: string } }>("POST", "/api/lab/payloads", { label, params }),
  deleteLabPayload: (key: string) => request<{ ok: true }>("DELETE", `/api/lab/payloads/${key}`),
  labBrutes: () => request<{ items: { key: string; label: string; brute: SpecBrute; savedAt: string }[] }>("GET", "/api/lab/brutes"),
  saveLabBrute: (label: string, brute: SpecBrute) => request<{ item: { key: string; label: string; brute: SpecBrute; savedAt: string } }>("POST", "/api/lab/brutes", { label, brute }),
  deleteLabBrute: (key: string) => request<{ ok: true }>("DELETE", `/api/lab/brutes/${key}`),
};
