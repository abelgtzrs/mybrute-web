import { useMemo, useState } from "react";
import { FightLog, TEAM_STATS, localizeHistory, type EngineResult, type FightSpec, type FighterStats, type PetStats, type Description } from "@mybrute/engine";
import { useLanguage } from "../ui/language";
import { SwfPlayer } from "../swf/SwfPlayer";
import { StatsPanel } from "./StatsPanel";

export interface Playback { params: string; nonce: number; snapshot: string; ended: boolean }

interface Props {
  spec: FightSpec;
  descs: (Description | null)[];
  sim: EngineResult | null;
  stats: Map<number, FighterStats> | null;
  pets: PetStats[];
  errors: string[];
  playback: Playback | null;
  onPlay: () => void;
  notify: (msg: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

type Tab = "log" | "stats" | "achievements";
const TABS: [Tab, string][] = [["log", "Action log"], ["stats", "Statistics"], ["achievements", "Achievements"]];

/** The engine awards these at the end of a fight (Arena.endFight): id, name, team counter and the value that earns it. */
const ACHIEVEMENTS: { id: string; name: string; stat: (typeof TEAM_STATS)[number] | null; min: number; what: string }[] = [
  { id: "perfec", name: "Perfect", stat: null, min: 0, what: "The winning main brute finishes at full life" },
  { id: "dodge", name: "Dodger", stat: "DODGE", min: 10, what: "10 or more dodges" },
  { id: "parade", name: "Parry master", stat: "PARADE", min: 20, what: "20 or more blocks" },
  { id: "disarm", name: "Disarmer", stat: "DISARM", min: 8, what: "8 or more disarms" },
  { id: "ripost", name: "Riposter", stat: "RIPOSTE", min: 8, what: "8 or more ripostes" },
  { id: "countr", name: "Counter-attacker", stat: "COUNTER", min: 5, what: "5 or more counters" },
  { id: "folfra", name: "Pet slayer", stat: "FOL_FRAG", min: 3, what: "3 or more pets killed" },
  { id: "barbar", name: "Barbarian", stat: "DAMAGE_MAX", min: 50, what: "A single hit of 50 or more" },
  { id: "brute", name: "Brute", stat: "DAMAGE_MAX", min: 100, what: "A single hit of 100 or more" },
  { id: "tornad", name: "Tornado", stat: "STRIKE", min: 20, what: "20 or more strikes" },
  { id: "dca", name: "Light missiles", stat: "MISSILE_LIGHT", min: 20, what: "20 or more light missiles" },
];

export function ArenaPanel({ spec, descs, sim, stats, pets, errors, playback, onPlay, notify, expanded, onToggleExpand }: Props) {
  const stale = playback !== null && playback.snapshot !== JSON.stringify(spec);
  const [tab, setTab] = useState<Tab>("log");
  return (
    <section className="arena panel" aria-label="Arena">
      <div className="arena-fight">
        <div className="stage">
          <button type="button" className="stage-expand" aria-pressed={expanded} title={expanded ? "Back to the lab (Esc)" : "Give the fight the whole workspace"} onClick={onToggleExpand}>
            {expanded ? "⤡ Collapse" : "⤢ Expand"}
          </button>
          {playback ? (
            <SwfPlayer key={playback.nonce} swf="client.swf" params={playback.params} label="Fight playback" allowScript className="fight-swf" />
          ) : (
            <div className="stage-empty">
              <p>Press Play to watch this fight in the original Flash client.</p>
              <button type="button" className="btn play" disabled={errors.length > 0} onClick={onPlay}>Play fight</button>
            </div>
          )}
        </div>
        {stale && (
          <p className="notice">You've changed the fight since it started playing. <button type="button" className="link" onClick={onPlay}>Play the new version</button></p>
        )}
        {playback?.ended && !stale && <p className="notice quiet">Playback finished.</p>}
        {errors.length > 0 && (
          <div className="problems" role="alert">
            <h3>Fix these before the fight can run</h3>
            <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
      </div>
      <div className="arena-tabs" role="tablist" aria-label="Fight details">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" id={`arena-tab-${key}`} aria-selected={tab === key} aria-controls={`arena-view-${key}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      <div className="arena-view" role="tabpanel" id="arena-view-log" aria-labelledby="arena-tab-log" hidden={tab !== "log"}>
        {errors.length === 0 && sim ? <ActionLog spec={spec} descs={descs} sim={sim} notify={notify} /> : <p className="muted">The action log appears once the fight can run.</p>}
      </div>
      <div className="arena-view" role="tabpanel" id="arena-view-stats" aria-labelledby="arena-tab-stats" hidden={tab !== "stats"}>
        <StatsPanel spec={spec} sim={sim} stats={stats} pets={pets} errors={errors} />
      </div>
      <div className="arena-view" role="tabpanel" id="arena-view-achievements" aria-labelledby="arena-tab-achievements" hidden={tab !== "achievements"}>
        {errors.length === 0 && sim ? <Achievements spec={spec} sim={sim} /> : <p className="muted">Achievements appear once the fight can run.</p>}
      </div>
    </section>
  );
}

function Achievements({ spec, sim }: { spec: FightSpec; sim: EngineResult }) {
  const teams = [0, 1] as const;
  const earned = (t: 0 | 1, id: string) => sim.achievements?.[t]?.includes(id) ?? false;
  const counter = (t: 0 | 1, stat: string | null) => (stat ? String(sim.teamStats?.[t]?.[TEAM_STATS.indexOf(stat as (typeof TEAM_STATS)[number])] ?? 0) : "–");
  const totals = teams.map((t) => ACHIEVEMENTS.filter((a) => earned(t, a.id)).length);
  const names = teams.map((t) => spec.brutes.filter((b) => b.team === t).map((b) => b.name).join(", ") || `Team ${t}`);
  return (
    <div className="achievements">
      <p className="verdict-line">
        {teams.map((t) => <span key={t} className={`team-${t}`}>{names[t]}: <b>{totals[t]}</b> of {ACHIEVEMENTS.length}</span>)}
      </p>
      <table className="vstats ach-table">
        <thead>
          <tr>
            <th scope="col">Achievement</th><th scope="col">Needs</th>
            {teams.map((t) => <th key={t} scope="col" className={`team-${t}`} title={names[t]}>Team {t}</th>)}
          </tr>
        </thead>
        <tbody>
          {ACHIEVEMENTS.map((a) => (
            <tr key={a.id}>
              <th scope="row">{a.name} <code>{a.id}</code></th>
              <td>{a.what}</td>
              {teams.map((t) => (
                <td key={t} className={earned(t, a.id) ? "ach-yes" : "ach-no"}>
                  {earned(t, a.id) ? "★ Earned" : "–"} <span className="muted">{a.stat ? `${counter(t, a.stat)}/${a.min}` : ""}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionLog({ spec, descs, sim, notify }: { spec: FightSpec; descs: (Description | null)[]; sim: EngineResult; notify: (m: string) => void }) {
  const { lang } = useLanguage();
  const [moves, setMoves] = useState(false);
  const lines = useMemo(() => {
    const glads = spec.brutes.map((b, i) => ({ id: b.id, name: b.name, team: b.team, life: descs[i]?.fin.life ?? 0 }));
    return FightLog.format(localizeHistory(sim.history, lang), glads).filter((l) => moves || l.kind !== "move");
  }, [spec, descs, sim, moves, lang]);
  const copy = () => navigator.clipboard.writeText(lines.map((l) => `${l.i}: ${l.text}`).join("\n")).then(() => notify("Log copied."), () => notify("Couldn't reach the clipboard."));
  return (
    <div className="log">
      <div className="log-head">
        <h3>Action log</h3>
        <label className="check"><input type="checkbox" checked={moves} onChange={(e) => setMoves(e.target.checked)} /> Show movement</label>
        <button type="button" className="btn small ghost" onClick={copy}>Copy log</button>
      </div>
      <ol className="log-lines" tabIndex={0} aria-label="Action log">
        {lines.map((l) => <li key={l.i} className={`k-${l.kind}`}><span className="i">{l.i}</span>{l.text}</li>)}
      </ol>
    </div>
  );
}
