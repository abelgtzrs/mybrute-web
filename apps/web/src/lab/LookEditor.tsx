import { useId } from "react";
import { GFX_COLOURS, GFX_FIELD_OPTIONS, gfxParts, gfxString, isValidGfx } from "@mybrute/engine";
import { CommitInput } from "../ui/CommitInput";

/**
 * The Lab's appearance editor (desktop Appearance dialog and mobile Lab). Same fields and values as the GfxEditor used
 * by brute creation: two-choice fields are switches, the rest are ‹ › steppers in two columns, so you can tap
 * through looks while watching the portrait change.
 */

const field = (i: number) => GFX_FIELD_OPTIONS.find(([j]) => j === i)!;
const BODY = 0, ARMOR = 1, TSHIRT = 5, BOTTOMS = 6;
// these only show on the male body; dimmed (still editable) on a female brute
const MALE_ONLY = new Set([2, 5, 15]);
const GROUPS: [string, number[]][] = [
  ["Shape", [2, 3, 4, 7]],
  ["Colours", [11, 12, 13, 14, 15]],
];
// "(male)" is said by the dimming instead; the colour group's heading already says "colour"
const shortLabel = (label: string) => label.replace(/ \(male\)/, "").replace(/ colour/, "");

export function LookEditor({ gfx, onChange }: { gfx: string; onChange: (gfx: string) => void }) {
  const parts = gfxParts(gfx);
  const set = (i: number, v: number) => {
    const p = parts.slice();
    p[i] = v;
    onChange(gfxString(p));
  };
  const female = parts[BODY] === 1;
  // the bottoms option means the opposite length on each body
  const bottoms = female ? ["Long", "Short"] : ["Short", "Long"];
  return (
    <div className="mlook">
      <button
        type="button"
        className="btn small"
        onClick={() => {
          const p = parts.slice();
          for (const [i, , opts] of GFX_FIELD_OPTIONS) if (i >= 2) p[i] = Math.floor(Math.random() * opts.length);
          onChange(gfxString(p));
        }}
      >
        Randomize look
      </button>
      <div className="mlook-switches">
        <Switch label="Body" options={["Male", "Female"]} value={parts[BODY]} onPick={(v) => set(BODY, v)} />
        <Switch label="Armor" options={["None", "Armor"]} value={parts[ARMOR]} onPick={(v) => set(ARMOR, v)} />
        <Switch label="T-shirt" options={["No", "Yes"]} value={parts[TSHIRT]} onPick={(v) => set(TSHIRT, v)} dim={female} />
        <Switch label="Bottoms" options={bottoms} value={parts[BOTTOMS]} onPick={(v) => set(BOTTOMS, v)} />
      </div>
      {GROUPS.map(([title, fields]) => (
        <fieldset key={title} className="mlook-group">
          <legend>{title}</legend>
          {fields.map((i) => (
            <Stepper key={i} index={i} value={parts[i]} onPick={(v) => set(i, v)} dim={female && MALE_ONLY.has(i)} />
          ))}
        </fieldset>
      ))}
      <p className="hint">Dimmed parts only show on the male body. In fights, the Armor slot shows the brute's armor instead.</p>
      <label className="mlook-raw">
        Appearance string
        <CommitInput
          value={gfx}
          spellCheck={false}
          onCommit={(t) => {
            const s = t.replace(/\s+/g, "");
            if (!isValidGfx(s)) return "Use 16 numbers separated by semicolons (colours may be -1).";
            onChange(s);
          }}
        />
      </label>
    </div>
  );
}

function Switch({ label, options, value, onPick, dim }: { label: string; options: string[]; value: number; onPick: (v: number) => void; dim?: boolean }) {
  const name = useId();
  return (
    <fieldset className={"team-switch mlook-switch" + (dim ? " dim" : "")}>
      <legend>{label}</legend>
      {options.map((o, v) => (
        <label key={v} className="seg">
          <input type="radio" name={name} checked={value === v} onChange={() => onPick(v)} />
          {o}
        </label>
      ))}
    </fieldset>
  );
}

/** ‹ value › : the arrows step through the options and wrap round; the value itself is a dropdown to jump straight to one. */
function Stepper({ index, value, onPick, dim }: { index: number; value: number; onPick: (v: number) => void; dim?: boolean }) {
  const [, label, opts] = field(index);
  const min = index >= GFX_COLOURS ? -1 : 0;
  const max = opts.length - 1;
  // older brutes were randomized 0-99: a value past the list steps back into it
  const step = (d: number) => {
    const v = Math.min(value, max + 1) + d;
    onPick(v > max ? min : v < min ? max : v);
  };
  const id = useId();
  return (
    <div className={"mlook-step" + (dim ? " dim" : "")}>
      <label htmlFor={id}>{shortLabel(label)}</label>
      <div className="mlook-step-row">
        <button type="button" className="btn ghost" aria-label={`Previous ${label}`} onClick={() => step(-1)}>‹</button>
        <select id={id} value={value} onChange={(e) => onPick(Number(e.target.value))}>
          {min === -1 && <option value={-1}>-1</option>}
          {opts.map((o, v) => <option key={v} value={v}>{o}</option>)}
          {value > max && <option value={value}>{value}</option>}
        </select>
        <button type="button" className="btn ghost" aria-label={`Next ${label}`} onClick={() => step(1)}>›</button>
      </div>
    </div>
  );
}
