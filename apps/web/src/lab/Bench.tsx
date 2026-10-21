import { useRef } from "react";
import { describe, displayLevel, type SpecBrute } from "@mybrute/engine";
import { Portrait } from "../swf/Portrait";
import type { SavedBrute } from "./storage";

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
}

/** Saved brute states, ready to drop into either team. */
export function Bench({ items, takenIds, onUse, onDelete, onEdit, editing, where }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  return (
    <>
    <button type="button" className="btn bench-open" aria-haspopup="dialog" onClick={() => ref.current?.showModal()}>
      Bench <span className="muted">{items.length} saved</span>
    </button>
    <dialog ref={ref} className="dialog" aria-labelledby="bench-title">
    <section className="bench dialog-body">
      <div className="row bench-head">
        <h2 id="bench-title">Bench</h2>
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
                  <button type="button" className="btn small ghost" aria-label={`Delete ${s.label}`} onClick={() => onDelete(s.key)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
    </dialog>
    </>
  );
}

function BenchStats({ brute }: { brute: SpecBrute }) {
  let fin;
  try { fin = describe(brute.id, brute.levelUps, brute.choices).fin; } catch { return null; }
  return (
    <span className="tile-stats">
      <abbr title="Life">HP</abbr> {fin.life} <abbr title="Strength">STR</abbr> {fin.force} <abbr title="Agility">AGI</abbr> {fin.agility} <abbr title="Speed">SPD</abbr> {fin.speed}
    </span>
  );
}
