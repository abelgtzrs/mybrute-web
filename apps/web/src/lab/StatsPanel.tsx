import { useState } from "react";
import type { EngineResult, FighterStats, FightSpec, PetStats } from "@mybrute/engine";
import { useNames } from "../ui/language";

type Row = [string, (s: FighterStats) => number | string];
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

// grouped like a brute's sheet; within a group, rows that are 0 for everyone hide unless "Show empty rows" is on
const GROUPS: [string, Row[]][] = [
  ["Damage", [
    ["Total dealt", (s) => s.totalDamageDealt],
    ["By the brute", (s) => s.damageDealt],
    ["By its pets", (s) => s.petDamageDealt],
    ["Best hit", (s) => s.highestHit],
    ["Taken", (s) => s.damageReceived],
    ["Taken from poison", (s) => s.poisonDamageReceived],
    ["Taken by its pets", (s) => s.petDamageReceived],
    ["Life restored", (s) => s.lifeRestored],
  ]],
  ["Attack", [
    ["Attacks", (s) => s.attacks],
    ["Hits", (s) => s.hits],
    ["Accuracy", (s) => pct(s.hits, s.attacks)],
    ["Dodged by opponent", (s) => s.attacksDodgedByOpponent],
    ["Blocked by opponent", (s) => s.attacksBlockedByOpponent],
    ["Counters", (s) => s.teamCounters.COUNTER],
    ["Ripostes", (s) => s.teamCounters.RIPOSTE],
  ]],
  ["Defense", [
    ["Dodges", (s) => s.dodges],
    ["Blocks", (s) => s.blocks],
  ]],
  ["Weapons", [
    ["Drawn", (s) => s.weaponsDrawn],
    ["Different weapons", (s) => s.weaponsUsed.length],
    ["Thrown", (s) => s.weaponsThrown],
    ["Thrown away", (s) => s.weaponsTrashed],
    ["Disarms", (s) => s.disarms],
    ["Times disarmed", (s) => s.timesDisarmed],
    ["Destroyed", (s) => s.weaponsDestroyed],
    ["Shields broken", (s) => s.shieldsBroken],
    ["Stolen", (s) => s.steals],
  ]],
  ["Supers", [
    ["Nets", (s) => s.nets],
    ["Grabs", (s) => s.grabs],
    ["Hypnosis", (s) => s.hypnosis],
    ["Bombs", (s) => s.bombs],
    ["Downpours", (s) => s.downpours],
    ["Potions", (s) => s.potions],
    ["Meals", (s) => s.meals],
  ]],
  ["Result", [
    ["Pets killed", (s) => s.petsKilled],
    ["Pets lost", (s) => s.petsLost],
    ["Enemy brutes down", (s) => s.enemyBrutesDown],
    ["Knocked out", (s) => (s.died ? "Yes" : "No")],
  ]],
];

interface Props { spec: FightSpec; sim: EngineResult | null; stats: Map<number, FighterStats> | null; pets: PetStats[]; errors: string[] }

/** The simulated fight's numbers: one column per brute, one row per statistic, then each pet. */
export function StatsPanel({ spec, sim, stats, pets, errors }: Props) {
  const [showEmpty, setShowEmpty] = useState(false);
  const { name } = useNames();
  if (errors.length || !sim || !stats) {
    return <section className="stats-col panel" aria-label="Statistics"><h2>Statistics</h2><p className="muted">The statistics appear once the fight can run.</p></section>;
  }
  const cols = spec.brutes.map((b) => [b, stats.get(b.id)] as const).filter((x): x is [typeof x[0], FighterStats] => !!x[1]);
  const shared = cols.some(([, s]) => s.teamShared);
  return (
    <section className="stats-col panel" aria-label="Statistics">
      <p className={"verdict" + (sim.win === null ? "" : ` team-${sim.win}`)}>
        {sim.win === null ? "Draw: the arena's 1000-action limit was reached." : `Team ${sim.win} wins`}
        <span className="muted"> in {sim.history.length} events</span>
      </p>
      <label className="check"><input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} /> Show empty rows</label>
      <div className="stats-scroll">
        <table className="vstats">
          <thead>
            <tr>
              <td />
              {cols.map(([b, s]) => <th key={b.id} scope="col" className={`team-${b.team}`} title={b.name}>{b.name}{s.result === "win" ? " ✓" : ""}</th>)}
            </tr>
          </thead>
          {GROUPS.map(([group, rows]) => {
            const shown = rows.filter(([, f]) => showEmpty || cols.some(([, s]) => { const v = f(s); return v !== 0 && v !== "–" && v !== "No"; }));
            return shown.length > 0 && (
              <tbody key={group}>
                <tr className="vstats-group"><th scope="rowgroup" colSpan={cols.length + 1}>{group}</th></tr>
                {shown.map(([label, f]) => (
                  <tr key={label}><th scope="row">{label}</th>{cols.map(([b, s]) => <td key={b.id}>{f(s)}</td>)}</tr>
                ))}
              </tbody>
            );
          })}
        </table>

        {pets.length > 0 && (
          <table className="vstats pets">
            <thead><tr><th scope="col">Pet</th><th scope="col">Dealt</th><th scope="col">Taken</th><th scope="col">Hits</th><th scope="col">KO</th></tr></thead>
            <tbody>
              {pets.map((p) => (
                <tr key={p.id} className={`team-${p.team}`}>
                  <th scope="row">{name("Followers", p.kind)} <span className="muted">T{p.team}{p.finalTeam !== p.team ? `→${p.finalTeam}` : ""}</span></th>
                  <td>{p.damageDealt}</td><td>{p.damageReceived}</td><td>{p.hits}/{p.attacks}</td><td>{p.died ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {shared && <p className="hint">With several brutes on a team, counters, ripostes and pet damage are team totals.</p>}
    </section>
  );
}
