import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { describe, isValidSeedId, randomGfx, randomLabId } from "@mybrute/engine";
import { api } from "../api";
import { useAuth } from "../auth";
import { Portrait } from "../swf/Portrait";
import { AttributeRow } from "../ui/BruteKit";
import { GfxEditor } from "../ui/GfxEditor";

export function CreateBrutePage() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [name, setName] = useState("");
  const [idText, setIdText] = useState(() => String(randomLabId()));
  const [gfx, setGfx] = useState(() => randomGfx());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const seedId = /^\d+$/.test(idText) ? Number(idText) : NaN;
  const validId = isValidSeedId(seedId);
  // a new brute is level 1: its starting attributes come from its id alone
  const start = useMemo(() => (validId ? describe(seedId, 0, []).fin : null), [seedId, validId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validId) return setError("The id is a whole number from 1 to 2147483647.");
    setBusy(true); setError(null);
    try {
      const { brute } = await api.createBrute({ name: name.trim(), seedId, gfx });
      await refresh();
      nav(`/brutes/${brute.id}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className="page create" onSubmit={submit}>
      <header className="page-head">
        <div>
          <h1>Create a brute</h1>
          <span className="muted">Choose carefully: the id and the look are permanent once you confirm.</span>
        </div>
        <Link to="/brutes" className="btn ghost light">Cancel</Link>
      </header>
      <div className="create-grid">
        <section className="panel create-preview" aria-label="Preview">
          <Portrait gfx={gfx} name={name || "your brute"} lazy={false} className="create-portrait" />
          <p className="create-name">{name.trim() || "Unnamed"}</p>
          <p className="muted">Level 1</p>
          {start && <AttributeRow a={{ strength: start.force, agility: start.agility, speed: start.speed, life: start.life }} compact />}
        </section>
        <section className="panel create-form" aria-label="Details">
          <label>Name
            <input value={name} required minLength={2} maxLength={20} autoFocus placeholder="2 to 20 characters" onChange={(e) => setName(e.target.value)} />
          </label>
          <label>Id
            <span className="input-with-btn">
              <input value={idText} inputMode="numeric" aria-invalid={!validId} className={validId ? "" : "invalid"} onChange={(e) => setIdText(e.target.value.trim())} />
              <button type="button" className="btn small ghost" onClick={() => setIdText(String(randomLabId()))}>Random</button>
            </span>
          </label>
          <p className="hint">The id decides everything the original game will offer this brute at each level-up. Any id from 1 to 2147483647 works, including historical ones.</p>
          <h2>Appearance</h2>
          <GfxEditor gfx={gfx} onChange={setGfx} />
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="row">
            <button type="submit" className="btn play" disabled={busy || !validId || name.trim().length < 2}>Create brute</button>
          </div>
        </section>
      </div>
    </form>
  );
}
