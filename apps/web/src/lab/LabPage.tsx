// The desktop Laboratory: three columns (teams, editor, arena). All state and actions live in useLab;
// this file is only the layout. The phone version is mobile/MobileLabPage.tsx.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArenaPanel } from "./ArenaPanel";
import { ColumnResizers } from "./ColumnResizers";
import { Bench } from "./Bench";
import { BruteEditor } from "./BruteEditor";
import { FightFields } from "./FightFields";
import { PayloadDialog } from "./PayloadDialog";
import { ParametersDialog } from "./ParametersDialog";
import { VersusBoard } from "./VersusBoard";
import { editorTargets, useLab } from "./useLab";
import { setLabLayout } from "./layoutChoice";
import { BruteSizeControl, portraitScale, useBruteSize } from "../ui/BruteSize";

/** On narrow screens only one section shows at a time; wide screens show all three and ignore this. */
type Panel = "teams" | "editor" | "arena";
const PANELS: [Panel, string][] = [
  ["teams", "Teams"],
  ["editor", "Brute"],
  ["arena", "Arena"],
];
const PHONE = "(max-width: 699px)";
const BESIDE = "(min-width: 1100px)";
const HEIGHT_KEY = "mybrute.lab.editorHeight";

export function LabPage() {
  const [panel, setPanel] = useState<Panel>(() => (window.matchMedia(PHONE).matches ? "teams" : "editor"));
  const lab = useLab({ onShowEditor: () => setPanel("editor"), onShowArena: () => setPanel("arena") });
  const { state, spec, dispatch, draft, selected } = lab;
  const [dialogOpen, setDialogOpen] = useState(false);
  // from 1100px the editor sits beside the arena, so the Arena tab is the one showing
  const [editorBeside, setEditorBeside] = useState(() => window.matchMedia(BESIDE).matches);
  useEffect(() => {
    const mq = window.matchMedia(BESIDE);
    const on = () => setEditorBeside(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  // the fight takes the whole workspace; Esc or the Collapse button brings the lab back
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const on = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [expanded]);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState<number | null>(() => {
    try {
      const v = Number(localStorage.getItem(HEIGHT_KEY));
      return v > 0 ? v : null;
    } catch {
      return null;
    }
  });
  const changeEditorHeight = (h: number | null) => {
    setEditorHeight(h);
    try {
      if (h) localStorage.setItem(HEIGHT_KEY, String(h));
      else localStorage.removeItem(HEIGHT_KEY);
    } catch {
      /* still applies for this visit */
    }
  };
  const [size] = useBruteSize();
  const open = editorTargets(lab);

  return (
    <div className={lab.theme === "workbench" ? "lab" : "lab term"} data-theme={lab.theme} style={portraitScale(size)}>
      <div className="toolbar" role="toolbar" aria-label="Fight">
        <div className="toolbar-title">
          <h1>Laboratory</h1>
          <span className="muted">{state.sourceLabel}</span>
        </div>
        <div className="toolbar-actions">
          <BruteSizeControl />
          <button type="button" className="btn ghost" onClick={lab.newFight}>
            New fight
          </button>
          <button type="button" className="btn ghost" onClick={() => setDialogOpen(true)}>
            Open fight
          </button>
          <button type="button" className="btn ghost" onClick={lab.savePayload}>
            Save fight
          </button>
          <button type="button" className="btn ghost" onClick={lab.copyParams}>
            Copy payload
          </button>
          <ParametersDialog spec={spec} descs={lab.descs} stats={lab.stats} pets={lab.pets} errors={lab.errors} dispatch={dispatch} />
          {/* clears a remembered "desktop" choice, so phones go to the mobile Lab again */}
          <Link to="/lab/mobile" className="btn ghost" onClick={() => setLabLayout(null)}>
            Mobile Lab
          </Link>
        </div>
        <div className="toolbar-fields">
          <FightFields lab={lab} />
          <button type="button" className="btn play" onClick={lab.play} disabled={lab.errors.length > 0}>
            Play fight
          </button>
        </div>
      </div>

      <div className="workspace" data-panel={panel} data-expanded={expanded || undefined} ref={workspaceRef}>
        <ColumnResizers workspace={workspaceRef} />
        <div className="col col-teams">
          <VersusBoard
            spec={spec}
            descs={lab.descs}
            selected={selected}
            problems={lab.problems}
            dispatch={lab.act}
            editingSupport={draft?.kind === "support" ? draft.team : null}
            onEditSupport={lab.editSupport}
          />
          <Bench
            items={lab.bench}
            takenIds={spec.brutes.map((b) => b.id)}
            onUse={lab.applyBenchBrute}
            onEdit={lab.editBench}
            editing={draft?.kind === "bench" ? draft.item.key : null}
            where={lab.store.where}
            onNotify={lab.notify}
            onImport={lab.importToBench}
            onDelete={lab.deleteFromBench}
          />
        </div>
        <div className="col col-editor">
          {open ? (
            <BruteEditor
              key={open.key}
              brute={open.brute}
              original={open.original}
              desc={open.desc}
              lang={spec.lang}
              source={open.source}
              takenIds={open.takenIds}
              update={open.update}
              onReset={open.onReset}
              teamCount={open.teamCount}
              onRemove={open.onRemove}
              onClose={open.onClose}
              saveTargets={open.saveTargets}
              onSaveTo={lab.saveTo}
              height={editorHeight}
              onHeight={changeEditorHeight}
            />
          ) : (
            <section className="panel editor-empty">
              <p>Pick a brute, a bench save or a support brute to edit it here.</p>
            </section>
          )}
        </div>
        <div className="col col-arena">
          <ArenaPanel
            spec={spec}
            descs={lab.descs}
            sim={lab.sim}
            stats={lab.stats}
            pets={lab.pets}
            errors={lab.errors}
            playback={lab.playback}
            onPlay={lab.play}
            notify={lab.notify}
            expanded={expanded}
            onToggleExpand={() => setExpanded((x) => !x)}
          />
        </div>
      </div>

      <nav className="panel-tabs" aria-label="Lab sections">
        {PANELS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            data-for={key}
            aria-pressed={panel === key || (key === "arena" && editorBeside)}
            onClick={() => {
              setExpanded(false);
              setPanel(key);
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <PayloadDialog open={dialogOpen} store={lab.store} onClose={() => setDialogOpen(false)} onLoad={lab.loadPayload} />
      <div className="toast" role="status" aria-live="polite">
        {lab.toast}
      </div>
    </div>
  );
}
