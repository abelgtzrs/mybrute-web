import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { describe, displayLevel, isValidSeedId, randomChoices, randomGfx, randomLabId } from "@mybrute/engine";
import { api } from "../api";
import { useAuth } from "../auth";
import { accountLabStore, browserLabStore, type SavedBrute } from "../lab/storage";
import { useApi } from "../useApi";
import { Portrait } from "../swf/Portrait";
import { AttributeRow } from "../ui/BruteKit";
import { GfxEditor } from "../ui/GfxEditor";

export function CreateBrutePage() {
  const nav = useNavigate();
  const { refresh, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [name, setName] = useState("");
  const [idText, setIdText] = useState(() => String(randomLabId()));
  const [gfx, setGfx] = useState(() => randomGfx());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Lab saves from the account and from this browser; an import keeps the saved id, so its choices mean the same
  const [saved, setSaved] = useState<SavedBrute[]>([]);
  useEffect(() => {
    void Promise.all([accountLabStore.listBrutes().catch(() => []), browserLabStore.listBrutes()]).then(([a, b]) => setSaved([...a, ...b]));
  }, []);
  const cap = useApi(() => api.brutes(), []).data?.maxImportLevel ?? 1;
  const [source, setSource] = useState<SavedBrute | null>(null);
  const [levelText, setLevelText] = useState("1");
  // admins may start any brute at any level (the server's cap); a fresh brute's level-up choices are random
  const [randomPicks] = useState(() => randomChoices(499));
  const maxLevel = source ? Math.min(cap, displayLevel(source.brute.levelUps)) : isAdmin ? cap : 1;
  const level = /^\d+$/.test(levelText) ? Number(levelText) : NaN;
  const validLevel = level >= 1 && level <= maxLevel;
  const levelUps = validLevel ? level - 1 : 0;
  const choices = source ? source.brute.choices.slice(0, levelUps) : randomPicks.slice(0, levelUps);
  const importFrom = (key: string) => {
    const s = saved.find((x) => x.key === key) ?? null;
    setSource(s);
    if (!s) return setLevelText("1");
    setName(s.brute.name.slice(0, 20));
    setIdText(String(s.brute.id));
    setGfx(s.brute.gfx);
    setLevelText(String(Math.min(cap, displayLevel(s.brute.levelUps))));
  };

  const seedId = /^\d+$/.test(idText) ? Number(idText) : NaN;
  const validId = isValidSeedId(seedId);
  // a new brute is level 1 and its starting attributes come from its id alone; an import also replays its choices
  const start = useMemo(() => (validId ? describe(seedId, levelUps, choices).fin : null), [seedId, validId, levelUps, choices.join("")]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validId) return setError("The id is a whole number from 1 to 2147483647.");
    setBusy(true); setError(null);
    try {
      const { brute } = await api.createBrute({ name: name.trim(), seedId, gfx, levelUps, choices });
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
          <p className="muted">Level {levelUps + 1}</p>
          {start && <AttributeRow a={{ strength: start.force, agility: start.agility, speed: start.speed, life: start.life }} compact />}
        </section>
        <section className="panel create-form" aria-label="Details">
          {saved.length > 0 && (
            <div className="create-import">
              <label>Start from a Lab brute
                <select value={source?.key ?? ""} onChange={(e) => importFrom(e.target.value)}>
                  <option value="">No, start fresh</option>
                  {saved.map((s) => <option key={s.key} value={s.key}>{s.label} (level {displayLevel(s.brute.levelUps)})</option>)}
                </select>
              </label>
              {source && <p className="hint">{maxLevel > 1
                ? `Its level-up choices are replayed up to the level you pick, from 1 to ${maxLevel}${cap < displayLevel(source.brute.levelUps) ? " (the highest level allowed for imports)" : ""}.`
                : "Imports start at level 1 for now. It keeps this brute's id and look, and you make its level-up choices again as it levels."}</p>}
            </div>
          )}
          {(source || isAdmin) && (
            <label>Level
              <input value={levelText} inputMode="numeric" className={validLevel ? "" : "invalid"} aria-invalid={!validLevel} onChange={(e) => setLevelText(e.target.value.trim())} />
            </label>
          )}
          {!source && isAdmin && <p className="hint">As an admin you can start this brute at any level up to {cap}. Its level-up choices are random; its id still decides what the game offers at each level.</p>}
          <label>Name
            <input value={name} required minLength={2} maxLength={20} autoFocus placeholder="2 to 20 characters" onChange={(e) => setName(e.target.value)} />
          </label>
          <label>Id
            <span className="input-with-btn">
              <input value={idText} inputMode="numeric" readOnly={!!source} aria-invalid={!validId} className={validId ? "" : "invalid"} onChange={(e) => setIdText(e.target.value.trim())} />
              <button type="button" className="btn small ghost" disabled={!!source} onClick={() => setIdText(String(randomLabId()))}>Random</button>
            </span>
          </label>
          <p className="hint">The id decides everything the original game will offer this brute at each level-up. Any id from 1 to 2147483647 works, including historical ones.</p>
          <h2>Appearance</h2>
          <GfxEditor gfx={gfx} onChange={setGfx} />
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="row">
            <button type="submit" className="btn play" disabled={busy || !validId || !validLevel || name.trim().length < 2}>Create brute</button>
          </div>
        </section>
      </div>
    </form>
  );
}
