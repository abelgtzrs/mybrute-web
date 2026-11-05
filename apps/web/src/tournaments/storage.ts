import { useMemo } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import type { Tournament } from "./model";

export interface SavedTournament { key: string; label: string; tournament: Tournament; savedAt: string }
export interface TournamentStore {
  where: "account" | "browser";
  list(): Promise<SavedTournament[]>;
  save(label: string, tournament: Tournament, key?: string): Promise<SavedTournament>;
  delete(key: string): Promise<void>;
}

const KEY = "mybrute.tournaments.v1";
function read(): SavedTournament[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value as SavedTournament[] : [];
  } catch {
    return [];
  }
}
function write(items: SavedTournament[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); }
  catch { throw new Error("This browser won't let tournaments save (storage is full or blocked)."); }
}
const newKey = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const browserTournamentStore: TournamentStore = {
  where: "browser",
  list: async () => read(),
  async save(label, tournament, key) {
    const items = read();
    const item = { key: key ?? newKey(), label, tournament: structuredClone(tournament), savedAt: new Date().toISOString() };
    if (key && !items.some((old) => old.key === key)) throw new Error("That saved tournament no longer exists in this browser.");
    write(key ? items.map((old) => old.key === key ? item : old) : [item, ...items]);
    return item;
  },
  async delete(key) { write(read().filter((item) => item.key !== key)); },
};

export const accountTournamentStore: TournamentStore = {
  where: "account",
  list: async () => (await api.tournaments()).items,
  save: async (label, tournament, key) => (await api.saveTournament(label, tournament, key)).item,
  delete: async (key) => { await api.deleteTournament(key); },
};

export function useTournamentStore(): TournamentStore {
  const { user } = useAuth();
  return useMemo(() => user ? accountTournamentStore : browserTournamentStore, [user]);
}
