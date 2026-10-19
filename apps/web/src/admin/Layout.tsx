import type { ReactNode } from "react";
import { Navigate, NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";

const TABS: [string, string][] = [
  ["/admin", "Overview"], ["/admin/players", "Players"], ["/admin/brutes", "Brutes"],
  ["/admin/fights", "Fights"], ["/admin/settings", "Settings"], ["/admin/log", "Log"],
];

/** Admin pages only: players see a not-found page, visitors are sent to sign in. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <p className="page-status">Loading…</p>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (user.role !== "admin") return <div className="page"><p className="page-status error" role="alert">Only admins can open this page.</p></div>;
  return <>{children}</>;
}

export function AdminLayout() {
  return (
    <div className="page admin">
      <header className="page-head">
        <div>
          <h1>Admin</h1>
          <span className="muted">Classic mode. Every change is recorded in the log.</span>
        </div>
        <nav className="admin-tabs" aria-label="Admin sections">
          {TABS.map(([to, label]) => <NavLink key={to} to={to} end={to === "/admin"}>{label}</NavLink>)}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}

/** List state (search, filters, page) lives in the address, so Back returns to the same list. */
export function useListParams<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ""])) as Record<K, string>;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const set = (patch: Partial<Record<K | "page", string | number>>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === "" || v === undefined || v === 1 && k === "page") next.delete(k); else next.set(k, String(v));
    }
    // any change other than the page goes back to the first page
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };
  return { values, page, set };
}
