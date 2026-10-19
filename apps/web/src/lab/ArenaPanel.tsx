import { useMemo, useState } from "react";
import { FightLog, type EngineResult, type FighterStats, type FightSpec, type Description } from "@mybrute/engine";
import { SwfPlayer } from "../swf/SwfPlayer";

export interface Playback { params: string; nonce: number; snapshot: string; ended: boolean }

interface Props {
  spec: FightSpec;
  descs: (Description | null)[];
  sim: EngineResult | null;
  stats: Map<number, FighterStats> | null;
  errors: string[];
  playback: Playback | null;
  onPlay: () => void;
  notify: (msg: string) => void;
}

export function ArenaPanel({ spec, descs, sim, stats, errors, playback, onPlay, notify }: Props) {
  const stale = playback !== null && playback.snapshot !== JSON.stringify(spec);
  return (
    <section className="arena panel" aria-label="Arena">
      <div className="stage">
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

      {errors.length > 0 ? (
        <div className="problems" role="alert">
          <h3>Fix these before the fight can run</h3>
          <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      ) : sim && stats ? (
        <>
          <Outcome spec={spec} sim={sim} stats={stats} />
          <ActionLog spec={spec} descs={descs} sim={sim} notify={notify} />
        </>
      ) : null}
    </section>
  );
}

function Outcome({ spec, sim, stats }: { spec: FightSpec; sim: EngineResult; stats: Map<number, FighterStats> }) {
  const rows: [string, (s: FighterStats) => number | string][] = [
    ["Damage dealt", (s) => s.damageDealt],
    ["Pet damage", (s) => s.petDamageDealt],
    ["Damage taken", (s) => s.damageReceived],
    ["Best hit", (s) => s.highestHit],
    ["Dodges", (s) => s.dodges],
    ["Blocks", (s) => s.blocks],
    ["Counters", (s) => s.teamCounters.COUNTER],
    ["Ripostes", (s) => s.teamCounters.RIPOSTE],
    ["Weapons drawn", (s) => s.weaponsDrawn],
    ["Disarms", (s) => s.disarms],
    ["Pets killed", (s) => s.petsKilled],
  ];
  const shared = [...stats.values()].some((s) => s.teamShared);
  return (
    <div className="outcome">
      <p className={"verdict" + (sim.win === null ? "" : ` team-${sim.win}`)}>
        {sim.win === null ? "Draw: the arena's 1000-action limit was reached." : `Team ${sim.win} wins`}
        <span className="muted"> in {sim.history.length} events</span>
      </p>
      <div className="table-scroll">
        <table className="stats-table">
          <thead>
            <tr><th scope="col">Brute</th>{rows.map(([h]) => <th key={h} scope="col">{h}</th>)}</tr>
          </thead>
          <tbody>
            {spec.brutes.map((b) => {
              const s = stats.get(b.id);
              return s && (
                <tr key={b.id} className={`team-${b.team}`}>
                  <th scope="row">{b.name}{s.result === "win" ? " ✓" : ""}</th>
                  {rows.map(([h, f]) => <td key={h}>{f(s)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {shared && <p className="hint">With several brutes on a team, counters, ripostes and pet damage are team totals.</p>}
    </div>
  );
}

function ActionLog({ spec, descs, sim, notify }: { spec: FightSpec; descs: (Description | null)[]; sim: EngineResult; notify: (m: string) => void }) {
  const [moves, setMoves] = useState(false);
  const lines = useMemo(() => {
    const glads = spec.brutes.map((b, i) => ({ id: b.id, name: b.name, team: b.team, life: descs[i]?.fin.life ?? 0 }));
    return FightLog.format(sim.history, glads).filter((l) => moves || l.kind !== "move");
  }, [spec, descs, sim, moves]);
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
