import { NavLink, Route, Routes, Link } from "react-router-dom";
import { LabPage } from "./lab/LabPage";

export function App() {
  return (
    <div className="app">
      <header className="masthead">
        <Link to="/" className="wordmark">MyBrute<span>++</span></Link>
        <nav aria-label="Main">
          <NavLink to="/lab">Laboratory</NavLink>
          <span className="nav-soon" title="Classic mode is the next phase">Classic</span>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lab" element={<LabPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

function Home() {
  return (
    <section className="home">
      <h1>The original arena, rebuilt around the real engine.</h1>
      <p>
        Every fight here runs on La Brute's own combat code and plays in its original Flash client.
        The Laboratory lets you rebuild any brute from its id and level-up choices, set up team fights and replay historical battles.
      </p>
      <div className="row">
        <Link to="/lab" className="btn play">Open the Laboratory</Link>
      </div>
      <p className="muted">Classic mode, with accounts, daily training and authentic level-ups, comes next.</p>
    </section>
  );
}

function NotFound() {
  return (
    <section className="home">
      <h1>There's nothing at this address.</h1>
      <p><Link to="/lab">Go to the Laboratory</Link></p>
    </section>
  );
}
