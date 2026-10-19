import { Link } from "react-router-dom";
import { api } from "../api";
import { Portrait } from "../swf/Portrait";
import { FightPips, XpBar } from "../ui/BruteKit";
import { useApi } from "../useApi";

export function MyBrutesPage() {
  const { data, error, loading } = useApi(() => api.brutes(), []);
  const full = data ? data.brutes.length >= data.maxBrutes : false;
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>My brutes</h1>
          {data && <span className="muted">{data.brutes.length} of {data.maxBrutes} slots used</span>}
        </div>
        {data && (full
          ? <span className="muted">All slots are in use. Delete a brute from its cell to make room.</span>
          : <Link to="/brutes/new" className="btn play">Create a brute</Link>)}
      </header>
      {error && <p className="page-status error" role="alert">{error.message}</p>}
      {loading && !data && <p className="page-status">Loading your brutes…</p>}
      {data && data.brutes.length === 0 && (
        <section className="panel empty-state">
          <h2>Your first brute is waiting</h2>
          <p>Pick a name, an id and a look. Everything else comes from the original game's progression.</p>
          <Link to="/brutes/new" className="btn play">Create a brute</Link>
        </section>
      )}
      {data && data.brutes.length > 0 && (
        <ul className="roster">
          {data.brutes.map((b) => (
            <li key={b.id}>
              <Link to={`/brutes/${b.id}`} className={"roster-card" + (b.pendingLevelUp ? " pending" : "")}>
                <Portrait gfx={b.gfx} name={b.name} className="roster-portrait" />
                <span className="roster-text">
                  <span className="roster-name">{b.name}</span>
                  <span className="roster-level">Level {b.level}</span>
                  <XpBar xp={b.xp} required={b.xpRequired} />
                  {b.pendingLevelUp
                    ? <span className="badge gold">Level-up waiting</span>
                    : <FightPips left={b.fightsLeft} total={b.dailyFights} />}
                  <span className="roster-record">{b.record.wins} wins, {b.record.losses} losses{b.record.draws ? `, ${b.record.draws} draws` : ""}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
