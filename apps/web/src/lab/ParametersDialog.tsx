import { useRef, useState } from "react";
import {
  INVENTORY_LANGS,
  MAX_LAB_LEVEL,
  bitsToHex,
  destiny,
  hexToChoices,
  isValidSeedId,
  newLabBrute,
  type Description,
  type FightSpec,
  type TeamProps,
} from "@mybrute/engine";
import { CommitInput, parseIntStrict } from "../ui/CommitInput";
import type { LabAction } from "./state";

interface Props {
  spec: FightSpec;
  descs: (Description | null)[];
  stats: unknown;
  pets: unknown[];
  errors: string[];
  dispatch: (a: LabAction) => void;
}

/** How a row can be changed: typed text (return an error to reject it), a checkbox or a fixed set of choices. */
type Editor =
  | { kind: "text"; commit: (text: string) => string | void; numeric?: boolean }
  | { kind: "bool"; checked: boolean; set: (on: boolean) => void }
  | { kind: "select"; options: string[]; set: (value: string) => void };
type Row = [string, string, Editor?];

const HEX = /^[0-9a-fA-F\s]*$/;
const intIn = (t: string, lo: number, hi: number, msg: string) => {
  const v = parseIntStrict(t);
  return v === null || v < lo || v > hi ? ([msg, 0] as const) : ([undefined, v] as const);
};

/** Marks the rows at the given paths as editable; paths missing from the dump are appended. */
function withEdits(rows: Row[], edits: Record<string, { value: string; editor: Editor }>): Row[] {
  const seen = new Set<string>();
  const out = rows.map((r): Row => {
    const e = edits[r[0]];
    if (!e) return r;
    seen.add(r[0]);
    return [r[0], e.value, e.editor];
  });
  for (const [path, e] of Object.entries(edits)) if (!seen.has(path)) out.push([path, e.value, e.editor]);
  return out;
}

function teamRows(spec: FightSpec, team: 0 | 1, dispatch: Props["dispatch"]): Row[] {
  const prop = (team === 0 ? spec.p0 : spec.p1) as TeamProps | null;
  const set = (patch: TeamProps) => dispatch({ type: "setTeam", team, patch });
  const st = prop?._st as Record<string, unknown> | null | undefined;
  const taken = spec.brutes.map((b) => b.id);
  const edits: Record<string, { value: string; editor: Editor }> = {
    _sab: { value: String(prop?._sab ?? null), editor: { kind: "bool", checked: !!prop?._sab, set: (on) => set({ _sab: on || null }) } },
    _poi: { value: String(prop?._poi ?? null), editor: { kind: "bool", checked: !!prop?._poi, set: (on) => set({ _poi: on || null }) } },
    _st: {
      value: st ? "present" : "null",
      editor: {
        kind: "bool",
        checked: !!st,
        set: (on) => {
          if (!on) return set({ _st: null });
          const b = newLabBrute(team, { takenIds: [...taken, ...(typeof st?._s === "number" ? [st._s] : [])] });
          set({ _st: { _s: b.id, _lvl: b.levelUps, _bits: bitsToHex(b.choices, b.levelUps), _gfx: b.gfx } });
        },
      },
    },
  };
  const rows = flatten(prop ?? {}, "", []).filter(([k]) => k !== "_st");
  rows.push(...flatten({ _st: st ?? null }, "", []));
  if (st) {
    const setSt = (patch: Record<string, unknown>) => set({ _st: { ...st, ...patch } });
    const str = (k: string) => String(st[k] ?? "");
    Object.assign(edits, {
      "_st._s": { value: str("_s"), editor: { kind: "text", numeric: true, commit: (t: string) => { const v = parseIntStrict(t); if (!isValidSeedId(v)) return "Id is a whole number from 1 to 2147483647."; setSt({ _s: v }); } } },
      "_st._lvl": { value: str("_lvl"), editor: { kind: "text", numeric: true, commit: (t: string) => { const [err, v] = intIn(t, 0, MAX_LAB_LEVEL - 1, `Level-ups are 0 to ${MAX_LAB_LEVEL - 1}.`); if (err) return err; setSt({ _lvl: v }); } } },
      "_st._bits": { value: str("_bits"), editor: { kind: "text", commit: (t: string) => { if (!HEX.test(t)) return "Use hex digits only."; setSt({ _bits: bitsToHex(hexToChoices(t, Number(st._lvl) || 0), Number(st._lvl) || 0) }); } } },
      "_st._gfx": { value: str("_gfx"), editor: { kind: "text", commit: (t: string) => { if (!t) return "The look can't be empty."; setSt({ _gfx: t }); } } },
    });
  }
  return withEdits(rows, edits);
}

