import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { hexToChoices } from "@mybrute/engine";
import { admin, type Cell } from "../api";
import { FightRow } from "../classic/FightRow";
import { Portrait } from "../swf/Portrait";
import { AttributeRow, KitList, XpBar } from "../ui/BruteKit";
import { useApi } from "../useApi";
import { useListParams } from "./Layout";
import { AdminAction, day, LogList, Pager, SearchBox, Segments, useFlash } from "./kit";

export function AdminBrutes() {
  const { values, page, set } = useListParams(["q", "filter", "sort"] as const);
  const { data, error, loading } = useApi(() => admin.brutes({ q: values.q, filter: values.filter, sort: values.sort, page }), [values.q, values.filter, values.sort, page]);
  return (
    <section className="panel admin-list" aria-label="Brutes">
      <div className="admin-toolbar">
        <SearchBox value={values.q} onSearch={(q) => set({ q })} label="Search brutes" placeholder="Name, brute id or owner" />
        <Segments label="Show" value={values.filter} onChange={(filter) => set({ filter })} options={[["", "All brutes"], ["pending", "Level-up waiting"]]} />
        <Segments label="Order" value={values.sort} onChange={(sort) => set({ sort })} options={[["", "Newest"], ["level", "Highest level"], ["name", "Name"]]} />
      </div>
      {error && <p className="field-error" role="alert">{error.message}</p>}
      <div className="admin-scroll" aria-busy={loading}>
        <table className="admin-table">
          <thead><tr><th scope="col">Brute</th><th scope="col">Owner</th><th scope="col" className="num">Level</th><th scope="col" className="num">XP</th><th scope="col" className="num wide">Fights left today</th><th scope="col" className="num">Fights</th><th scope="col" className="wide">Created</th></tr></thead>
          <tbody>
            {data?.brutes.map((b) => (
              <tr key={b.id}>
                <th scope="row"><Link to={`/admin/brutes/${b.id}`}>{b.name}</Link> {b.pendingLevelUp && <span className="badge gold">Level-up</span>}</th>
                <td><Link to={`/admin/players/${b.owner.id}`}>{b.owner.username}</Link></td>
                <td className="num">{b.level}</td>
                <td className="num">{b.xp}/{b.xpRequired}</td>
                <td className="num wide">{b.fightsLeft}</td>
                <td className="num">{b.fights.toLocaleString()}</td>
                <td className="wide">{day(b.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.brutes.length === 0 && <p className="muted admin-empty">No brutes match.</p>}
      </div>
      <Pager data={data} page={page} onPage={(p) => set({ page: p })} noun="brutes" />
    </section>
  );
}

export function AdminBrute() {
  const { id = "" } = useParams();
  const { data, error, reload } = useApi(() => admin.brute(id), [id]);
  const [flash, setFlash] = useFlash();
  const nav = useNavigate();
  if (error) return <p className="page-status error" role="alert">{error.message} <Link to="/admin/brutes">Back to brutes</Link></p>;
  if (!data) return <p className="page-status">Loading…</p>;
  const b = data.brute;
  const labBrute = { name: b.name, id: b.seedId, team: 0 as const, levelUps: b.levelUps, gfx: b.gfx, choices: hexToChoices(data.bits, b.levelUps) };
  const done = (msg: string) => { setFlash(msg); void reload(); };

  return (
    <div className="admin-brute">
      <section className="panel cell-identity" aria-label={b.name}>
        <Portrait gfx={b.gfx} name={b.name} lazy={false} className="cell-portrait" />
        <h2 className="cell-name">{b.name}</h2>
        <span className="muted small">Brute id {b.seedId}</span>
        <p className="cell-level">Level {b.level}, owned by <Link to={`/admin/players/${data.owner.id}`}>{data.owner.username}</Link></p>
        <XpBar xp={b.xp} required={b.xpRequired} />
        {b.pendingLevelUp ? <span className="badge gold">Level-up waiting</span> : <span className="muted small">{b.fightsLeft} of {b.dailyFights} fights left today</span>}
        <dl className="record">
          <div><dt>Wins</dt><dd>{b.record.wins}</dd></div>
          <div><dt>Losses</dt><dd>{b.record.losses}</dd></div>
          <div><dt>Draws</dt><dd>{b.record.draws}</dd></div>
          <div><dt>Win rate</dt><dd>{b.record.fights ? `${Math.round((b.record.wins / b.record.fights) * 100)}%` : "–"}</dd></div>
        </dl>
        <div className="cell-links">
          <Link to={`/admin/fights?brute=${b.id}`}>All fights</Link>
          <Link to="/lab" state={{ brute: labBrute }}>Try a copy in the Lab</Link>
        </div>
      </section>

      <section className="panel admin-brute-kit" aria-label="Attributes and level-ups">
        <h2>Attributes</h2>
        <AttributeRow a={data.attributes} />
        <KitList kit={data.kit} />
        {!data.check && <p className="warning">The progression check failed for this brute.</p>}
        <h2 id="admin-levels" className="cell-levels-title">Level-ups</h2>
        {data.levelUps.length === 0 ? <p className="muted">No level-ups yet.</p> : (
          <ol className="levelup-log" aria-labelledby="admin-levels">
            {[...data.levelUps].reverse().map((l) => (
              <li key={l.index}>
                <span className="lv">Lv {l.level}</span>
                <span className={"opt-pill" + (l.chosen.t === "b" ? ` kind-${l.chosen.kind}` : "")}>{l.chosen.text}</span>
                <span className="muted small">instead of {l.other.text}</span>
              </li>
            ))}
          </ol>
        )}
        {data.pendingOptions && <p className="hint">Waiting for {data.owner.username} to choose: {data.pendingOptions[0].text} or {data.pendingOptions[1].text}.</p>}
      </section>

      <div className="admin-detail-side">
        <section className="panel admin-sub" aria-labelledby="brute-actions">
          <h2 id="brute-actions">Change this brute</h2>
          {flash}
          <BruteActions data={data} done={done} onDeleted={() => nav(`/admin/players/${data.owner.id}`, { replace: true })} />
        </section>
        <section className="panel admin-sub" aria-labelledby="brute-recent">
          <div className="section-head">
            <h2 id="brute-recent">Recent fights</h2>
            <Link to={`/admin/fights?brute=${b.id}`} className="small">All fights</Link>
          </div>
          <div className="admin-scroll">
            {data.recentFights.length === 0 ? <p className="muted">No fights yet.</p> : (
              <ul className="fight-list">{data.recentFights.map((f) => <FightRow key={f.id} f={f} watch={`/admin/fights/${f.id}`} />)}</ul>
            )}
          </div>
        </section>
        <section className="panel admin-sub" aria-labelledby="brute-log">
          <h2 id="brute-log">Admin changes</h2>
          <div className="admin-scroll"><LogList entries={data.log} empty="None yet." /></div>
        </section>
      </div>
    </div>
  );
}

function BruteActions({ data, done, onDeleted }: { data: Cell & { owner: { id: string; username: string } }; done: (m: string) => void; onDeleted: () => void }) {
  const b = data.brute;
  const [xp, setXp] = useState("");
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const xpValue = Number(xp);
  const xpOk = xp.trim() !== "" && Number.isInteger(xpValue) && xpValue >= 0 && xpValue <= 1_000_000;
  const last = data.levelUps[data.levelUps.length - 1];
  const usedToday = b.dailyFights - b.fightsLeft;

  return (
    <div className="admin-actions">
      <div className="admin-action">
        <span><strong>Experience</strong><span className="muted small">{b.xp} of {b.xpRequired} XP for level {b.level + 1}.</span></span>
        <AdminAction label="Set XP" title={`Set ${b.name}'s XP`} confirmLabel="Save XP" valid={xpOk}
          description={`At ${b.xpRequired} XP or more, ${b.name} has to choose a level-up before fighting again, as usual.`}
          onOpen={() => setXp(String(b.xp))}
          onConfirm={async () => { const r = await admin.setXp(b.id, xpValue); return `${b.name} now has ${xpValue} XP${r.pendingLevelUp ? " and a level-up waiting" : ""}.`; }} onDone={done}>
          <label>XP
            <input type="number" min={0} step={1} value={xp} onChange={(e) => setXp(e.target.value)} />
          </label>
        </AdminAction>
      </div>

      <div className="admin-action">
        <span><strong>Today's fights</strong><span className="muted small">{usedToday} of {b.dailyFights} used.</span></span>
        <AdminAction label="Give fights back" title={`Give ${b.name} back today's fights?`} confirmLabel="Give fights back" disabled={usedToday === 0}
          description={`${b.name} gets all ${b.dailyFights} fights for the rest of today. Recorded fights and XP stay as they are.`}
          onConfirm={async () => { await admin.resetFights(b.id); return `${b.name} has ${b.dailyFights} fights left today.`; }} onDone={done} />
      </div>

      <div className="admin-action">
        <span><strong>Last level-up</strong><span className="muted small">{last ? `Level ${last.level}: ${last.chosen.text}.` : "None yet."}</span></span>
        <AdminAction label="Undo" danger title={`Undo ${b.name}'s level ${last?.level ?? ""} reward?`} confirmLabel="Undo level-up" disabled={!last}
          description={last ? <>
            {b.name} goes back to level {b.level - 1} and gets back the XP the level-up cost. The same two options ({last.chosen.text} or {last.other.text}) are offered again, because offers only depend on earlier choices. Opponents already found are dropped.
          </> : undefined}
          onConfirm={async () => { await admin.undoLevelUp(b.id); return `${b.name} is back to level ${b.level - 1}, with the level-up waiting.`; }} onDone={done} />
      </div>

      <div className="admin-action">
        <span><strong>Name</strong><span className="muted small">Players can't rename brutes. Use this for names that break the rules.</span></span>
        <AdminAction label="Rename" title={`Rename ${b.name}`} confirmLabel="Rename" valid={name.trim().length >= 2}
          onOpen={() => setName(b.name)}
          onConfirm={async () => { await admin.rename(b.id, name.trim()); return `${b.name} is now called ${name.trim()}.`; }} onDone={done}>
          <label>New name (2 to 20 letters, numbers, spaces, - or _)
            <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
          </label>
        </AdminAction>
      </div>

      <div className="admin-action">
        <span><strong>Owner</strong><span className="muted small">{data.owner.username}</span></span>
        <AdminAction label="Move" title={`Move ${b.name} to another player`} confirmLabel="Move brute" valid={owner.trim().length > 0}
          description="The brute keeps its level, XP and fights. The new owner can go over their brute limit."
          onOpen={() => setOwner("")}
          onConfirm={async () => { await admin.transfer(b.id, owner.trim()); return `${b.name} now belongs to ${owner.trim()}.`; }} onDone={done}>
          <label>Username of the new owner
            <input value={owner} autoComplete="off" onChange={(e) => setOwner(e.target.value)} />
          </label>
        </AdminAction>
      </div>

      <div className="admin-action">
        <span><strong>Delete brute</strong><span className="muted small">Removes it and its {b.record.fights} fights. Frees a slot for {data.owner.username}.</span></span>
        <AdminAction label="Delete" danger title={`Delete ${b.name}?`} confirmLabel={`Delete ${b.name}`} requireText={b.name}
          description="This can't be undone."
          onConfirm={async () => { await admin.deleteBrute(b.id); return ""; }} onDone={onDeleted} />
      </div>
    </div>
  );
}
