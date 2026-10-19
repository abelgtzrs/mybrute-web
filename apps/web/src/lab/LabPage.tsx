import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  INVENTORY_LANGS, buildParams, describe, extractStats, importPayload, newLabFight, randomSeed, runFight, validateSpec,
  type Description, type FightSpec, type SpecBrute,
} from "@mybrute/engine";
import { registerEnd, swfUrl } from "../swf/ruffle";
import { CommitInput, parseIntStrict } from "../ui/CommitInput";
import { ArenaPanel, type Playback } from "./ArenaPanel";
import { Bench } from "./Bench";
import { BruteEditor } from "./BruteEditor";
import { PayloadDialog } from "./PayloadDialog";
import { initLab, labReducer } from "./state";
import { localLabStore, type SavedBrute } from "./storage";
import { VersusBoard } from "./VersusBoard";

const store = localLabStore;
/** Params meant to leave the app (copy/save) use the same conventions as the original lab folder. */
const portable = (spec: FightSpec) => buildParams(spec, { mini: "mini_perso.swf", end: "javascript:()" });
const fightLabel = (spec: FightSpec) => spec.brutes.map((b) => b.name).join(" vs ");

export function LabPage() {
  const [state, dispatch] = useReducer(labReducer, undefined, initLab);
  const { spec, selected } = state;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bench, setBench] = useState<SavedBrute[]>(() => store.listBrutes());
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>();

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  // client.swf opens this URL when the fight animation ends (registered in an effect so StrictMode's remount re-registers it)
  const [endUrl, setEndUrl] = useState("javascript:()");
  useEffect(() => {
    const end = registerEnd(() => setPlayback((p) => (p ? { ...p, ended: true } : p)));
    setEndUrl(end.url);
    return end.dispose;
  }, []);

  const descs = useMemo<(Description | null)[]>(
    () => spec.brutes.map((b) => { try { return describe(b.id, b.levelUps, b.choices); } catch { return null; } }),
    [spec.brutes],
  );
  const errors = useMemo(() => validateSpec(spec), [spec]);
  const sim = useMemo(() => {
    if (errors.length) return null;
    try { return runFight(spec); } catch { return null; }
  }, [spec, errors]);
  const stats = useMemo(() => (sim ? extractStats(sim) : null), [sim]);
  const problems = useMemo(() => {
    const s = new Set<number>();
    spec.brutes.forEach((b, i) => errors.some((e) => e.includes(b.name || `Brute ${b.id}`) || e.includes(String(b.id))) && s.add(i));
    return s;
  }, [spec.brutes, errors]);

  const play = () => {
    if (errors.length) return notify("Fix the problems listed under the arena first.");
    setPlayback({ params: buildParams(spec, { mini: swfUrl("mini_perso.swf"), end: endUrl }), nonce: Date.now(), snapshot: JSON.stringify(spec), ended: false });
  };

  const loadPayload = (params: string, label: string) => {
    const { spec: loaded } = importPayload(params);
    dispatch({ type: "load", spec: loaded, label });
    setPlayback(null);
    notify(`Opened ${label}.`);
  };

  const copyParams = () => {
    if (errors.length) return notify("Fix the problems listed under the arena first.");
    navigator.clipboard.writeText(portable(spec)).then(() => notify("Payload copied."), () => notify("Couldn't reach the clipboard."));
  };

  const savePayload = () => {
    if (errors.length) return notify("Fix the problems listed under the arena first.");
    const label = window.prompt("Name this fight", fightLabel(spec));
    if (label === null) return;
    try { store.savePayload(label.trim() || fightLabel(spec), portable(spec)); notify("Fight saved."); }
    catch (e) { notify((e as Error).message); }
  };

  const saveBrute = (b: SpecBrute) => {
    const label = window.prompt("Name this saved brute", `${b.name}, level ${b.levelUps + 1}`);
    if (label === null) return;
    try { store.saveBrute(label.trim() || b.name, b); setBench(store.listBrutes()); notify("Brute saved to the bench."); }
    catch (e) { notify((e as Error).message); }
  };

  const applyBenchBrute = (b: SpecBrute, team: 0 | 1 | null) => {
    if (team === null) {
      const index = spec.brutes.findIndex((x) => x.id === b.id);
      if (index < 0) return;
      const { team: _keepTeam, ...rest } = structuredClone(b);
      dispatch({ type: "updateBrute", index, patch: rest });
      dispatch({ type: "select", index });
      return notify(`Applied the saved state to ${b.name}.`);
    }
    dispatch({ type: "addBrute", brute: { ...structuredClone(b), team } });
  };

  const sel = selected !== null ? spec.brutes[selected] : undefined;

  return (
    <div className="lab">
      <div className="toolbar" role="toolbar" aria-label="Fight">
        <div className="toolbar-title">
          <h1>Laboratory</h1>
          <span className="muted">{state.sourceLabel}</span>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="btn ghost" onClick={() => { dispatch({ type: "load", spec: newLabFight(), label: "New fight" }); setPlayback(null); }}>New fight</button>
          <button type="button" className="btn ghost" onClick={() => setDialogOpen(true)}>Open fight</button>
          <button type="button" className="btn ghost" onClick={savePayload}>Save fight</button>
          <button type="button" className="btn ghost" onClick={copyParams}>Copy payload</button>
        </div>
        <div className="toolbar-fields">
          <label>Seed
            <span className="input-with-btn">
              <CommitInput value={spec.seed} inputMode="numeric" onCommit={(t) => { const v = parseIntStrict(t); if (v === null) return "The seed is a whole number."; dispatch({ type: "setFight", patch: { seed: v } }); }} />
              <button type="button" className="btn small ghost" onClick={() => dispatch({ type: "setFight", patch: { seed: randomSeed() } })}>Reroll</button>
            </span>
          </label>
          <label>Arena
            <CommitInput value={spec.arena} inputMode="numeric" className="short" onCommit={(t) => { const v = parseIntStrict(t); if (v === null || v < 0) return "Use 0 or more."; dispatch({ type: "setFight", patch: { arena: v } }); }} />
          </label>
          <label>Language
            <select value={spec.lang} onChange={(e) => dispatch({ type: "setFight", patch: { lang: e.target.value } })}>
              {[...new Set([spec.lang, ...INVENTORY_LANGS])].map((l) => <option key={l}>{l}</option>)}
            </select>
          </label>
          <button type="button" className="btn play" onClick={play} disabled={errors.length > 0}>Play fight</button>
        </div>
      </div>

      <VersusBoard spec={spec} descs={descs} selected={selected} problems={problems} dispatch={dispatch} />

      <div className="lab-grid">
        <div className="lab-main">
          {sel && selected !== null ? (
            <BruteEditor key={selected} index={selected} brute={sel} original={state.originals[selected]} desc={descs[selected]} spec={spec} dispatch={dispatch} onSave={saveBrute} />
          ) : (
            <section className="panel editor-empty"><p>Pick a brute above to edit its level, choices, look and inventory.</p></section>
          )}
          <Bench items={bench} takenIds={spec.brutes.map((b) => b.id)} onUse={applyBenchBrute}
            onDelete={(key) => { store.deleteBrute(key); setBench(store.listBrutes()); }} />
        </div>
        <ArenaPanel spec={spec} descs={descs} sim={sim} stats={stats} errors={errors} playback={playback} onPlay={play} notify={notify} />
      </div>

      <PayloadDialog open={dialogOpen} store={store} onClose={() => setDialogOpen(false)} onLoad={loadPayload} />
      <div className="toast" role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
