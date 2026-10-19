import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, type User } from "./api";

interface AuthState {
  user: User | null;
  /** false until the first /me answer arrives */
  ready: boolean;
  refresh(): Promise<void>;
  login(username: string, password: string): Promise<void>;
  register(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    try { setUser((await api.me()).user); } catch { setUser(null); } finally { setReady(true); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const value: AuthState = {
    user, ready, refresh,
    login: async (u, p) => { await api.login(u, p); await refresh(); },
    register: async (u, p) => { await api.register(u, p); await refresh(); },
    logout: async () => { await api.logout().catch(() => {}); setUser(null); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

/** Shows children only to signed-in players; sends everyone else to sign in and back. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <p className="page-status">Loading…</p>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}
