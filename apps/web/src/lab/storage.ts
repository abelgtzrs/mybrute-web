// Laboratory saves. Today: this browser's localStorage. Phase 4 adds a server-backed store for signed-in
// players behind the same interface (anonymous visitors keep using the local one).
import type { SpecBrute } from "@mybrute/engine";

export interface SavedPayload { key: string; label: string; params: string; savedAt: string }
export interface SavedBrute { key: string; label: string; brute: SpecBrute; savedAt: string }

export interface LabStore {
  listPayloads(): SavedPayload[];
  savePayload(label: string, params: string): SavedPayload;
  deletePayload(key: string): void;
  listBrutes(): SavedBrute[];
  saveBrute(label: string, brute: SpecBrute): SavedBrute;
  deleteBrute(key: string): void;
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

export const localLabStore: LabStore = {
  listPayloads: () => read<SavedPayload>(PAYLOADS),
  savePayload(label, params) {
    const item = { key: newKey(), label, params, savedAt: new Date().toISOString() };
    write(PAYLOADS, [item, ...read<SavedPayload>(PAYLOADS)]);
    return item;
  },
  deletePayload: (key) => write(PAYLOADS, read<SavedPayload>(PAYLOADS).filter((p) => p.key !== key)),
  listBrutes: () => read<SavedBrute>(BRUTES),
  saveBrute(label, brute) {
    const item = { key: newKey(), label, brute: structuredClone(brute), savedAt: new Date().toISOString() };
    write(BRUTES, [item, ...read<SavedBrute>(BRUTES)]);
    return item;
  },
  deleteBrute: (key) => write(BRUTES, read<SavedBrute>(BRUTES).filter((b) => b.key !== key)),
};