/** Every leaf value as a dotted path, so nothing in the data can be skipped. */
function flatten(value: unknown, path: string, out: Row[]): Row[] {
  if (value instanceof Map) return flatten(Object.fromEntries(value), path, out);
  if (Array.isArray(value) && value.length && value.every((v) => v === null || typeof v !== "object")) {
    out.push([path, value.join(", ")]);
  } else if (Array.isArray(value)) {
    if (!value.length) out.push([path, "[]"]);
    value.forEach((v, i) => flatten(v, `${path}[${i}]`, out));
  } else if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) out.push([path, "{}"]);
    entries.forEach(([k, v]) => flatten(v, path ? `${path}.${k}` : k, out));
  } else out.push([path, value === undefined ? "undefined" : String(value)]);
  return out;
}

function sections({ spec, descs, stats, pets, errors, dispatch }: Props): [string, Row[]][] {
  const { brutes, p0, p1, ...fight } = spec;
  void p0; void p1;
  const takenBy = (i: number) => brutes.filter((_, j) => j !== i).map((b) => b.id);
  const list: [string, Row[]][] = [
    ["Fight", withEdits(flatten(fight, "", []), {
      seed: { value: String(spec.seed), editor: { kind: "text", numeric: true, commit: (t) => { const v = parseIntStrict(t); if (v === null) return "The seed is a whole number."; dispatch({ type: "setFight", patch: { seed: v } }); } } },
      arena: { value: String(spec.arena), editor: { kind: "text", numeric: true, commit: (t) => { const v = parseIntStrict(t); if (v === null || v < 0) return "Use 0 or more."; dispatch({ type: "setFight", patch: { arena: v } }); } } },
      lang: { value: spec.lang, editor: { kind: "select", options: [...new Set([spec.lang, ...INVENTORY_LANGS])], set: (lang) => dispatch({ type: "setFight", patch: { lang } }) } },
    })],
    ["Team 0 properties", teamRows(spec, 0, dispatch)],
    ["Team 1 properties", teamRows(spec, 1, dispatch)],
  ];
  brutes.forEach((b, i) => {
    const d = descs[i];
    const update = (patch: Partial<typeof b>) => dispatch({ type: "updateBrute", index: i, patch });
    const hex = bitsToHex(b.choices, b.levelUps);
    const edits: Record<string, { value: string; editor: Editor }> = {
      name: { value: b.name, editor: { kind: "text", commit: (t) => { if (!t) return "A brute needs a name."; update({ name: t }); } } },
      id: { value: String(b.id), editor: { kind: "text", numeric: true, commit: (t) => { const v = parseIntStrict(t); if (!isValidSeedId(v)) return "Id is a whole number from 1 to 2147483647."; if (takenBy(i).includes(v)) return `Id ${v} is already in this fight.`; update({ id: v }); } } },
      team: { value: String(b.team), editor: { kind: "select", options: ["0", "1"], set: (t) => update({ team: t === "1" ? 1 : 0 }) } },
      levelUps: { value: String(b.levelUps), editor: { kind: "text", numeric: true, commit: (t) => { const [err, v] = intIn(t, 0, MAX_LAB_LEVEL - 1, `Level-ups are 0 to ${MAX_LAB_LEVEL - 1}.`); if (err) return err; update({ levelUps: v }); } } },
      gfx: { value: b.gfx, editor: { kind: "text", commit: (t) => { if (!t) return "The look can't be empty."; update({ gfx: t }); } } },
      choices: { value: b.choices.join(", "), editor: { kind: "text", commit: (t) => { const parts = t.split(/[\s,]+/).filter(Boolean); if (parts.some((p) => p !== "0" && p !== "1")) return "Use 0 or 1, separated by commas."; update({ choices: parts.map(Number) as (0 | 1)[] }); } } },
      avoid: { value: (b.avoid ?? []).join(", "), editor: { kind: "text", commit: (t) => update({ avoid: t.split(/[\s,]+/).filter(Boolean) }) } },
      bitsHex: { value: hex, editor: { kind: "text", commit: (t) => { if (!HEX.test(t)) return "Use hex digits only."; update({ choices: hexToChoices(t, b.levelUps) }); } } },
    };
    const rows = withEdits(flatten(b, "", []), edits);
    // bitsHex is derived from choices, so it sits right after them
    rows.push(...(rows.splice(rows.findIndex((r) => r[0] === "bitsHex"), 1)));
    try { rows.push(...flatten(destiny(b.id), "destiny", [])); } catch { /* id outside the engine's range */ }
    if (d) {
      rows.push(...flatten({ check: d.check, fin: d.fin }, "", []));
      d.levels.forEach((lv, n) => rows.push(...flatten(lv, `levels[${n}]`, [])));
    }
    list.push([`Brute: ${b.name} (team ${b.team})`, rows]);
  });
  list.push(["Fight statistics", flatten(stats ?? {}, "", [])]);
  list.push(["Pet statistics", flatten(pets, "", [])]);
  list.push(["Problems", errors.length ? errors.map((e, i): Row => [String(i + 1), e]) : [["", "None"]]]);
  return list;
}

