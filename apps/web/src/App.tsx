import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { AdminBrute, AdminBrutes } from "./admin/Brutes";
import { AdminLayout, RequireAdmin } from "./admin/Layout";
import { AdminOverview } from "./admin/Overview";
import { AdminFights, AdminLog, AdminSettings } from "./admin/Pages";
import { AdminPlayer, AdminPlayers } from "./admin/Players";
import { RequireAuth, useAuth } from "./auth";
import { LoginPage, RegisterPage } from "./classic/AuthPages";
import { CellPage } from "./classic/Cell";
import { CreateBrutePage } from "./classic/CreateBrute";
import { FightPage } from "./classic/FightView";
import { HistoryPage } from "./classic/History";
import { LevelUpPage } from "./classic/LevelUp";
import { MyBrutesPage } from "./classic/MyBrutes";
import { OpponentsPage } from "./classic/Opponents";
import { LabPage } from "./lab/LabPage";

export function App() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="app">
      <header className="masthead">
        <Link to="/" className="wordmark">MyBrute<span>++</span></Link>
        <nav aria-label="Main">
          <NavLink to="/brutes"><span className="nav-long">My brutes</span><span className="nav-short">Brutes</span></NavLink>
          <NavLink to="/lab"><span className="nav-long">Laboratory</span><span className="nav-short">Lab</span></NavLink>
          {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
          {user ? (
            <span className="account">
              <span className="muted">{user.username}</span>
              <button type="button" className="link" onClick={async () => { await logout(); nav("/"); }}>Sign out</button>
            </span>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lab" element={<LabPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/brutes" element={<RequireAuth><MyBrutesPage /></RequireAuth>} />
          <Route path="/brutes/new" element={<RequireAuth><CreateBrutePage /></RequireAuth>} />
          <Route path="/brutes/:id" element={<RequireAuth><CellPage /></RequireAuth>} />
          <Route path="/brutes/:id/fight" element={<RequireAuth><OpponentsPage /></RequireAuth>} />
          <Route path="/brutes/:id/level-up" element={<RequireAuth><LevelUpPage /></RequireAuth>} />
          <Route path="/brutes/:id/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
          <Route path="/fights/:fightId" element={<RequireAuth><FightPage /></RequireAuth>} />
          <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<AdminOverview />} />
            <Route path="players" element={<AdminPlayers />} />
            <Route path="players/:id" element={<AdminPlayer />} />
            <Route path="brutes" element={<AdminBrutes />} />
            <Route path="brutes/:id" element={<AdminBrute />} />
            <Route path="fights" element={<AdminFights />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="log" element={<AdminLog />} />
          </Route>
          <Route path="/admin/fights/:fightId" element={<RequireAdmin><FightPage admin /></RequireAdmin>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

function Home() {
  const { user } = useAuth();
  return (
    <section className="home">
      <h1>The original arena, rebuilt around the real engine.</h1>
      <p>
        Every fight here runs on La Brute's own combat code and plays in its original Flash client.
        Raise brutes in Classic mode with ten training fights a day and authentic level-up choices, or experiment freely in the Laboratory.
      </p>
      <div className="row">
        <Link to={user ? "/brutes" : "/register"} className="btn play">{user ? "Go to my brutes" : "Create an account"}</Link>
        <Link to="/lab" className="btn ghost light">Open the Laboratory</Link>
      </div>
    </section>
  );
}

function NotFound() {
  return (
    <section className="home">
      <h1>There's nothing at this address.</h1>
      <p><Link to="/">Go to the start page</Link></p>
    </section>
  );
}
