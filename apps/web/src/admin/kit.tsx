// Shared pieces of the admin screens: search, filters, paging, confirmation dialogs and audit-log lines.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LogEntry, Paged } from "../api";

export const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never");
export const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });

/** A search box that reports what was typed once typing pauses. */
export function SearchBox({ value, onSearch, label, placeholder }: { value: string; onSearch: (q: string) => void; label: string; placeholder: string }) {
  const [text, setText] = useState(value);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => onSearch(text.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <label className="admin-search">
      <span className="sr-only">{label}</span>
      <input type="search" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
    </label>
  );
}

export function Segments<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="row admin-segs" role="group" aria-label={label}>
      {options.map(([k, text]) => (
        <button key={k} type="button" className={"seg-btn" + (value === k ? " on" : "")} aria-pressed={value === k} onClick={() => onChange(k)}>{text}</button>
      ))}
    </div>
  );
}

export function Pager({ data, page, onPage, noun }: { data: Paged | null; page: number; onPage: (p: number) => void; noun: string }) {
  if (!data) return null;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="row pager admin-pager">
      <span className="muted small">{data.total.toLocaleString()} {noun}</span>
      {pages > 1 && <>
        <button type="button" className="btn small ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="muted small">Page {page} of {pages}</span>
        <button type="button" className="btn small ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </>}
    </div>
  );
}

interface ActionProps {
  /** the button that opens the dialog */
  label: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** the dialog's confirm button stays disabled until this exact text is typed */
  requireText?: string;
  /** false keeps the confirm button disabled (invalid field values) */
  valid?: boolean;
  disabled?: boolean;
  onOpen?: () => void;
  /** does the change; the returned text is shown as the outcome */
  onConfirm: () => Promise<string>;
  onDone: (message: string) => void;
}

/** A button that opens a confirmation dialog for one admin change. */
export function AdminAction(p: ActionProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = () => { setTyped(""); setError(null); p.onOpen?.(); ref.current?.showModal(); };
  const confirm = async () => {
    setBusy(true); setError(null);
    try { const msg = await p.onConfirm(); ref.current?.close(); p.onDone(msg); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const blocked = busy || p.valid === false || (p.requireText !== undefined && typed.trim() !== p.requireText);
  return (
    <>
      <button type="button" className={"btn small " + (p.danger ? "danger" : "ghost")} disabled={p.disabled} onClick={open}>{p.label}</button>
      <dialog ref={ref} className="dialog" aria-label={p.title}>
        <form method="dialog" className="dialog-body" onSubmit={(e) => { e.preventDefault(); if (!blocked) void confirm(); }}>
          <h2>{p.title}</h2>
          {p.description && <p>{p.description}</p>}
          {p.children}
          {p.requireText !== undefined && (
            <label>Type <strong>{p.requireText}</strong> to confirm
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </label>
          )}
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="row">
            <button type="submit" className={"btn " + (p.danger ? "danger solid" : "play")} disabled={blocked}>{p.confirmLabel}</button>
            <button type="button" className="btn ghost" onClick={() => ref.current?.close()}>Cancel</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** The outcome of the last admin change on this page. */
export function useFlash() {
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(t);
  }, [flash]);
  const node = <p className="admin-flash" role="status">{flash ?? ""}</p>;
  return [node, setFlash] as const;
}

// ---------------------------------------------------------------- log

const SETTING_NAMES: Record<string, string> = { max_brutes_default: "the default brute limit", daily_fights: "daily fights" };
const s = (v: unknown) => (v === null || v === undefined ? "the default" : String(v));

function Target({ e }: { e: LogEntry }) {
  const gone = e.action.endsWith(".delete");
  if (e.target.kind === "settings" || gone || !e.target.id) return <strong>{e.target.label}</strong>;
  const to = e.target.kind === "user" ? `/admin/players/${e.target.id}` : `/admin/brutes/${e.target.id}`;
  return <Link to={to}>{e.target.label}</Link>;
}

/** One log entry as a sentence. */
export function LogText({ e }: { e: LogEntry }) {
  const d = e.detail;
  const t = <Target e={e} />;
  switch (e.action) {
    case "user.grant_admin": return <>made {t} an admin</>;
    case "user.revoke_admin": return <>removed admin rights from {t}</>;
    case "user.suspend": return <>suspended {t}{d.reason ? <> ({String(d.reason)})</> : null}</>;
    case "user.unsuspend": return <>lifted the suspension of {t}</>;
    case "user.set_limit": return <>set the brute limit of {t} to {s(d.to)}</>;
    case "user.reset_password": return <>reset the password of {t}</>;
    case "user.sign_out": return <>signed {t} out everywhere</>;
    case "user.delete": return <>deleted the account {t} ({String(d.brutes)} brutes)</>;
    case "brute.set_xp": return <>set the XP of {t} from {String(d.from)} to {String(d.to)}</>;
    case "brute.reset_fights": return <>gave {t} back today's fights</>;
    case "brute.rename": return <>renamed {String(d.from)} to {t}</>;
    case "brute.transfer": return <>moved {t} from {String(d.from)} to {String(d.to)}</>;
    case "brute.undo_level_up": return <>undid the level {String(d.level)} reward of {t}{d.undone ? <> ({String(d.undone)})</> : null}</>;
    case "brute.delete": return <>deleted {t}, owned by {String(d.owner)}</>;
    case "settings.set": return <>changed {SETTING_NAMES[e.target.label] ?? e.target.label} from {s(d.from)} to {s(d.to)}</>;
    default: return <>{e.action} on {t}</>;
  }
}

export function LogList({ entries, empty = "No admin changes yet." }: { entries: LogEntry[]; empty?: string }) {
  if (!entries.length) return <p className="muted">{empty}</p>;
  return (
    <ol className="admin-log">
      {entries.map((e) => (
        <li key={e.id}>
          <span className="admin-log-text"><strong>{e.admin.username}</strong> <LogText e={e} /></span>
          <time className="muted small" dateTime={e.at}>{when(e.at)}</time>
        </li>
      ))}
    </ol>
  );
}
