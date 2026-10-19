import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";

function AuthForm({ mode }: { mode: "login" | "register" }) {
  const auth = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next")?.startsWith("/") && !params.get("next")?.startsWith("//") ? params.get("next")! : "/brutes";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.ready && auth.user) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (mode === "login") await auth.login(username.trim(), password);
      else await auth.register(username.trim(), password);
      nav(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const isLogin = mode === "login";
  return (
    <div className="auth-page">
      <form className="panel auth-card" onSubmit={submit}>
        <h1>{isLogin ? "Sign in" : "Create an account"}</h1>
        <p className="muted">{isLogin ? "Welcome back to the arena." : "Your account holds your brutes, their fights and your Lab saves."}</p>
        <label>Username
          <input value={username} autoComplete="username" required minLength={3} maxLength={24} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label>Password
          <input type="password" value={password} autoComplete={isLogin ? "current-password" : "new-password"} required minLength={isLogin ? 1 : 8} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {!isLogin && <p className="hint">Usernames are 3 to 24 letters, numbers, - or _. Passwords need at least 8 characters.</p>}
        {error && <p className="field-error" role="alert">{error}</p>}
        <button type="submit" className="btn play" disabled={busy}>{isLogin ? "Sign in" : "Create account"}</button>
        <p className="auth-switch">
          {isLogin ? <>New here? <Link to={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link></> : <>Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></>}
        </p>
      </form>
    </div>
  );
}

export const LoginPage = () => <AuthForm mode="login" />;
export const RegisterPage = () => <AuthForm mode="register" />;
