import { useState } from "react";
import { displayLevel, levelUpsFor, newLabBrute, supportOf, type Description, type FightSpec, type SpecBrute } from "@mybrute/engine";
import { Portrait } from "../swf/Portrait";
import { CommitInput, parseIntStrict } from "../ui/CommitInput";
import type { LabAction } from "./state";

interface Props {
  spec: FightSpec;
  descs: (Description | null)[];
  selected: number | null;
  problems: Set<number>;
  dispatch: (a: LabAction) => void;
}

/** The two teams facing each other. Team 1 portraits are mirrored, as client.swf shows them. */
export function VersusBoard({ spec, descs, selected, problems, dispatch }: Props) {
  return (
    <section className="versus" aria-label="Teams">
      {([0, 1] as const).map((team) => (
        <div key={team} className={`team team-${team}`}>
          <h2 className="team-name">Team {team}</h2>
          <ul className="tiles">
            {spec.brutes.map((b, i) => b.team === team && (
              <li key={i}>
                <BruteTile brute={b} desc={descs[i]} selected={selected === i} problem={problems.has(i)} onSelect={() => dispatch({ type: "select", index: i })} />
              </li>
            ))}
          </ul>
          <SupportTile spec={spec} team={team} dispatch={dispatch} />
          <AddBrute team={team} takenIds={spec.brutes.map((b) => b.id)} onAdd={(brute) => dispatch({ type: "addBrute", brute })} />
        </div>
      ))}
      <div className="vs" aria-hidden="true">VS</div>
    </section>
  );
}

function BruteTile({ brute, desc, selected, problem, onSelect }: { brute: SpecBrute; desc: Description | null; selected: boolean; problem: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={"tile" + (selected ? " selected" : "") + (problem ? " problem" : "")} aria-pressed={selected} onClick={onSelect}>
      <Portrait gfx={brute.gfx} name={brute.name} flip={brute.team === 1} className="tile-portrait" />
      <span className="tile-text">
        <span className="tile-name">{brute.name || "Unnamed"}</span>
        <span className="tile-level">Level {displayLevel(brute.levelUps)}</span>
        <span className="tile-id">#{brute.id}</span>
        {desc && (
          <span className="tile-stats">
            <abbr title="Strength">STR</abbr> {desc.fin.force} <abbr title="Agility">AGI</abbr> {desc.fin.agility} <abbr title="Speed">SPD</abbr> {desc.fin.speed} <abbr title="Life">HP</abbr> {desc.fin.life}
          </span>
        )}
      </span>
    </button>
  );
}

function SupportTile({ spec, team, dispatch }: { spec: FightSpec; team: 0 | 1; dispatch: (a: LabAction) => void }) {
  const s = supportOf(spec, team);
  if (!s) return null;
  const set = (patch: Record<string, unknown>) => dispatch({ type: "setSupport", team, patch });
  return (
    <details className="support">
      <summary>
        <Portrait gfx={s.gfx} name="Support brute" flip={team === 1} className="support-portrait" />
        <span>Support brute <span className="muted">#{s.id}, level {displayLevel(s.levelUps)}</span></span>
      </summary>
      <div className="form-grid">
        <label>Id <CommitInput value={s.id} inputMode="numeric" onCommit={(t) => { const v = parseIntStrict(t); if (v === null || v < 1) return "Enter a positive whole number."; set({ _s: v }); }} /></label>
        <label>Level <CommitInput value={displayLevel(s.levelUps)} inputMode="numeric" onCommit={(t) => { const v = parseIntStrict(t); if (v === null || v < 1 || v > 500) return "Level is 1 to 500."; set({ _lvl: levelUpsFor(v) }); }} /></label>
        <label className="wide">Bits (hex) <CommitInput value={s.bits} spellCheck={false} onCommit={(t) => { if (t && !/^([0-9a-fA-F]{2})+$/.test(t)) return "Use pairs of hex digits."; set({ _bits: t.toLowerCase() }); }} /></label>
        <label className="wide">Appearance <CommitInput value={s.gfx} spellCheck={false} onCommit={(t) => set({ _gfx: t.replace(/\s+/g, "") })} /></label>
      </div>
    </details>
  );
}

function AddBrute({ team, takenIds, onAdd }: { team: 0 | 1; takenIds: number[]; onAdd: (b: SpecBrute) => void }) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState("10");
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [randomBits, setRandomBits] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!open) return <button type="button" className="add-brute" onClick={() => setOpen(true)}>Add a brute to team {team}</button>;
  const submit = () => {
    const lvl = parseIntStrict(level), idv = id ? parseIntStrict(id) : undefined;
    if (lvl === null || lvl < 1 || lvl > 500) return setError("Level is 1 to 500.");
    if (idv === null || (idv !== undefined && (idv < 1 || idv > 2147483647))) return setError("Id is a whole number from 1 to 2147483647.");
    if (idv !== undefined && takenIds.includes(idv)) return setError(`Id ${idv} is already in this fight.`);
    onAdd(newLabBrute(team, { levelUps: levelUpsFor(lvl), id: idv, name: name.trim() || undefined, takenIds, randomBits }));
    setOpen(false); setId(""); setName(""); setError(null);
  };
  return (
    <form className="add-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <label>Name <input value={name} placeholder="Same as id" onChange={(e) => setName(e.target.value)} /></label>
      <label>Id <input value={id} inputMode="numeric" placeholder="Random" onChange={(e) => setId(e.target.value)} /></label>
      <label>Level <input value={level} inputMode="numeric" onChange={(e) => setLevel(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={randomBits} onChange={(e) => setRandomBits(e.target.checked)} /> Random level-up choices</label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="row">
        <button type="submit" className="btn">Add brute</button>
        <button type="button" className="btn ghost" onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
      </div>
    </form>
  );
}
