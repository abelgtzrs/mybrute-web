import { GFX_LABELS, gfxParts, gfxString } from "@mybrute/engine";
import { CommitInput, parseIntStrict } from "./CommitInput";

/** The 16 perso.swf appearance numbers, a randomizer, and the raw string. Shared by the Lab and brute creation. */
export function GfxEditor({ gfx, onChange }: { gfx: string; onChange: (gfx: string) => void }) {
  const parts = gfxParts(gfx);
  const setPart = (i: number, v: number) => { const p = parts.slice(); p[i] = v; onChange(gfxString(p)); };
  return (
    <div className="gfx-editor">
      <div className="row">
        <button type="button" className="btn small" onClick={() => {
          const p = parts.slice();
          for (let i = 2; i < 16; i++) p[i] = Math.floor(Math.random() * 100);
          onChange(gfxString(p));
        }}>Randomize look</button>
        <button type="button" className="btn small ghost" onClick={() => setPart(0, parts[0] === 0 ? 1 : 0)}>Switch body</button>
      </div>
      <div className="gfx-grid">
        {GFX_LABELS.map((label, i) => (
          <label key={label}>{label}
            <CommitInput value={parts[i]} inputMode="numeric" onCommit={(t) => { const v = parseIntStrict(t); if (v === null || v < 0 || v > 999999) return "Use 0 or more."; setPart(i, v); }} />
          </label>
        ))}
      </div>
      <label className="wide">Appearance string
        <CommitInput value={gfx} spellCheck={false} onCommit={(t) => { const s = t.replace(/\s+/g, ""); if (!/^\d{1,6}(;\d{1,6}){15}$/.test(s)) return "Use 16 numbers separated by semicolons."; onChange(s); }} />
      </label>
      <p className="hint">In fights, the Part 1 slot shows the brute's armor instead of this value.</p>
    </div>
  );
}
