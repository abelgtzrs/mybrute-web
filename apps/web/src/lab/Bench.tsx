import { useEffect, useRef, useState } from "react";
import { bitsToHex, describe, destiny, displayLevel, type BonusKind, type SpecBrute } from "@mybrute/engine";
import { Portrait } from "../swf/Portrait";
import { useNames } from "../ui/language";
import type { SavedBrute } from "./storage";
import { exportBrute, exportBrutes, importBrutes } from "./bruteCode";

interface Props {
  items: SavedBrute[];
  takenIds: number[];
  /** team null: overwrite the brute with the same id already in the fight */
  onUse: (b: SpecBrute, team: 0 | 1 | null) => void;
  onDelete: (key: string) => void;
  /** open a save in the editor; `editing` is the key of the one open now */
  onEdit: (item: SavedBrute) => void;
  editing: string | null;
  where: "account" | "browser";
  /** saves brutes read from pasted codes to the bench */
  onImport: (brutes: SpecBrute[]) => void;
  onNotify: (msg: string) => void;
}

/** Saved brute states, ready to drop into either team. */
export function Bench({ items, takenIds, onUse, onDelete, onEdit, editing, where, onImport, onNotify }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  // the drawer grows out of the button: same left edge and bottom, twice its width
  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    const d = ref.current;
    if (!r || !d) return;
    d.style.left = `${r.left}px`;
    d.style.bottom = `${window.innerHeight - r.bottom}px`;
    d.style.width = `${Math.min(r.width * 2, window.innerWidth - r.left - 8)}px`;
  };
  const open = () => { place(); ref.current?.show(); setIsOpen(true); };
  const close = () => { ref.current?.close(); setIsOpen(false); btn.current?.focus(); };
  useEffect(() => {
    if (!isOpen) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !btn.current?.contains(t)) close();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [isOpen]);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const doImport = () => {
    const { brutes, errors } = importBrutes(code);
    if (brutes.length) onImport(brutes);
    // keep the text when something failed, so it can be fixed and imported again
    if (!errors.length) setCode("");
    setCodeError(errors.join("\n"));
  };
  const copy = (text: string, what: string) =>
    navigator.clipboard.writeText(text).then(() => onNotify(`${what} copied.`), () => onNotify("Couldn't reach the clipboard."));
  const copyCode = (b: SpecBrute) => copy(exportBrute(b), "Brute code");
  const copyAll = () => copy(exportBrutes(items.map((s) => s.brute)), `${items.length} brute codes`);
  return (
    <>
    <button ref={btn} type="button" className="btn bench-open" aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => (isOpen ? close() : open())}>
      Bench <span className="muted">{items.length} saved</span>
    </button>
    <dialog ref={ref} className="dialog drawer" aria-labelledby="bench-title">
    <section className="bench dialog-body">
      <div className="row bench-head">
        <h2 id="bench-title">Bench</h2>
        {items.length > 1 && (
          <button type="button" className="btn small ghost" title="Copy every saved brute's code, one per line" onClick={copyAll}>Export all</button>
        )}
        <button type="button" className="btn small ghost" onClick={close}>Close</button>
      </div>
      <p className="hint">{where === "account" ? "Saved to your account." : "Saved in this browser. Sign in to keep Lab saves in your account."}</p>
      {items.length === 0 ? (
        <p className="muted">Save a brute from the editor to keep it here. You can put saved brutes back into any fight.</p>
      ) : (
        <ul className="bench-list">
          {items.map((s) => {
            const inFight = takenIds.includes(s.brute.id);
            return (
              <li key={s.key} className={"bench-item" + (editing === s.key ? " editing" : "")}>
                <Portrait gfx={s.brute.gfx} name={s.brute.name} className="bench-portrait" />
                <div className="bench-text">
                  <strong title={s.label}><span>{s.brute.name}</span> <span className="muted">Lv {displayLevel(s.brute.levelUps)}</span></strong>
                  <BenchStats brute={s.brute} />
                </div>
                <div className="row">
                  <button type="button" className="btn small" aria-pressed={editing === s.key} onClick={() => { onEdit(s); close(); }}>Edit</button>
                  {inFight ? (
                    <button type="button" className="btn small" title="Replace the brute with this id in the current fight" onClick={() => { onUse(s.brute, null); close(); }}>Apply</button>
                  ) : ([0, 1] as const).map((t) => (
                    <button key={t} type="button" className={`btn small team-${t}`} aria-label={`Add ${s.label} to team ${t}`} onClick={() => { onUse(s.brute, t); close(); }}>+ Team {t}</button>
                  ))}
                  <button type="button" className="btn small ghost" aria-label={`Copy code for ${s.label}`} onClick={() => copyCode(s.brute)}>Export</button>
                  <button type="button" className="btn small ghost" aria-label={`Delete ${s.label}`} onClick={() => onDelete(s.key)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="bench-import">
        <label>
          Import brute codes <span className="muted">(one or many, one per line)</span>
          <textarea rows={3} value={code} placeholder={"MYBRUTE1:...\nMYBRUTE1:..."} onChange={(e) => setCode(e.target.value)} />
        </label>
        <button type="button" className="btn small" disabled={!code.trim()} onClick={doImport}>Import to bench</button>
        {codeError && <p className="field-error" role="alert" style={{ whiteSpace: "pre-line" }}>{codeError}</p>}
      </div>
    </section>
    </dialog>
    </>
  );
}

function BenchStats({ brute }: { brute: SpecBrute }) {
  const { name } = useNames();
  let fin;
  let fate;
  try {
    fin = describe(brute.id, brute.levelUps, brute.choices).fin;
    fate = destiny(brute.id);
  } catch { return null; }
  const groups: [string, BonusKind, string[]][] = [
    ["Weapons", "Weapons", fin.weapons],
    ["Supers", "Super", fin.supers],
    ["Pets", "Followers", fin.followers],
    ["Skills", "Permanent", fin.perms],
    ["Talents", "Talent", fin.talents],
  ];
  const picks = brute.choices.slice(0, brute.levelUps);
  const facts: [string, string | number][] = [
    ["Id", brute.id],
    ["Level-ups", brute.levelUps],
    ["Second options", picks.filter((c) => c === 1).length],
    ["Max HP", fin.lifeMax],
    ["Stance", fate.stance ?? "Normal"],
    ["Banned", fate.banned.length],
    ["Avoiding", brute.avoid?.length ?? 0],
    ["Bits", bitsToHex(brute.choices, brute.levelUps) || "None"],
  ];
  return (
    <>
      <span className="tile-stats">
        <abbr title="Life">HP</abbr> {fin.life} <abbr title="Strength">STR</abbr> {fin.force} <abbr title="Agility">AGI</abbr> {fin.agility} <abbr title="Speed">SPD</abbr> {fin.speed}
      </span>
      <details className="bench-more">
        <summary>
          {groups.filter(([, , items]) => items.length).map(([label, , items]) => `${items.length} ${label.toLowerCase()}`).join(" · ") || "Details"}
        </summary>
        <span className="bench-facts">
          {facts.map(([k, v]) => <span key={k}><span className="muted">{k}</span> {v}</span>)}
        </span>
        {groups.filter(([, , items]) => items.length).map(([label, kind, items]) => (
          <span key={label} className="bench-kit" title={label}>
            {items.map((x) => <span key={x} className={`chip kind-${kind}`}>{name(kind, x)}</span>)}
          </span>
        ))}
      </details>
    </>
  );
}
