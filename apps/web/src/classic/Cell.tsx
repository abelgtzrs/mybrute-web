import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { hexToChoices } from "@mybrute/engine";
import { api, type Cell } from "../api";
import { useAuth } from "../auth";
import { Portrait } from "../swf/Portrait";
import { AttributeRow, FightPips, KitList, XpBar } from "../ui/BruteKit";
import { InventoryPanel } from "../ui/InventoryPanel";
import { BruteSizeControl, portraitScale, useBruteSize } from "../ui/BruteSize";
import { GfxEditor } from "../ui/GfxEditor";
import { useApi } from "../useApi";
import { useNames } from "../ui/language";
import { FightRow, ResultBadge } from "./FightRow";

/** Narrow screens show one part at a time: the brute, its kit and level-ups, or its record. */
type Panel = "brute" | "kit" | "record";
const PHONE = "(max-width: 699px)";

export function CellPage() {
  const { id = "" } = useParams();
  const { data, error, reload } = useApi(() => api.cell(id), [id]);
  const { option, lang } = useNames();
  const [panel, setPanel] = useState<Panel>(() => (window.matchMedia(PHONE).matches ? "brute" : "kit"));
  const [size] = useBruteSize();
  const { user } = useAuth();
  if (error) return <div className="page"><p className="page-status error" role="alert">{error.message} <Link to="/brutes">Back to my brutes</Link></p></div>;
  if (!data) return <div className="page"><p className="page-status">Loading the cell…</p></div>;
  const b = data.brute;
  const labBrute = { name: b.name, id: b.seedId, team: 0 as const, levelUps: b.levelUps, gfx: b.gfx, choices: hexToChoices(data.bits, b.levelUps) };

  return (
    <div className="page cell" style={portraitScale(size)}>
      <div className="cell-grid" data-panel={panel}>
        <section className="panel cell-identity" aria-label={`${b.name}`}>
          <Portrait gfx={b.gfx} name={b.name} lazy={false} className="cell-portrait" />
          <h1 className="cell-name">{b.name}</h1>
          <p className="cell-level">Level {b.level}</p>
          <XpBar xp={b.xp} required={b.xpRequired} />
          <div className="cell-action">
            {b.pendingLevelUp ? (
              <Link to={`/brutes/${b.id}/level-up`} className="btn play gold">Choose your level-up</Link>
            ) : b.fightsLeft > 0 ? (
              <Link to={`/brutes/${b.id}/fight`} className="btn play">Fight</Link>
            ) : (
              <p className="muted">No fights left today. They come back at midnight, Bordeaux time.</p>
            )}
            <FightPips left={b.fightsLeft} total={b.dailyFights} />
            <span className="muted small">{b.fightsLeft} of {b.dailyFights} fights left today</span>
          </div>
          <dl className="record">
            <div><dt>Wins</dt><dd>{b.record.wins}</dd></div>
            <div><dt>Losses</dt><dd>{b.record.losses}</dd></div>
            <div><dt>Draws</dt><dd>{b.record.draws}</dd></div>
            <div><dt>Win rate</dt><dd>{b.record.fights ? `${Math.round((b.record.wins / b.record.fights) * 100)}%` : "–"}</dd></div>
          </dl>
          <div className="cell-links">
            <Link to={`/brutes/${b.id}/history`}>Fight history</Link>
            {user?.role === "admin" && <Link to="/lab" state={{ brute: labBrute }}>Try a copy in the Lab</Link>}
            <ChangeAppearance cell={data} onSaved={reload} />
            <DeleteBrute cell={data} />
          </div>
          <BruteSizeControl />
        </section>

        <div className="col cell-main">
          {/* one section: attributes, kit and level-up log on the left; the inventory fills the right side */}
          <section className="panel cell-card" aria-label="Attributes, level-ups and inventory">
            <div className="cell-card-info">
              <h2>Attributes</h2>
              <AttributeRow a={data.attributes} />
              <KitList kit={data.kit} />
              {!data.check && <p className="warning">The progression check failed for this brute. Please report it.</p>}
              <h2 id="levels-title" className="cell-levels-title">Level-ups</h2>
              {data.levelUps.length === 0 ? <p className="muted">No level-ups yet. Win fights to earn experience.</p> : (
                <ol className="levelup-log" aria-labelledby="levels-title">
                  {[...data.levelUps].reverse().map((l) => (
                    <li key={l.index}>
                      <span className="lv">Lv {l.level}</span>
                      <span className={"opt-pill" + (l.chosen.t === "b" ? ` kind-${l.chosen.kind}` : "")}>{option(l.chosen)}</span>
                      <span className="muted small">instead of {option(l.other)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <InventoryPanel brute={labBrute} defaultLang={lang} />
          </section>
        </div>

        <div className="col cell-side">
          <section className="panel cell-stats" aria-labelledby="stats-title">
            <h2 id="stats-title">Statistics</h2>
            <LifetimeStats l={data.lifetime} />
          </section>
          <section className="panel cell-recent" aria-labelledby="recent-title">
            <div className="section-head">
              <h2 id="recent-title">Recent fights</h2>
              <Link to={`/brutes/${b.id}/history`} className="small">All fights</Link>
            </div>
            {data.recentFights.length === 0 ? <p className="muted">No fights yet.</p> : (
              <ul className="fight-list">{data.recentFights.map((f) => <FightRow key={f.id} f={f} />)}</ul>
            )}
          </section>
        </div>
      </div>
      <nav className="panel-tabs cell-tabs" aria-label="Cell sections">
        {([["brute", "Brute"], ["kit", "Kit"], ["record", "Record"]] as [Panel, string][]).map(([k, label]) => (
          <button key={k} type="button" data-for={k} aria-pressed={panel === k} onClick={() => setPanel(k)}>{label}</button>
        ))}
      </nav>
    </div>
  );
}

const STAT_GROUPS: [string, [string, string][]][] = [
  ["Damage", [["damageDealt", "Damage dealt"], ["petDamageDealt", "Damage dealt by pets"], ["totalDamageDealt", "Total damage dealt"],
    ["avgDealt", "Average dealt per fight"], ["bestFightDamage", "Most dealt in one fight"], ["highestHit", "Best single hit"],
    ["damageReceived", "Damage taken"], ["avgReceived", "Average taken per fight"]]],
  ["Defence", [["dodges", "Dodges"], ["blocks", "Blocks"], ["counter", "Counter-attacks"], ["riposte", "Ripostes"], ["lifeRestored", "Life restored"]]],
  ["Weapons", [["weaponsDrawn", "Weapons drawn"], ["weaponsThrown", "Weapons thrown"], ["disarms", "Disarms"], ["timesDisarmed", "Times disarmed"],
    ["weaponsDestroyed", "Weapons destroyed"], ["shieldsBroken", "Shields broken"], ["steals", "Weapons stolen"]]],
  ["Specials", [["nets", "Nets thrown"], ["grabs", "Grabs"], ["hypnosis", "Hypnosis"], ["bombs", "Bombs"], ["downpours", "Downpours"], ["potions", "Potions"]]],
  ["Opponents", [["enemyBrutesDown", "Opponents defeated"], ["petsKilled", "Pets killed"], ["petsLost", "Pets lost"], ["xpFromFights", "Experience earned"]]],
];

function LifetimeStats({ l }: { l: Record<string, number> }) {
  if (!l.fights) return <p className="muted">Statistics appear after the first fight.</p>;
  const v: Record<string, number> = { ...l, avgDealt: Math.round(l.totalDamageDealt / l.fights), avgReceived: Math.round(l.damageReceived / l.fights) };
  return (
    <div className="lifetime">
      {STAT_GROUPS.map(([title, rows]) => (
        <table key={title} className="lifetime-table">
          <caption>{title}</caption>
          <tbody>{rows.map(([k, label]) => <tr key={k}><th scope="row">{label}</th><td>{(v[k] ?? 0).toLocaleString()}</td></tr>)}</tbody>
        </table>
      ))}
      <p className="hint">Bomb and downpour damage isn't included: the original fight log doesn't say whom they hit.</p>
    </div>
  );
}

function ChangeAppearance({ cell, onSaved }: { cell: Cell; onSaved: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [gfx, setGfx] = useState(cell.brute.gfx);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api.changeAppearance(cell.brute.id, gfx); ref.current?.close(); onSaved(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  if (!cell.canChangeAppearance) return <span className="muted small">Appearance already changed once.</span>;
  return (
    <>
      <button type="button" className="link" onClick={() => { setGfx(cell.brute.gfx); setError(null); ref.current?.showModal(); }}>Change appearance</button>
      <dialog ref={ref} className="dialog" aria-labelledby="appearance-title">
        <form method="dialog" className="dialog-body" onSubmit={save}>
          <h2 id="appearance-title">Change {cell.brute.name}'s appearance</h2>
          <p className="muted">{isAdmin ? "As an admin you can change this as often as you like." : "You can change the appearance once, so choose carefully."}</p>
          <Portrait gfx={gfx} name={cell.brute.name} lazy={false} className="cell-portrait" />
          <GfxEditor gfx={gfx} onChange={setGfx} />
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="row">
            <button type="submit" className="btn play" disabled={busy || gfx === cell.brute.gfx}>Save appearance</button>
            <button type="button" className="btn ghost" onClick={() => ref.current?.close()}>Cancel</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function DeleteBrute({ cell }: { cell: Cell }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();
  const { refresh } = useAuth();
  const name = cell.brute.name;
  const confirm = async () => {
    try { await api.deleteBrute(cell.brute.id); await refresh(); nav("/brutes", { replace: true }); }
    catch (e) { setError((e as Error).message); }
  };
  return (
    <>
      <button type="button" className="link danger-link" onClick={() => { setTyped(""); setError(null); ref.current?.showModal(); }}>Delete this brute</button>
      <dialog ref={ref} className="dialog" aria-labelledby="delete-title">
        <form method="dialog" className="dialog-body" onSubmit={(e) => { e.preventDefault(); void confirm(); }}>
          <h2 id="delete-title">Delete {name}?</h2>
          <p>{name} and all {cell.brute.record.fights} recorded fights will be gone for good. This frees one brute slot.</p>
          <label>Type the brute's name to confirm
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="row">
            <button type="submit" className="btn danger solid" disabled={typed.trim() !== name}>Delete {name}</button>
            <button type="button" className="btn ghost" onClick={() => ref.current?.close()}>Keep {name}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export { ResultBadge };
