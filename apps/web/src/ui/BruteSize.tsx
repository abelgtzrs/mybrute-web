import { useSyncExternalStore, type CSSProperties } from "react";

/** How big the brute portraits are on the cell, the lab teams and the lab editor. */
export type BruteSize = "s" | "m" | "l";

const KEY = "mybrute.bruteSize";
const FACTOR: Record<BruteSize, number> = { s: 0.75, m: 1, l: 1.3 };
const LABEL: Record<BruteSize, string> = { s: "S", m: "M", l: "L" };
const TITLE: Record<BruteSize, string> = { s: "Small brutes", m: "Medium brutes", l: "Large brutes" };

const listeners = new Set<() => void>();

function readSaved(): BruteSize {
  try {
    const v = localStorage.getItem(KEY);
    return v === "s" || v === "l" ? v : "m";
  } catch {
    return "m"; // storage can be blocked; fall back to the default
  }
}

let current: BruteSize = readSaved();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function setBruteSize(size: BruteSize) {
  current = size;
  try {
    localStorage.setItem(KEY, size);
  } catch {
    // not saved: the choice lasts until the page is reloaded
  }
  listeners.forEach((cb) => cb());
}

/** Every page using this shares one size, so changing it anywhere updates the others. */
export function useBruteSize(): [BruteSize, (size: BruteSize) => void] {
  const size = useSyncExternalStore(subscribe, () => current);
  return [size, setBruteSize];
}

/** Put on a wrapper: the portrait CSS reads --portrait-scale from it. */
export function portraitScale(size: BruteSize): CSSProperties {
  return { "--portrait-scale": FACTOR[size] } as CSSProperties;
}

export function BruteSizeControl() {
  const [size, set] = useBruteSize();
  return (
    <div className="brute-size" role="group" aria-label="Brute size">
      {(["s", "m", "l"] as const).map((s) => (
        <button
          key={s}
          type="button"
          className="btn small"
          title={TITLE[s]}
          aria-label={TITLE[s]}
          aria-pressed={s === size}
          onClick={() => set(s)}
        >
          {LABEL[s]}
        </button>
      ))}
    </div>
  );
}
