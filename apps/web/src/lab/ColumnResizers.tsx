import { useEffect, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

/**
 * Drag handles between the workspace columns. Sizes live in CSS variables on the workspace (see .workspace in
 * styles.css), so the grid keeps working with its defaults until a handle is moved. Widths are remembered per browser.
 */
const KEY = "mybrute.lab.columns.v1";
const VARS = ["--w-teams", "--f-editor", "--f-arena"] as const;
const VALUE = /^\d+(\.\d+)?(px|fr)$/;
const MIN = { teams: 200, column: 260 };
const MAX = { teams: 520 };
const STEP = 16;

type Handle = "teams" | "split";
type Measure = { teams: number; editor: number; arena: number };
type Positions = Partial<Record<Handle, number>>;

const LABELS: Record<Handle, string> = {
  teams: "Resize the teams column",
  split: "Resize the editor and arena columns",
};
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

function column(ws: HTMLElement, name: string) {
  const el = ws.querySelector<HTMLElement>(`.col-${name}`);
  return el && el.offsetParent ? el : null; // hidden columns (narrow screens, expanded fight) have no offsetParent
}

function save(ws: HTMLElement) {
  const out: Record<string, string> = {};
  for (const v of VARS) {
    const value = ws.style.getPropertyValue(v);
    if (value) out[v] = value;
  }
  try {
    if (Object.keys(out).length) localStorage.setItem(KEY, JSON.stringify(out));
    else localStorage.removeItem(KEY);
  } catch {
    /* still applies for this visit */
  }
}

export function ColumnResizers({ workspace }: { workspace: RefObject<HTMLDivElement> }) {
  const [pos, setPos] = useState<Positions>({});
  const [gap, setGap] = useState(14);

  useEffect(() => {
    const ws = workspace.current;
    if (!ws) return;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
      for (const v of VARS) if (typeof saved[v] === "string" && VALUE.test(saved[v] as string)) ws.style.setProperty(v, saved[v] as string);
    } catch {
      /* ignore unreadable saved sizes */
    }
    const measure = () => {
      const t = column(ws, "teams");
      const e = column(ws, "editor");
      const a = column(ws, "arena");
      const box = ws.getBoundingClientRect();
      const next: Positions = {};
      if (t && (e || a)) next.teams = t.getBoundingClientRect().right - box.left;
      if (e && a) next.split = e.getBoundingClientRect().right - box.left;
      setGap(parseFloat(getComputedStyle(ws).columnGap) || 14);
      setPos((prev) => (["teams", "split"] as Handle[]).every((k) => prev[k] === next[k]) ? prev : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(ws);
    ws.querySelectorAll(".col").forEach((c) => observer.observe(c));
    measure();
    return () => observer.disconnect();
  }, [workspace]);

  const begin = (): Measure | null => {
    const ws = workspace.current;
    if (!ws) return null;
    const width = (n: string) => column(ws, n)?.getBoundingClientRect().width ?? 0;
    return { teams: width("teams"), editor: width("editor"), arena: width("arena") };
  };

  const apply = (handle: Handle, start: Measure, dx: number) => {
    const ws = workspace.current;
    if (!ws) return;
    if (handle === "teams") ws.style.setProperty("--w-teams", `${clamp(start.teams + dx, MIN.teams, MAX.teams)}px`);
    else {
      const total = start.editor + start.arena;
      const editor = clamp(start.editor + dx, MIN.column, total - MIN.column);
      ws.style.setProperty("--f-editor", `${editor}fr`);
      ws.style.setProperty("--f-arena", `${total - editor}fr`);
    }
  };

  const down = (handle: Handle) => (e: PointerEvent<HTMLDivElement>) => {
    const start = begin();
    const ws = workspace.current;
    if (!start || !ws) return;
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    target.classList.add("dragging");
    const x0 = e.clientX;
    const move = (m: globalThis.PointerEvent) => apply(handle, start, m.clientX - x0);
    const up = () => {
      target.classList.remove("dragging");
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      save(ws);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  const key = (handle: Handle) => (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    const start = begin();
    if (!dir || !start || !workspace.current) return;
    e.preventDefault();
    apply(handle, start, dir * STEP);
    save(workspace.current);
  };

  const reset = (handle: Handle) => {
    const ws = workspace.current;
    if (!ws) return;
    const vars = handle === "teams" ? ["--w-teams"] : ["--f-editor", "--f-arena"];
    vars.forEach((v) => ws.style.removeProperty(v));
    save(ws);
  };

  return (
    <>
      {(Object.keys(pos) as Handle[]).map((h) => (
        <div
          key={h}
          className="col-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={`${LABELS[h]}. Drag, or use the left and right arrow keys. Double-click to reset.`}
          tabIndex={0}
          style={{ left: pos[h], width: gap }}
          onPointerDown={down(h)}
          onKeyDown={key(h)}
          onDoubleClick={() => reset(h)}
        />
      ))}
    </>
  );
}
