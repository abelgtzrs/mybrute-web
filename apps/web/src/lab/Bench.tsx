import { displayLevel, type SpecBrute } from "@mybrute/engine";
import { Portrait } from "../swf/Portrait";
import type { SavedBrute } from "./storage";

interface Props {
  items: SavedBrute[];
  takenIds: number[];
  /** team null: overwrite the brute with the same id already in the fight */
  onUse: (b: SpecBrute, team: 0 | 1 | null) => void;
  onDelete: (key: string) => void;
}

/** Saved brute states, ready to drop into either team. */
export function Bench({ items, takenIds, onUse, onDelete }: Props) {
  return (
    <section className="bench panel" aria-labelledby="bench-title">
      <h2 id="bench-title">Bench</h2>
      {items.length === 0 ? (
        <p className="muted">Save a brute from the editor to keep it here. You can put saved brutes back into any fight.</p>
      ) : (
        <ul className="bench-list">
          {items.map((s) => {
            const inFight = takenIds.includes(s.brute.id);
            return (
              <li key={s.key} className="bench-item">
                <Portrait gfx={s.brute.gfx} name={s.brute.name} className="bench-portrait" />
                <div className="bench-text">
                  <strong>{s.label}</strong>
                  <span className="muted">{s.brute.name}, level {displayLevel(s.brute.levelUps)}, #{s.brute.id}</span>
                </div>
                <div className="row">
                  {inFight ? (
                    <button type="button" className="btn small" title="Replace the brute with this id in the current fight" onClick={() => onUse(s.brute, null)}>Apply to fight</button>
                  ) : ([0, 1] as const).map((t) => (
                    <button key={t} type="button" className={`btn small team-${t}`} onClick={() => onUse(s.brute, t)}>Add to team {t}</button>
                  ))}
                  <button type="button" className="btn small ghost" aria-label={`Delete ${s.label}`} onClick={() => onDelete(s.key)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