function Field({ value, editor, label }: { value: string; editor: Editor; label: string }) {
  if (editor.kind === "bool") {
    return <input type="checkbox" className="param-check" aria-label={label} checked={editor.checked} onChange={(e) => editor.set(e.target.checked)} />;
  }
  if (editor.kind === "select") {
    return (
      <select className="param-input" aria-label={label} value={value} onChange={(e) => editor.set(e.target.value)}>
        {editor.options.map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  }
  return <CommitInput className="param-input" aria-label={label} value={value} spellCheck={false} inputMode={editor.numeric ? "numeric" : undefined} onCommit={editor.commit} />;
}

/** A read-only dump of every parameter and computed value in the fight. */
export function ParametersDialog(props: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();
  const data = open ? sections(props) : [];
  const copy = () => {
    const text = data.map(([t, rows]) => `# ${t}\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}`).join("\n\n");
    void navigator.clipboard.writeText(text).catch(() => undefined);
  };
  return (
    <>
      <button type="button" className="btn ghost" aria-haspopup="dialog" onClick={() => { setOpen(true); ref.current?.showModal(); }}>Parameters</button>
      <dialog ref={ref} className="dialog params-dialog" aria-labelledby="params-title" onClose={() => setOpen(false)}>
        <section className="dialog-body">
          <div className="row bench-head">
            <h2 id="params-title">Parameters</h2>
            <span className="row">
              <button type="button" className="btn small ghost" onClick={copy}>Copy all</button>
              <button type="button" className="btn small ghost" onClick={() => ref.current?.close()}>Close</button>
            </span>
          </div>
          <input type="search" value={filter} placeholder="Filter by name or value" aria-label="Filter parameters" onChange={(e) => setFilter(e.target.value)} />
          <div className="params-grid">
            {data.map(([title, rows]) => {
              const shown = q ? rows.filter(([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q)) : rows;
              return (
                shown.length > 0 && (
                  <section key={title} className="params-sec" aria-label={title}>
                    <h3>{title} <span className="muted">{shown.length}</span></h3>
                    <dl className="params-list">
                      {shown.map(([k, v, editor], i) => (
                        <div key={i} className={editor ? "editable" : undefined}>
                          <dt>{k}</dt>
                          <dd>{editor ? <Field value={v} editor={editor} label={`${title}: ${k}`} /> : v}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )
              );
            })}
          </div>
        </section>
      </dialog>
    </>
  );
}
