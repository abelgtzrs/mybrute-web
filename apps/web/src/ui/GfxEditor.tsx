import { GFX_COLOURS, GFX_FIELD_OPTIONS, gfxParts, gfxString, isValidGfx } from "@mybrute/engine";
import { CommitInput } from "./CommitInput";

/** The perso.swf appearance fields as labelled dropdowns, a randomizer, and the raw string. Shared by the Lab and brute creation. */
export function GfxEditor({ gfx, onChange }: { gfx: string; onChange: (gfx: string) => void }) {
  const parts = gfxParts(gfx);
  const setPart = (i: number, v: number) => { const p = parts.slice(); p[i] = v; onChange(gfxString(p)); };
  return (
    <div className="gfx-editor">
      <div className="row">
        <button type="button" className="btn small" onClick={() => {
          const p = parts.slice();
          for (const [i, , opts] of GFX_FIELD_OPTIONS) if (i >= 2) p[i] = Math.floor(Math.random() * opts.length);
          onChange(gfxString(p));
        }}>Randomize look</button>
      </div>
      <div className="gfx-grid">
        {GFX_FIELD_OPTIONS.map(([i, label, opts]) => (
          <label key={i}>{label}
            <select value={parts[i]} onChange={(e) => setPart(i, Number(e.target.value))}>
              {i >= GFX_COLOURS && <option value={-1}>-1</option>}
              {opts.map((o, v) => <option key={v} value={v}>{o}</option>)}
              {/* older brutes were randomized 0-99; keep their value selectable */}
              {parts[i] >= opts.length && <option value={parts[i]}>{parts[i]}</option>}
            </select>
          </label>
        ))}
      </div>
      <label className="wide">Appearance string
        <CommitInput value={gfx} spellCheck={false} onCommit={(t) => { const s = t.replace(/\s+/g, ""); if (!isValidGfx(s)) return "Use 16 numbers separated by semicolons (colours may be -1)."; onChange(s); }} />
      </label>
      <p className="hint">In fights, the Armor slot shows the brute's armor instead of this value.</p>
    </div>
  );
}
