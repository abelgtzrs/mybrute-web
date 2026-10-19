import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Opponent } from "../api";
import { Portrait } from "../swf/Portrait";
import { AttributeRow, KitList } from "../ui/BruteKit";
import { useApi } from "../useApi";

export function OpponentsPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const cell = useApi(() => api.cell(id), [id]);
  // each visit (and each "Find new opponents") asks the server for a fresh list of eight
  const [round, setRound] = useState(0);
  const list = useApi(() => api.opponents(id), [id, round]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            <Portrait gfx={o.gfx} name={o.name} flip className="opponent-portrait" />
            <div className="opponent-text">
              <h2 className="opponent-name">{o.name}</h2>
              <span className="muted">Level {o.level}</span>
            </div>
            <AttributeRow a={o.attributes} compact />
            <KitList kit={o.kit} hideEmpty />
            <button type="button" className="btn play" disabled={!!busy || !!blocked} onClick={() => fight(o)}>
              {busy === o.offerId ? "Fighting…" : `Fight ${o.name}`}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
