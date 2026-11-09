import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import {
  INVENTORY_LANGS,
  bitsToHex,
  buildParams,
  describe,
  extractPetStats,
  extractStats,
  hexToChoices,
  importPayload,
  newLabFight,
  randomSeed,
  runFight,
  supportOf,
  validateSpec,
  type Description,
  type FightSpec,
  type SpecBrute,
} from "@mybrute/engine";
import { registerEnd, swfUrl } from "../swf/ruffle";
import { CommitInput, parseIntStrict } from "../ui/CommitInput";
import { ArenaPanel, type Playback } from "./ArenaPanel";
import { ColumnResizers } from "./ColumnResizers";
import { Bench } from "./Bench";
import { BruteEditor, type SaveTarget } from "./BruteEditor";
import { PayloadDialog } from "./PayloadDialog";
import { ParametersDialog } from "./ParametersDialog";
import { initLab, labReducer, patchBrute } from "./state";
import { useLabStore, type SavedBrute } from "./storage";
import { useLanguage } from "../ui/language";
import { VersusBoard } from "./VersusBoard";
import { BruteSizeControl, portraitScale, useBruteSize } from "../ui/BruteSize";

/** Params meant to leave the app (copy/save) use the same conventions as the original lab folder. */
const portable = (spec: FightSpec) =>
  buildParams(spec, { mini: "mini_perso.swf", end: "javascript:()" });
/** Arena ids offered in the Arena dropdown. */
const ARENA_IDS = Array.from({ length: 10 }, (_, i) => i);
const fightLabel = (spec: FightSpec) =>
  spec.brutes.map((b) => b.name).join(" vs ");

/** On narrow screens only one section shows at a time; wide screens show all three and ignore this. */
type Panel = "teams" | "editor" | "arena";
const PANELS: [Panel, string][] = [
  ["teams", "Teams"],
  ["editor", "Brute"],
  ["arena", "Arena"],
];
const PHONE = "(max-width: 699px)";
const BESIDE = "(min-width: 1100px)";

/** A bench save or a team's support brute open in the editor; changes stay here until saved. */
type Draft = { key: string; brute: SpecBrute; original: SpecBrute } & (
  | { kind: "bench"; item: SavedBrute }
  | { kind: "support"; team: 0 | 1 }
);
const toSupport = (b: SpecBrute) => ({
  _s: b.id,
  _lvl: b.levelUps,
  _bits: bitsToHex(b.choices, b.levelUps),
  _gfx: b.gfx,
});
const HEIGHT_KEY = "mybrute.lab.editorHeight";
const TEAM_TARGETS: [SaveTarget, string][] = [
  ["team:0", "Team 0"],
  ["team:1", "Team 1"],
];

/** Lab looks (lab.css). Workbench is the site's leather-and-paper; the rest are terminals. */
const THEMES = [
  ["slate", "Slate"],
  ["amber", "Amber CRT"],
  ["phosphor", "Green phosphor"],
  ["solarized", "Solarized"],
  ["mainframe", "Mainframe"],
  ["printout", "Printout"],
  ["workbench", "Workbench"],
] as const;
type Theme = (typeof THEMES)[number][0];
const THEME_KEY = "mybrute.labTheme";
// shortcut: per-browser only; moves to the account when the appearance settings spec lands
const readTheme = (): Theme => {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return THEMES.some(([k]) => k === t) ? (t as Theme) : "slate";
  } catch {
    return "slate";
  }
};

