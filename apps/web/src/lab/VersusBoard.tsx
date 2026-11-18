import { useState } from "react";
import { bitsToHex, displayLevel, levelUpsFor, MAX_LAB_LEVEL, newLabBrute, supportOf, type Description, type FightSpec, type SpecBrute } from "@mybrute/engine";
import { Portrait } from "../swf/Portrait";
import { parseIntStrict } from "../ui/CommitInput";
import type { LabAction } from "./state";

interface Props {
  spec: FightSpec;
  descs: (Description | null)[];
  selected: number | null;
  problems: Set<number>;
  dispatch: (a: LabAction) => void;
  /** the team whose support brute is open in the editor */
  editingSupport: 0 | 1 | null;
  onEditSupport: (team: 0 | 1) => void;
}

/** The two teams facing each other. Team 1 portraits are mirrored, as client.swf shows them. */
export function VersusBoard({ spec, descs, selected, problems, dispatch, editingSupport, onEditSupport }: Props) {
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
          <TeamExtras spec={spec} team={team} dispatch={dispatch} editing={editingSupport === team} onEdit={() => onEditSupport(team)} />
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

/** Team props the original engine reads: a support brute, sabotage (from a saboteur) and poison (from a chef). */
export function TeamExtras({ spec, team, dispatch, editing, onEdit }: { spec: FightSpec; team: 0 | 1; dispatch: (a: LabAction) => void; editing: boolean; onEdit: () => void }) {
  const prop = team === 0 ? spec.p0 : spec.p1;
  const s = supportOf(spec, team);
  const setTeam = (patch: Record<string, unknown>) => dispatch({ type: "setTeam", team, patch });
  const addSupport = () => {
    const taken = [...spec.brutes.map((b) => b.id), ...([0, 1] as const).map((t) => supportOf(spec, t)?.id ?? 0)];
    const b = newLabBrute(team, { takenIds: taken });
    setTeam({ _st: { _s: b.id, _lvl: b.levelUps, _bits: bitsToHex(b.choices, b.levelUps), _gfx: b.gfx } });
  };
  const on = [s && "support", prop?._sab && "sabotaged", prop?._poi && "poisoned"].filter(Boolean).join(", ");
  return (
    <details className="extras">
      <summary>Team extras <span className="muted">{on || "none"}</span></summary>
      <label className="check"><input type="checkbox" checked={!!prop?._sab} onChange={(e) => setTeam({ _sab: e.target.checked || null })} /> Saboteur</label>
      <p className="hint">The other side has a saboteur: each brute on this team gets one weapon that breaks.</p>
      <label className="check"><input type="checkbox" checked={!!prop?._poi} onChange={(e) => setTeam({ _poi: e.target.checked || null })} /> Chef</label>
      <p className="hint">This team is poisoned and loses 1/50 of its life every turn until Medicine cures it.</p>
      <label className="check"><input type="checkbox" checked={!!s} onChange={(e) => (e.target.checked ? addSupport() : setTeam({ _st: null }))} /> Support brute</label>
      <p className="hint">Joins once a teammate is hurt (the lower their life, the likelier) and leaves after a while.</p>
      {s && (
        <div className={"support" + (editing ? " editing" : "")}>
          <Portrait gfx={s.gfx} name="Support brute" flip={team === 1} className="support-portrait" />
          <span>#{s.id}, level {displayLevel(s.levelUps)}</span>
          <button type="button" className="btn small" aria-pressed={editing} onClick={onEdit}>Edit</button>
        </div>
      )}
    </details>
  );
}

export function AddBrute({ team, takenIds, onAdd }: { team: 0 | 1; takenIds: number[]; onAdd: (b: SpecBrute) => void }) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState("10");
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [randomBits, setRandomBits] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!open) return <button type="button" className="add-brute" onClick={() => setOpen(true)}>Add a brute to team {team}</button>;
  const submit = () => {
    const lvl = parseIntStrict(level), idv = id ? parseIntStrict(id) : undefined;
    if (lvl === null || lvl < 1 || lvl > MAX_LAB_LEVEL) return setError(`Level is 1 to ${MAX_LAB_LEVEL}.`);
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
