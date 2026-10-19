// Laboratory saves: on the server for signed-in players, in this browser for everyone else.
// Lab saves never touch Classic brutes.
import { useMemo } from "react";
import type { SpecBrute } from "@mybrute/engine";
import { api } from "../api";
import { useAuth } from "../auth";

export interface SavedPayload { key: string; label: string; params: string; savedAt: string }
export interface SavedBrute { key: string; label: string; brute: SpecBrute; savedAt: string }

export interface LabStore {
  /** where saves go, for messages */
  where: "account" | "browser";
  listPayloads(): Promise<SavedPayload[]>;
  savePayload(label: string, params: string): Promise<SavedPayload>;
  deletePayload(key: string): Promise<void>;
  listBrutes(): Promise<SavedBrute[]>;
  saveBrute(label: string, brute: SpecBrute): Promise<SavedBrute>;
  deleteBrute(key: string): Promise<void>;
}

const PAYLOADS = "mybrute.lab.payloads.v1";
const BRUTES = "mybrute.lab.brutes.v1";

function read<T>(k: string): T[] {
  try { const v = JSON.parse(localStorage.getItem(k) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function write<T>(k: string, v: T[]): void {
  try { localStorage.setItem(k, JSON.stringify(v)); }
  catch { throw new Error("This browser won't let the Lab save (storage is full or blocked)."); }
}
const newKey = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const browserLabStore: LabStore = {
  where: "browser",
  listPayloads: async () => read<SavedPayload>(PAYLOADS),
  async savePayload(label, params) {
    const item = { key: newKey(), label, params, savedAt: new Date().toISOString() };
    write(PAYLOADS, [item, ...read<SavedPayload>(PAYLOADS)]);
    return item;
  },
  deletePayload: async (key) => write(PAYLOADS, read<SavedPayload>(PAYLOADS).filter((p) => p.key !== key)),
  listBrutes: async () => read<SavedBrute>(BRUTES),
  async saveBrute(label, brute) {
    const item = { key: newKey(), label, brute: structuredClone(brute), savedAt: new Date().toISOString() };
    write(BRUTES, [item, ...read<SavedBrute>(BRUTES)]);
    return item;
  },
  deleteBrute: async (key) => write(BRUTES, read<SavedBrute>(BRUTES).filter((b) => b.key !== key)),
};

export const accountLabStore: LabStore = {
  where: "account",
  listPayloads: async () => (await api.labPayloads()).items,
  savePayload: async (label, params) => (await api.saveLabPayload(label, params)).item,
  deletePayload: async (key) => { await api.deleteLabPayload(key); },
  listBrutes: async () => (await api.labBrutes()).items,
  saveBrute: async (label, brute) => (await api.saveLabBrute(label, brute)).item,
  deleteBrute: async (key) => { await api.deleteLabBrute(key); },
};

/** The store for whoever is using the Lab right now. */
export function useLabStore(): LabStore {
  const { user } = useAuth();
  return useMemo(() => (user ? accountLabStore : browserLabStore), [user]);
}