export function LabPage() {
  // "Try a copy in the Lab" from a Classic cell passes the brute in the navigation state; it is only a copy
  const location = useLocation();
  const { lang } = useLanguage();
  // new fights start in the site language; loaded payloads keep their own
  const [state, dispatch] = useReducer(
    labReducer,
    (location.state as { brute?: SpecBrute } | null)?.brute,
    (copy) => {
      const s = initLab(copy);
      return { ...s, spec: { ...s.spec, lang } };
    },
  );
  const { spec, selected } = state;
  const store = useLabStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bench, setBench] = useState<SavedBrute[]>([]);
  const reloadBench = useCallback(
    () => store.listBrutes().then(setBench, () => setBench([])),
    [store],
  );
  useEffect(() => {
    void reloadBench();
  }, [reloadBench]);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(() =>
    window.matchMedia(PHONE).matches ? "teams" : "editor",
  );
  // from 1100px the editor sits beside the arena, so the Arena tab is the one showing
  const [editorBeside, setEditorBeside] = useState(
    () => window.matchMedia(BESIDE).matches,
  );
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
  const [draft, setDraft] = useState<Draft | null>(null);
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
  // picking or adding a brute opens it in the editor (matters when sections are shown one at a time)
  const act = useCallback((a: Parameters<typeof dispatch>[0]) => {
    dispatch(a);
    if (a.type === "select" || a.type === "addBrute") {
      setPanel("editor");
      setDraft(null);
    }
  }, []);
  const openDraft = (d: Draft) => {
    setDraft(d);
    dispatch({ type: "select", index: null });
    setPanel("editor");
  };
  const editBench = (item: SavedBrute) =>
    openDraft({
      kind: "bench",
      key: "b" + item.key,
      item,
      brute: structuredClone(item.brute),
      original: structuredClone(item.brute),
    });
  const toastTimer = useRef<number>();
  const [theme, setTheme] = useState(readTheme);
  const [size] = useBruteSize();
  const pickTheme = (t: Theme) => {
    setTheme(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* still applies for this visit */
    }
  };

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  // client.swf opens this URL when the fight animation ends (registered in an effect so StrictMode's remount re-registers it)
  const [endUrl, setEndUrl] = useState("javascript:()");
  useEffect(() => {
    const end = registerEnd(() =>
      setPlayback((p) => (p ? { ...p, ended: true } : p)),
    );
    setEndUrl(end.url);
    return end.dispose;
  }, []);

  const descs = useMemo<(Description | null)[]>(
    () =>
      spec.brutes.map((b) => {
        try {
          return describe(b.id, b.levelUps, b.choices);
        } catch {
          return null;
        }
      }),
    [spec.brutes],
  );
  const errors = useMemo(() => validateSpec(spec), [spec]);
  const sim = useMemo(() => {
    if (errors.length) return null;
    try {
      return runFight(spec);
    } catch {
      return null;
    }
  }, [spec, errors]);
  const stats = useMemo(() => (sim ? extractStats(sim) : null), [sim]);
  const pets = useMemo(() => (sim ? extractPetStats(sim) : []), [sim]);
  const problems = useMemo(() => {
    const s = new Set<number>();
    spec.brutes.forEach(
      (b, i) =>
        errors.some(
          (e) =>
            e.includes(b.name || `Brute ${b.id}`) || e.includes(String(b.id)),
        ) && s.add(i),
    );
    return s;
  }, [spec.brutes, errors]);

  const play = () => {
    if (errors.length)
      return notify("Fix the problems listed under the arena first.");
    setPlayback({
      params: buildParams(spec, {
        mini: swfUrl("mini_perso.swf"),
        end: endUrl,
      }),
      nonce: Date.now(),
      snapshot: JSON.stringify(spec),
      ended: false,
    });
    setPanel("arena");
  };

  const loadPayload = (params: string, label: string) => {
    const { spec: loaded } = importPayload(params);
    dispatch({ type: "load", spec: loaded, label });
    setPlayback(null);
    notify(`Opened ${label}.`);
  };

  const copyParams = () => {
    if (errors.length)
      return notify("Fix the problems listed under the arena first.");
    navigator.clipboard.writeText(portable(spec)).then(
      () => notify("Payload copied."),
      () => notify("Couldn't reach the clipboard."),
    );
  };

  const savePayload = () => {
    if (errors.length)
      return notify("Fix the problems listed under the arena first.");
    const label = window.prompt("Name this fight", fightLabel(spec));
    if (label === null) return;
    store.savePayload(label.trim() || fightLabel(spec), portable(spec)).then(
      () =>
        notify(
          store.where === "account"
            ? "Fight saved to your account."
            : "Fight saved in this browser.",
        ),
      (e: Error) => notify(e.message),
    );
  };

  const saveBrute = (b: SpecBrute) => {
    const label = window.prompt(
      "Name this saved brute",
      `${b.name}, level ${b.levelUps + 1}`,
    );
    if (label === null) return;
    store.saveBrute(label.trim() || b.name, b).then(
      () => {
        void reloadBench();
        notify("Brute saved to the bench.");
      },
      (e: Error) => notify(e.message),
    );
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

  const editSupport = (team: 0 | 1) => {
    const st = supportOf(spec, team);
    if (!st) return;
    const b: SpecBrute = {
      name: `Team ${team} support`,
      id: st.id,
      team,
      levelUps: st.levelUps,
      gfx: st.gfx,
      choices: hexToChoices(st.bits, st.levelUps),
    };
    openDraft({
      kind: "support",
      key: "s" + team,
      team,
      brute: b,
      original: structuredClone(b),
    });
  };
  const draftDesc = useMemo(() => {
    if (!draft) return null;
    try {
      return describe(
        draft.brute.id,
        draft.brute.levelUps,
        draft.brute.choices,
      );
    } catch {
      return null;
    }
  }, [draft]);

  const saveTo = (target: SaveTarget, b: SpecBrute) => {
    if (target === "bench") return saveBrute(b);
    if (target === "origin" && draft?.kind === "bench") {
      // the stores only add and delete, so overwriting is a new save under the same name, then dropping the old one
      const old = draft.item;
      store
        .saveBrute(old.label, b)
        .then((item) => store.deleteBrute(old.key).then(() => item))
        .then(
          (item) => {
            setDraft((d) =>
              d && d.kind === "bench"
                ? { ...d, item, original: structuredClone(b) }
                : d,
            );
            void reloadBench();
            notify(`Saved ${old.label} on the bench.`);
          },
          (e: Error) => notify(e.message),
        );
      return;
    }
    const supportTeam =
      target === "origin" && draft?.kind === "support"
        ? draft.team
        : target === "support:0"
          ? 0
          : target === "support:1"
            ? 1
            : null;
    if (supportTeam !== null) {
      dispatch({
        type: "setTeam",
        team: supportTeam,
        patch: { _st: toSupport(b) },
      });
      if (target === "origin")
        setDraft((d) => d && { ...d, original: structuredClone(b) });
      return notify(`Saved as the team ${supportTeam} support brute.`);
    }
    const team = target === "team:1" ? 1 : 0;
    if (spec.brutes.some((x) => x.id === b.id))
      return notify(
        `Id ${b.id} is already in this fight. Change the id before adding it.`,
      );
    act({ type: "addBrute", brute: { ...structuredClone(b), team } });
    notify(`Added ${b.name} to team ${team}.`);
  };

  const sel = selected !== null ? spec.brutes[selected] : undefined;
  const updateDraft = (patch: Partial<SpecBrute>) =>
    setDraft((d) => d && { ...d, brute: patchBrute(d.brute, patch) });
  const updateSelected = (patch: Partial<SpecBrute>) => {
    if (selected !== null)
      dispatch({ type: "updateBrute", index: selected, patch });
  };

  return (
    <div
      className={theme === "workbench" ? "lab" : "lab term"}
      data-theme={theme}
      style={portraitScale(size)}
    >
      <div className="toolbar" role="toolbar" aria-label="Fight">
        <div className="toolbar-title">
          <h1>Laboratory</h1>
          <span className="muted">{state.sourceLabel}</span>
        </div>
        <div className="toolbar-actions">
          <BruteSizeControl />
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              dispatch({
                type: "load",
                spec: { ...newLabFight(), lang },
                label: "New fight",
              });
              setPlayback(null);
            }}
          >
            New fight
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setDialogOpen(true)}
          >
            Open fight
          </button>
          <button type="button" className="btn ghost" onClick={savePayload}>
            Save fight
          </button>
          <button type="button" className="btn ghost" onClick={copyParams}>
            Copy payload
          </button>
          <ParametersDialog
            spec={spec}
            descs={descs}
            stats={stats}
            pets={pets}
            errors={errors}
            dispatch={dispatch}
          />
        </div>
        <div className="toolbar-fields">
          <label>
            Seed
            <span className="input-with-btn">
              <CommitInput
                value={spec.seed}
                inputMode="numeric"
                onCommit={(t) => {
                  const v = parseIntStrict(t);
                  if (v === null) return "The seed is a whole number.";
                  dispatch({ type: "setFight", patch: { seed: v } });
                }}
              />
              <button
                type="button"
                className="btn small ghost"
                onClick={() =>
                  dispatch({ type: "setFight", patch: { seed: randomSeed() } })
                }
              >
                Reroll
              </button>
            </span>
          </label>
          <label>
            Arena
            <select
              value={spec.arena}
              onChange={(e) =>
                dispatch({ type: "setFight", patch: { arena: Number(e.target.value) } })
              }
            >
              {/* shortcut: arena ids 0-9 are a guess, the repo does not list them; a loaded id outside this range is kept in the list */}
              {[...new Set([spec.arena, ...ARENA_IDS])].sort((a, b) => a - b).map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </label>
          <label>
            Language
            <select
              value={spec.lang}
              onChange={(e) =>
                dispatch({ type: "setFight", patch: { lang: e.target.value } })
              }
            >
              {[...new Set([spec.lang, ...INVENTORY_LANGS])].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Theme
            <select
              value={theme}
              onChange={(e) => pickTheme(e.target.value as Theme)}
            >
              {THEMES.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn play"
            onClick={play}
            disabled={errors.length > 0}
          >
            Play fight
          </button>
        </div>
      </div>

      <div className="workspace" data-panel={panel} data-expanded={expanded || undefined} ref={workspaceRef}>
        <ColumnResizers workspace={workspaceRef} />
        <div className="col col-teams">
          <VersusBoard
            spec={spec}
            descs={descs}
            selected={selected}
            problems={problems}
            dispatch={act}
            editingSupport={draft?.kind === "support" ? draft.team : null}
            onEditSupport={editSupport}
          />
          <Bench
            items={bench}
            takenIds={spec.brutes.map((b) => b.id)}
            onUse={applyBenchBrute}
            onEdit={editBench}
            editing={draft?.kind === "bench" ? draft.item.key : null}
            where={store.where}
            onNotify={notify}
            onImport={(b) => {
              store.saveBrute(b.name, b).then(
                () => {
                  void reloadBench();
                  notify(`Imported ${b.name} to the bench.`);
                },
                (e: Error) => notify(e.message),
              );
            }}
            onDelete={(key) => {
              store
                .deleteBrute(key)
                .then(reloadBench, (e: Error) => notify(e.message));
            }}
          />
        </div>
        <div className="col col-editor">
          {draft ? (
            <BruteEditor
              key={draft.key}
              brute={draft.brute}
              original={draft.original}
              desc={draftDesc}
              lang={spec.lang}
              source={
                draft.kind === "bench"
                  ? `Bench: ${draft.item.label}`
                  : `Team ${draft.team} support`
              }
              takenIds={
                draft.kind === "support" ? spec.brutes.map((b) => b.id) : []
              }
              update={updateDraft}
              onReset={() =>
                setDraft(
                  (d) => d && { ...d, brute: structuredClone(d.original) },
                )
              }
              onClose={() => setDraft(null)}
              saveTargets={
                draft.kind === "bench"
                  ? [
                      ["origin", `Bench: ${draft.item.label}`],
                      ["bench", "Bench, as a new save"],
                      ...TEAM_TARGETS,
                      ["support:0", "Team 0 support"],
                      ["support:1", "Team 1 support"],
                    ]
                  : [
                      ["origin", `Team ${draft.team} support`],
                      ["bench", "Bench"],
                      ...TEAM_TARGETS,
                      [
                        `support:${1 - draft.team}` as SaveTarget,
                        `Team ${1 - draft.team} support`,
                      ],
                    ]
              }
              onSaveTo={saveTo}
              height={editorHeight}
              onHeight={changeEditorHeight}
            />
          ) : sel && selected !== null ? (
            <BruteEditor
              key={selected}
              brute={sel}
              original={state.originals[selected]}
              desc={descs[selected]}
              lang={spec.lang}
              takenIds={spec.brutes
                .filter((_, i) => i !== selected)
                .map((b) => b.id)}
              update={updateSelected}
              onReset={() => dispatch({ type: "resetBrute", index: selected })}
              teamCount={spec.brutes.filter((b) => b.team === sel.team).length}
              onRemove={() =>
                dispatch({ type: "removeBrute", index: selected })
              }
              saveTargets={[
                ["bench", "Bench"],
                ["support:0", "Team 0 support"],
                ["support:1", "Team 1 support"],
              ]}
              onSaveTo={saveTo}
              height={editorHeight}
              onHeight={changeEditorHeight}
            />
          ) : (
            <section className="panel editor-empty">
              <p>
                Pick a brute, a bench save or a support brute to edit it here.
              </p>
            </section>
          )}
        </div>
        <div className="col col-arena">
          <ArenaPanel
            spec={spec}
            descs={descs}
            sim={sim}
            stats={stats}
            pets={pets}
            errors={errors}
            playback={playback}
            onPlay={play}
            notify={notify}
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
            aria-pressed={
              panel === key || (key === "arena" && editorBeside)
            }
            onClick={() => {
              setExpanded(false);
              setPanel(key);
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <PayloadDialog
        open={dialogOpen}
        store={store}
        onClose={() => setDialogOpen(false)}
        onLoad={loadPayload}
      />
      <div className="toast" role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
