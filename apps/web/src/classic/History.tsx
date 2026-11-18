import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useApi } from "../useApi";
import { FightRow } from "./FightRow";

const FILTERS: [string, string][] = [["", "All"], ["win", "Victories"], ["loss", "Defeats"], ["draw", "Draws"]];

/** Tournaments tab: one row per tournament; the placing shows only once every round is open. */
function TournamentList({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const { data, error } = useApi(() => api.bruteTournaments(id, page), [id, page]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      {error && <p className="field-error" role="alert">{error.message}</p>}
      {data && data.items.length === 0 && <p className="muted">No tournaments yet.</p>}
      {data && (
        <ul className="fight-list">
          {data.items.map((t) => (
            <li key={t.id} className="fight-row">
              <span className="fight-row-main">
                <span><strong>{t.day}</strong> <span className="muted">{t.rankName}, {t.size} brutes</span></span>
                <span className="muted small">{t.placing ?? "Open"}</span>
              </span>
              <Link to={`/brutes/${id}/tournaments/${t.id}`} className="btn small ghost">View</Link>
            </li>
          ))}
        </ul>
      )}
      {data && data.total > data.pageSize && (
        <div className="row pager">
          <button type="button" className="btn small ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</button>
          <span className="muted">Page {page} of {pages}</span>
          <button type="button" className="btn small ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Older</button>
        </div>
      )}
    </>
  );
}

export function HistoryPage() {
  const { id = "" } = useParams();
  const [search, setSearch] = useSearchParams();
  const tab = search.get("tab") === "tournaments" ? "tournaments" : "fights"; // in the URL so links can open a tab
  const [page, setPage] = useState(1);
  const [result, setResult] = useState("");
  const cell = useApi(() => api.cell(id), [id]);
  const { data, error, loading } = useApi(() => api.history(id, page, result || undefined), [id, page, result]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div className="page history">
      <header className="page-head">
        <div>
          <h1>Fight history</h1>
          {cell.data && <span className="muted">{cell.data.brute.name}, {cell.data.brute.record.fights} fights</span>}
        </div>
        <Link to={`/brutes/${id}`} className="btn ghost light">Back to the cell</Link>
      </header>
      <section className="panel history-panel">
        <div className="row" role="group" aria-label="History">
          <button type="button" className={"seg-btn" + (tab === "fights" ? " on" : "")} aria-pressed={tab === "fights"} onClick={() => setSearch({})}>Fights</button>
          <button type="button" className={"seg-btn" + (tab === "tournaments" ? " on" : "")} aria-pressed={tab === "tournaments"} onClick={() => setSearch({ tab: "tournaments" })}>Tournaments</button>
        </div>
        {tab === "tournaments" ? <TournamentList id={id} /> : (
          <>
            <div className="row" role="group" aria-label="Show">
              {FILTERS.map(([k, label]) => (
                <button key={k} type="button" className={"seg-btn" + (result === k ? " on" : "")} aria-pressed={result === k} onClick={() => { setResult(k); setPage(1); }}>{label}</button>
              ))}
            </div>
            {error && <p className="field-error" role="alert">{error.message}</p>}
            <div className="history-scroll" aria-busy={loading}>
              {data && data.fights.length === 0 && <p className="muted">No fights to show.</p>}
              {data && <ul className="fight-list">{data.fights.map((f) => <FightRow key={f.id} f={f} />)}</ul>}
            </div>
            {data && data.total > data.pageSize && (
              <div className="row pager">
                <button type="button" className="btn small ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</button>
                <span className="muted">Page {page} of {pages}</span>
                <button type="button" className="btn small ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Older</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
