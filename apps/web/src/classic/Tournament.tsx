import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { tournoiParams, tournoiSize } from "@mybrute/engine";
import { api, type TournamentView } from "../api";
import { useAuth } from "../auth";
import { swfUrl } from "../swf/ruffle";
import { SwfPlayer } from "../swf/SwfPlayer";
import { useApi } from "../useApi";
import { ResultBadge } from "./FightRow";
import { AdminBruteLabel, RankIcon } from "./Rank";

/** The original bracket SWF. Clicking VS opens .../watch/<round>, which sends the player to that round's fight. */
function BracketSwf({ t, bracket, brutePath }: { t: TournamentView; bracket: NonNullable<TournamentView["bracket"]>; brutePath: string }) {
  const { user } = useAuth();
  // New params (after Watch or Skip) reload the player, so only rebuild them when the bracket really changes
  const params = useMemo(
    () => tournoiParams(bracket, { perso: swfUrl("perso.swf"), fightPrefix: `${brutePath}/tournaments/${t.id}/watch/`, user: user?.username ?? "", league: t.rank }),
    [bracket, brutePath, t.id, t.rank, user?.username],
  );
  const { width, height } = tournoiSize(t.size);
  // The SWF has a fixed pixel size (noScale), so a narrow screen scrolls this box, not the page
  return (
    <div className="tournoi-box">
      <SwfPlayer swf="tournoi.swf" params={params} label="Tournament bracket" allowScript className="tournoi" style={{ width, height }} />
    </div>
  );
}

/** Where the bracket's VS click lands: straight into that round's fight, or back to the bracket if the round isn't opened. */
export function TournamentWatchRedirect() {
  const { id = "", tid = "", round = "" } = useParams();
  const { data, error } = useApi(() => api.bruteTournament(id, tid), [id, tid]);
  const back = `/brutes/${id}/tournaments/${tid}`;
  if (error) return <Navigate to={back} replace />;
  if (!data) return <div className="page"><p className="page-status">Opening the fight…</p></div>;
  const fight = data.tournament.rounds.find((r) => r.round === Number(round));
  return <Navigate to={fight ? `/fights/${fight.fightId}` : back} replace />;
}

/** One tournament: the full bracket (revealed round by round), opened rounds, the next opponent, and the final placing once everything is open. */
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
      // Watch names the round it wants, so a double click or stale tab can't open the one after it
      const r = await api.openRounds(id, tid, all ? { all: true } : { round: t.roundsOpened + 1 });
      if (all || !r.fightIds[0]) { setData({ tournament: r.tournament }); void cell.reload(); } // skipping pays XP, which may leave a level-up waiting
      else navigate(`/fights/${r.fightIds[0]}`);
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page history tournament">
      <header className="page-head">
        <div>
          <h1>Tournament, {t.day}</h1>
          <span className="muted"><RankIcon rank={{ rank: t.rank, name: t.rankName }} /> {t.rankName}, {t.size}-brute bracket{cell.data?.brute.adminBrute && <> <AdminBruteLabel /></>}</span>
        </div>
        <Link to={`/brutes/${id}`} className="btn ghost light">Back to the cell</Link>
      </header>
      <section className="panel history-panel">
        {failure && <p className="field-error" role="alert">{failure}</p>}
        {t.placing && <p className="fight-verdict">{t.placing}</p>}
        {t.bracket && <BracketSwf t={t} bracket={t.bracket} brutePath={`/brutes/${id}`} />}
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
