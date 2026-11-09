import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Opponent } from "../api";
import { Portrait } from "../swf/Portrait";
import { KitList } from "../ui/BruteKit";
import { InventoryControls, InventoryPanel, useInventorySettings } from "../ui/InventoryPanel";
import { useApi } from "../useApi";

// small line icons for the stat rows (24x24, drawn with the text colour)
const icon = (d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const STATS: [keyof Opponent["attributes"], string, ReactNode][] = [
  ["life", "Life (HP)", icon("M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z")],
  ["strength", "Strength", icon("M12.4 13A5 5 0 0 1 22 15c0 3.9-4 7-9 7-4 0-8.2-.8-10.4-2.5-.4-.3-.6-.8-.6-1.4C2.1 12.7 2.6 2 10 2a3 3 0 0 1 3 2c0 1.1-.9 2-2 2H9M15 14a5 5 0 0 0-7.6 2M10 6.8C8 8 9.5 13 8 15")],
  ["agility", "Agility", icon("M15 4.5a1.5 1.5 0 1 0 0-.01M7 21l3-6 3 2.5V22M5 12l3-3.5h5l2.5 4 3.5 1M10.5 15 9 9")],
  ["speed", "Speed", icon("M3 7h9M2 12h7M4 17h5M13 5h8l-8 14h8")],
];

export function OpponentsPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const cell = useApi(() => api.cell(id), [id]);
  // each visit (and each "Find new opponents") asks the server for a fresh list of eight
  const [round, setRound] = useState(0);
  const list = useApi(() => api.opponents(id), [id, round]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // one language / owned-only setting for all eight inventories, shown once in the header
  const inventory = useInventorySettings();

  const fight = async (o: Opponent) => {
    setBusy(o.offerId); setError(null);
    try {
      const r = await api.fight(id, o.offerId);
      nav(`/fights/${r.fightId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const b = cell.data?.brute;
  const blocked = b && (b.pendingLevelUp || b.fightsLeft === 0);
  return (
    <div className="page opponents">
      <header className="page-head">
        <div>
          <h1>Choose an opponent</h1>
          {b && <span className="muted">{b.name}, level {b.level}. {b.fightsLeft} of {b.dailyFights} fights left today.</span>}
        </div>
        <div className="row">
          <InventoryControls {...inventory} />
          <button type="button" className="btn ghost light" disabled={list.loading || !!busy} onClick={() => setRound((r) => r + 1)}>Find new opponents</button>
          <Link to={`/brutes/${id}`} className="btn ghost light">Back to the cell</Link>
        </div>
      </header>
      {(error || list.error || cell.error) && <p className="page-status error" role="alert">{error ?? list.error?.message ?? cell.error?.message}</p>}
      {blocked && (
        <p className="page-status" role="status">
          {b.pendingLevelUp ? <>Choose your level-up before fighting again. <Link to={`/brutes/${id}/level-up`}>Choose now</Link></> : "No fights left today. They come back at midnight, Bordeaux time."}
        </p>
      )}
      <ul className="opponent-grid" aria-busy={list.loading}>
        {list.data?.opponents.map((o) => (
          <li key={o.offerId} className="panel opponent">
            {/* left half: portrait + name + stats, then the kit, then Fight; right half: the inventory (inventory.swf) */}
            <div className="opponent-left">
              <div className="opponent-box opponent-head">
                <div className="opponent-portrait-box">
                  <Portrait gfx={o.gfx} name={o.name} flip className="opponent-portrait" />
                </div>
                <div className="opponent-id">
                  <h2 className="opponent-name">{o.name}</h2>
                  <span className="opponent-level">Level {o.level}</span>
                  <dl className="opponent-stats">
                    {STATS.map(([key, label, icon]) => (
                      <div key={key}><dt>{icon}{label}</dt><dd>{o.attributes[key]}</dd></div>
                    ))}
                  </dl>
                </div>
              </div>
              <div className="opponent-box opponent-kit">
                {Object.values(o.kit).some((x) => x.length) ? <KitList kit={o.kit} hideEmpty /> : <p className="muted">No weapons or skills yet</p>}
              </div>
              <button type="button" className="btn play opponent-fight" disabled={!!busy || !!blocked} onClick={() => fight(o)}>
                {busy === o.offerId ? "Fighting…" : `Fight ${o.name}`}
              </button>
            </div>
            <div className="opponent-box opponent-inv">
              <InventoryPanel brute={{ id: o.seedId, levelUps: o.levelUps, choices: o.choices, name: o.name }} settings={inventory} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

