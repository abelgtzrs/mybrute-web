import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { admin, type AdminUserDetail } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { useListParams } from "./Layout";
import { AdminAction, day, LogList, Pager, SearchBox, Segments, useFlash, when } from "./kit";

export function RoleBadges({ u }: { u: { role: string; suspended: unknown } }) {
  return <>
    {u.role === "admin" && <span className="badge gold">Admin</span>}
    {u.suspended ? <span className="badge suspended">Suspended</span> : null}
  </>;
}

export function AdminPlayers() {
  const { values, page, set } = useListParams(["q", "filter"] as const);
  const { data, error, loading } = useApi(() => admin.users({ q: values.q, filter: values.filter, page }), [values.q, values.filter, page]);
  return (
    <section className="panel admin-list" aria-label="Players">
      <div className="admin-toolbar">
        <SearchBox value={values.q} onSearch={(q) => set({ q })} label="Search players" placeholder="Search by username" />
        <Segments label="Show" value={values.filter} onChange={(filter) => set({ filter })}
          options={[["", "Everyone"], ["admin", "Admins"], ["suspended", "Suspended"]]} />
      </div>
      {error && <p className="field-error" role="alert">{error.message}</p>}
      <div className="admin-scroll" aria-busy={loading}>
        <table className="admin-table">
          <thead><tr><th scope="col">Player</th><th scope="col" className="num">Brutes</th><th scope="col" className="num">Fights</th><th scope="col" className="num">Limit</th><th scope="col" className="wide">Joined</th><th scope="col" className="wide">Last sign-in</th></tr></thead>
          <tbody>
            {data?.users.map((u) => (
              <tr key={u.id}>
                <th scope="row"><Link to={`/admin/players/${u.id}`}>{u.username}</Link> <RoleBadges u={u} /></th>
                <td className="num">{u.brutes}</td>
                <td className="num">{u.fights.toLocaleString()}</td>
                <td className="num">{u.maxBrutes ?? <span className="muted">default</span>}</td>
                <td className="wide">{day(u.createdAt)}</td>
                <td className="wide">{when(u.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.users.length === 0 && <p className="muted admin-empty">No players match.</p>}
      </div>
      <Pager data={data} page={page} onPage={(p) => set({ page: p })} noun="players" />
    </section>
  );
}

export function AdminPlayer() {
  const { id = "" } = useParams();
  const { data, error, reload } = useApi(() => admin.user(id), [id]);
  const [flash, setFlash] = useFlash();
  const nav = useNavigate();
  if (error) return <p className="page-status error" role="alert">{error.message} <Link to="/admin/players">Back to players</Link></p>;
  if (!data) return <p className="page-status">Loading…</p>;
  const u = data.user;
  const done = (msg: string) => { setFlash(msg); void reload(); };

  return (
    <div className="admin-detail">
      <section className="panel admin-account" aria-labelledby="player-name">
        <div className="admin-account-head">
          <h2 id="player-name" className="admin-title">{u.username}</h2>
          <RoleBadges u={u} />
        </div>
        {u.suspended && <p className="warning">Suspended on {when(u.suspended.at)}{u.suspended.reason ? `: ${u.suspended.reason}` : "."}</p>}
        <dl className="admin-facts">
          <div><dt>Joined</dt><dd>{when(u.createdAt)}</dd></div>
          <div><dt>Last sign-in</dt><dd>{when(u.lastLoginAt)}</dd></div>
          <div><dt>Signed in on</dt><dd>{u.sessions} {u.sessions === 1 ? "device" : "devices"}</dd></div>
          <div><dt>Brutes</dt><dd>{u.brutes} of {u.effectiveMaxBrutes}{u.maxBrutes === null ? " (default)" : ""}</dd></div>
          <div><dt>Fights</dt><dd>{u.fights.toLocaleString()}</dd></div>
          <div><dt>Lab saves</dt><dd>{u.labBrutes} brutes, {u.labPayloads} payloads</dd></div>
        </dl>
        {flash}
        <h3>Change this account</h3>
        <PlayerActions u={u} done={done} onDeleted={() => nav("/admin/players", { replace: true })} />
      </section>

      <div className="admin-detail-side">
        <section className="panel admin-sub" aria-labelledby="player-brutes">
          <div className="section-head">
            <h2 id="player-brutes">Brutes</h2>
            {u.fights > 0 && <Link to={`/admin/fights?q=${encodeURIComponent(u.username)}`} className="small">Their fights</Link>}
          </div>
          <div className="admin-scroll">
            {data.brutes.length === 0 ? <p className="muted">No brutes.</p> : (
              <ul className="admin-brute-list">
                {data.brutes.map((b) => (
                  <li key={b.id}>
                    <Link to={`/admin/brutes/${b.id}`} className="admin-rank-name">{b.name}</Link>
                    <span className="muted small">
                      Level {b.level}, {b.xp}/{b.xpRequired} XP, {b.record.wins} wins in {b.record.fights} fights
                      {b.pendingLevelUp ? ", level-up waiting" : `, ${b.fightsLeft} fights left today`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className="panel admin-sub" aria-labelledby="player-log">
          <h2 id="player-log">Admin changes to this account</h2>
          <div className="admin-scroll"><LogList entries={data.log} empty="None yet." /></div>
        </section>
      </div>
    </div>
  );
}

function PlayerActions({ u, done, onDeleted }: { u: AdminUserDetail; done: (m: string) => void; onDeleted: () => void }) {
  const { user: me } = useAuth();
  const self = me?.id === u.id;
  const [reason, setReason] = useState("");
  const [limit, setLimit] = useState("");
  const [password, setPassword] = useState("");
  const limitValue = limit.trim() === "" ? null : Number(limit);
  const limitOk = limitValue === null || (Number.isInteger(limitValue) && limitValue >= 0 && limitValue <= 1000);

  return (
    <div className="admin-actions">
      {self && <p className="hint">This is your account. Another admin has to change its role, suspend it, reset its password or delete it.</p>}

      <div className="admin-action">
        <span><strong>Role</strong><span className="muted small">{u.role === "admin" ? "Can open these admin pages." : "A regular player."}</span></span>
        {u.role === "admin"
          ? <AdminAction label="Remove admin rights" title={`Remove admin rights from ${u.username}?`} confirmLabel="Remove admin rights" disabled={self}
              description={`${u.username} keeps the account and brutes but can't open the admin pages any more.`}
              onConfirm={async () => { await admin.setRole(u.id, "player"); return `${u.username} is no longer an admin.`; }} onDone={done} />
          : <AdminAction label="Make admin" title={`Make ${u.username} an admin?`} confirmLabel="Make admin" disabled={self || !!u.suspended}
              description={`${u.username} will be able to change any player, brute and game rule, like you can.`}
              onConfirm={async () => { await admin.setRole(u.id, "admin"); return `${u.username} is now an admin.`; }} onDone={done} />}
      </div>

      <div className="admin-action">
        <span><strong>Suspension</strong><span className="muted small">{u.suspended ? "Can't sign in." : "Can sign in and play."}</span></span>
        {u.suspended
          ? <AdminAction label="Lift suspension" title={`Lift ${u.username}'s suspension?`} confirmLabel="Lift suspension"
              description={`${u.username} will be able to sign in again with the same password.`}
              onConfirm={async () => { await admin.unsuspend(u.id); return `${u.username} can sign in again.`; }} onDone={done} />
          : <AdminAction label="Suspend" danger title={`Suspend ${u.username}?`} confirmLabel={`Suspend ${u.username}`} disabled={self || u.role === "admin"}
              description={`${u.username} is signed out everywhere and can't sign in until the suspension is lifted. Their brutes and fights are kept.`}
              onOpen={() => setReason("")}
              onConfirm={async () => { await admin.suspend(u.id, reason); return `${u.username} is suspended.`; }} onDone={done}>
              <label>Reason, shown to them when they try to sign in (optional)
                <input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
              </label>
            </AdminAction>}
      </div>

      <div className="admin-action">
        <span><strong>Brute limit</strong><span className="muted small">{u.maxBrutes === null ? `The default, ${u.effectiveMaxBrutes}.` : `${u.maxBrutes}, set for this player.`}</span></span>
        <AdminAction label="Change limit" title={`Brute limit for ${u.username}`} confirmLabel="Save limit" valid={limitOk}
          description="Leave it empty to use the default for everyone. A lower limit never deletes brutes; it only stops new ones."
          onOpen={() => setLimit(u.maxBrutes === null ? "" : String(u.maxBrutes))}
          onConfirm={async () => { await admin.setLimit(u.id, limitValue); return `Brute limit for ${u.username} saved.`; }} onDone={done}>
          <label>Brutes allowed
            <input type="number" min={0} max={1000} step={1} value={limit} placeholder="Default" onChange={(e) => setLimit(e.target.value)} />
          </label>
          {!limitOk && <p className="field-error">Enter a whole number from 0 to 1000, or leave it empty.</p>}
        </AdminAction>
      </div>

      <div className="admin-action">
        <span><strong>Password</strong><span className="muted small">Set a new one and give it to the player.</span></span>
        <AdminAction label="Reset password" title={`Reset ${u.username}'s password?`} confirmLabel="Set new password" disabled={self} valid={password.length >= 8}
          description={`${u.username} is signed out everywhere and has to use the new password.`}
          onOpen={() => setPassword("")}
          onConfirm={async () => { await admin.resetPassword(u.id, password); return `New password set for ${u.username}.`; }} onDone={done}>
          <label>New password (at least 8 characters)
            <input type="text" value={password} autoComplete="off" spellCheck={false} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </AdminAction>
      </div>

      <div className="admin-action">
        <span><strong>Sessions</strong><span className="muted small">Signed in on {u.sessions} {u.sessions === 1 ? "device" : "devices"}.</span></span>
        <AdminAction label="Sign out everywhere" title={`Sign ${u.username} out everywhere?`} confirmLabel="Sign out" disabled={self || u.sessions === 0}
          description={`${u.username} can sign in again straight away.`}
          onConfirm={async () => { const r = await admin.signOut(u.id); return `${u.username} was signed out of ${r.sessionsEnded} ${r.sessionsEnded === 1 ? "device" : "devices"}.`; }} onDone={done} />
      </div>

      <div className="admin-action">
        <span><strong>Delete account</strong><span className="muted small">Removes the account, its {u.brutes} {u.brutes === 1 ? "brute" : "brutes"}, their fights and its Lab saves.</span></span>
        <AdminAction label="Delete account" danger title={`Delete ${u.username}?`} confirmLabel={`Delete ${u.username}`} requireText={u.username} disabled={self || u.role === "admin"}
          description={`This can't be undone. The admin log keeps a line saying you deleted ${u.username}.`}
          onConfirm={async () => { await admin.deleteUser(u.id); return ""; }} onDone={onDeleted} />
      </div>
    </div>
  );
}
