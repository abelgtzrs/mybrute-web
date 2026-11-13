import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useApi } from "../useApi";
import { ResultBadge } from "./FightRow";
import { RankIcon } from "./Rank";

/** One tournament: opened rounds, the next opponent, and the final placing once everything is open. */
export function TournamentPage() {
  const { id = "", tid = "" } = useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const { data, error, setData } = useApi(() => api.bruteTournament(id, tid), [id, tid]);
  const cell = useApi(() => api.cell(id), [id]);

  if (error) return <div className="page"><p className="page-status error" role="alert">{error.message} <Link to={`/brutes/${id}`}>Back to the cell</Link></p></div>;
  if (!data) return <div className="page"><p className="page-status">Loading the tournament…</p></div>;
  const t = data.tournament;

  // Opening a round is what creates its fight, so Watch opens one and Skip opens them all.
  async function open(all: boolean) {
    setBusy(true); setFailure("");
    try {
      const r = await api.openRounds(id, tid, all);
      if (all) { setData({ tournament: r.tournament }); void cell.reload(); } // skipping pays XP, which may leave a level-up waiting
      else navigate(`/fights/${r.fightIds[0]}`);
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page history">
      <header className="page-head">
        <div>
          <h1>Tournament, {t.day}</h1>
          <span className="muted"><RankIcon rank={{ rank: t.rank, name: t.rankName }} /> {t.rankName}, {t.size}-brute bracket</span>
        </div>
        <Link to={`/brutes/${id}`} className="btn ghost light">Back to the cell</Link>
      </header>
      <section className="panel history-panel">
        {failure && <p className="field-error" role="alert">{failure}</p>}
        {t.placing && <p className="fight-verdict">{t.placing}</p>}
        {t.rounds.length > 0 && (
          <ul className="fight-list">
            {t.rounds.map((r) => (
              <li key={r.round} className="fight-row">
                <ResultBadge result={r.result} />
                <span className="fight-row-main">
                  <span>Round {r.round} vs <strong>{r.opponent.name}</strong> <span className="muted">(level {r.opponent.level})</span></span>
                </span>
                <Link to={`/fights/${r.fightId}`} className="btn small ghost">Watch</Link>
              </li>
            ))}
          </ul>
        )}
        {t.next && (
          <div className="fight-next">
            <p>Next: <strong>{t.next.opponent.name}</strong> <span className="muted">(level {t.next.opponent.level})</span></p>
            <div className="row">
              <button type="button" className="btn play" disabled={busy} onClick={() => open(false)}>Watch</button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => open(true)}>Skip to result</button>
            </div>
          </div>
        )}
        {cell.data?.brute.pendingLevelUp && (
          <p>Level-up waiting. <Link to={`/brutes/${id}/level-up`}>Choose your level-up</Link></p>
        )}
      </section>
    </div>
  );
}
