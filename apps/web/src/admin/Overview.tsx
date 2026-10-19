import { Link } from "react-router-dom";
import { admin } from "../api";
import { useApi } from "../useApi";
import { LogList } from "./kit";

export function AdminOverview() {
  const { data, error } = useApi(() => admin.overview(), []);
  if (error) return <p className="page-status error" role="alert">{error.message}</p>;
  if (!data) return <p className="page-status">Loading…</p>;
  const c = data.counts;
  const r = data.resultsToday;
  return (
    <div className="admin-overview">
      <section className="panel admin-counts-panel" aria-labelledby="ov-counts">
        <h2 id="ov-counts">The game today</h2>
        <dl className="admin-counts">
          <div><dt>Players</dt><dd>{c.users.toLocaleString()}</dd><dd className="small">{c.newUsers} new this week</dd></div>
          <div><dt>Brutes</dt><dd>{c.brutes.toLocaleString()}</dd><dd className="small">{c.pendingLevelUps} waiting for a level-up</dd></div>
          <div><dt>Fights today</dt><dd>{c.fightsToday.toLocaleString()}</dd><dd className="small">{r.win} won, {r.loss} lost, {r.draw} drawn</dd></div>
          <div><dt>All fights</dt><dd>{c.fights.toLocaleString()}</dd><dd className="small">{c.levelUps.toLocaleString()} level-ups chosen</dd></div>
          <div><dt>Signed in</dt><dd>{c.sessions.toLocaleString()}</dd><dd className="small">active sessions</dd></div>
          <div><dt>Admins</dt><dd>{c.admins}</dd><dd className="small"><Link to="/admin/players?filter=suspended">{c.suspended} suspended</Link></dd></div>
        </dl>
        <p className="hint">Days run on Bordeaux time; today is {data.day}. Each brute gets {data.settings.dailyFights} fights a day, and each player {data.settings.maxBrutesDefault} brutes unless set otherwise. <Link to="/admin/settings">Change the rules</Link></p>
      </section>

      <section className="panel admin-top" aria-labelledby="ov-top">
        <div className="section-head">
          <h2 id="ov-top">Highest levels</h2>
          <Link to="/admin/brutes?sort=level" className="small">All brutes</Link>
        </div>
        {data.topBrutes.length === 0 ? <p className="muted">No brutes yet.</p> : (
          <ol className="admin-rank">
            {data.topBrutes.map((b) => (
              <li key={b.id}>
                <Link to={`/admin/brutes/${b.id}`} className="admin-rank-name">{b.name}</Link>
                <span className="muted small">Level {b.level}, owned by <Link to={`/admin/players/${b.owner.id}`}>{b.owner.username}</Link></span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="panel admin-recent" aria-labelledby="ov-log">
        <div className="section-head">
          <h2 id="ov-log">Recent admin changes</h2>
          <Link to="/admin/log" className="small">Full log</Link>
        </div>
        <div className="admin-scroll"><LogList entries={data.recentLog} /></div>
      </section>
    </div>
  );
}
