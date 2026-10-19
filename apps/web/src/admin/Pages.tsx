// Fights, game settings and the full admin log.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { admin } from "../api";
import { ResultBadge } from "../classic/FightRow";
import { useApi } from "../useApi";
import { useListParams } from "./Layout";
import { LogList, Pager, SearchBox, Segments, useFlash, when } from "./kit";

export function AdminFights() {
  const { values, page, set } = useListParams(["q", "result", "brute"] as const);
  const { data, error, loading } = useApi(() => admin.fights({ q: values.q, result: values.result, brute: values.brute, page }), [values.q, values.result, values.brute, page]);
  const bruteName = values.brute && data?.fights[0]?.brute.id === values.brute ? data.fights[0].brute.name : null;
  return (
    <section className="panel admin-list" aria-label="Fights">
      <div className="admin-toolbar">
        <SearchBox value={values.q} onSearch={(q) => set({ q })} label="Search fights" placeholder="Brute, owner or opponent id" />
        <Segments label="Result" value={values.result} onChange={(result) => set({ result })}
          options={[["", "All"], ["win", "Victories"], ["loss", "Defeats"], ["draw", "Draws"]]} />
        {values.brute && (
          <span className="admin-chip">Only {bruteName ?? "one brute"} <button type="button" className="link" onClick={() => set({ brute: "" })}>Show all</button></span>
        )}
      </div>
      {error && <p className="field-error" role="alert">{error.message}</p>}
      <div className="admin-scroll" aria-busy={loading}>
        <table className="admin-table">
          <thead><tr><th scope="col">Result</th><th scope="col">Brute</th><th scope="col" className="wide">Owner</th><th scope="col">Opponent</th><th scope="col" className="num wide">XP</th><th scope="col" className="num wide">Dealt / taken</th><th scope="col" className="wide">When</th><th scope="col"><span className="sr-only">Watch</span></th></tr></thead>
          <tbody>
            {data?.fights.map((f) => (
              <tr key={f.id}>
                <td><ResultBadge result={f.result} /></td>
                <th scope="row"><Link to={`/admin/brutes/${f.brute.id}`}>{f.brute.name}</Link> <span className="muted small">lv {f.level}</span></th>
                <td className="wide"><Link to={`/admin/players/${f.owner.id}`}>{f.owner.username}</Link></td>
                <td>{f.opponent.name} <span className="muted small">lv {f.opponent.level}</span></td>
                <td className="num wide">+{f.xpAwarded}</td>
                <td className="num wide">{f.damageDealt} / {f.damageReceived}</td>
                <td className="wide">{when(f.createdAt)}</td>
                <td><Link to={`/admin/fights/${f.id}`} className="btn small ghost">Watch</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.fights.length === 0 && <p className="muted admin-empty">No fights match.</p>}
      </div>
      <Pager data={data} page={page} onPage={(p) => set({ page: p })} noun="fights" />
    </section>
  );
}

export function AdminSettings() {
  const { data, error, setData } = useApi(() => admin.settings(), []);
  const [form, setForm] = useState({ maxBrutesDefault: "", dailyFights: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [flash, setFlash] = useFlash();
  useEffect(() => {
    if (data) setForm({ maxBrutesDefault: String(data.settings.maxBrutesDefault), dailyFights: String(data.settings.dailyFights) });
  }, [data]);
  if (error) return <p className="page-status error" role="alert">{error.message}</p>;
  if (!data) return <p className="page-status">Loading…</p>;

  const parse = (v: string, max: number) => { const n = Number(v); return v.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= max ? n : null; };
  const brutes = parse(form.maxBrutesDefault, data.limits.maxBrutes);
  const fights = parse(form.dailyFights, data.limits.dailyFights);
  const changed = brutes !== data.settings.maxBrutesDefault || fights !== data.settings.dailyFights;
  const save = async () => {
    if (brutes === null || fights === null) return;
    setSaving(true); setSaveError(null);
    try {
      const r = await admin.saveSettings({ maxBrutesDefault: brutes, dailyFights: fights });
      setData({ ...data, settings: r.settings });
      setFlash("Settings saved. They apply from the next request.");
    } catch (e) { setSaveError((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <section className="panel admin-settings" aria-labelledby="settings-title">
      <h2 id="settings-title">Game rules</h2>
      <form className="admin-settings-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label>
          <span className="admin-field-name">Brutes per player</span>
          <input type="number" min={0} max={data.limits.maxBrutes} step={1} value={form.maxBrutesDefault} onChange={(e) => setForm({ ...form, maxBrutesDefault: e.target.value })} />
          <span className="hint">For every player without their own limit (set one on the player's page). Lowering it never deletes brutes.</span>
          {brutes === null && <span className="field-error">A whole number from 0 to {data.limits.maxBrutes}.</span>}
        </label>
        <label>
          <span className="admin-field-name">Fights per brute per day</span>
          <input type="number" min={0} max={data.limits.dailyFights} step={1} value={form.dailyFights} onChange={(e) => setForm({ ...form, dailyFights: e.target.value })} />
          <span className="hint">Applies straight away, including to fights already used today. Days reset at midnight, Bordeaux time.</span>
          {fights === null && <span className="field-error">A whole number from 0 to {data.limits.dailyFights}.</span>}
        </label>
        {saveError && <p className="field-error" role="alert">{saveError}</p>}
        <div className="row">
          <button type="submit" className="btn play" disabled={saving || !changed || brutes === null || fights === null}>Save rules</button>
          {flash}
        </div>
      </form>
      <p className="hint">The XP curve, rewards and combat come from the original game and can't be changed here. To make someone an admin, open their page under <Link to="/admin/players">Players</Link>.</p>
    </section>
  );
}

export function AdminLog() {
  const { values, page, set } = useListParams(["kind"] as const);
  const { data, error, loading } = useApi(() => admin.log({ kind: values.kind, page }), [values.kind, page]);
  return (
    <section className="panel admin-list" aria-label="Admin log">
      <div className="admin-toolbar">
        <Segments label="Show" value={values.kind} onChange={(kind) => set({ kind })}
          options={[["", "Everything"], ["user", "Players"], ["brute", "Brutes"], ["settings", "Settings"]]} />
      </div>
      {error && <p className="field-error" role="alert">{error.message}</p>}
      <div className="admin-scroll" aria-busy={loading}>{data && <LogList entries={data.entries} />}</div>
      <Pager data={data} page={page} onPage={(p) => set({ page: p })} noun="changes" />
    </section>
  );
}
