// Everything the Laboratory knows and can do, without any layout. The desktop Lab (LabPage) and the
// mobile Lab (mobile/MobileLabPage) both call useLab, so a fix or feature here reaches both.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  bitsToHex,
  buildParams,
  describe,
  extractPetStats,
  extractStats,
  hexToChoices,
  importPayload,
  newLabFight,
  runFight,
  supportOf,
  validateSpec,
  type Description,
  type FightSpec,
  type SpecBrute,
} from "@mybrute/engine";
import { registerEnd, swfUrl } from "../swf/ruffle";
import type { Playback } from "./ArenaPanel";
import type { SaveTarget } from "./BruteEditor";
import { initLab, labReducer, patchBrute, type LabAction } from "./state";
import { useLabStore, type SavedBrute } from "./storage";
import { useLanguage } from "../ui/language";

/** Params meant to leave the app (copy/save) use the same conventions as the original lab folder. */
const portable = (spec: FightSpec) => buildParams(spec, { mini: "mini_perso.swf", end: "javascript:()" });
const fightLabel = (spec: FightSpec) => spec.brutes.map((b) => b.name).join(" vs ");

/** A bench save or a team's support brute open in the editor; changes stay here until saved. */
export type Draft = { key: string; brute: SpecBrute; original: SpecBrute } & (
  | { kind: "bench"; item: SavedBrute }
  | { kind: "support"; team: 0 | 1 }
);
const toSupport = (b: SpecBrute) => ({ _s: b.id, _lvl: b.levelUps, _bits: bitsToHex(b.choices, b.levelUps), _gfx: b.gfx });
const TEAM_TARGETS: [SaveTarget, string][] = [
  ["team:0", "Team 0"],
  ["team:1", "Team 1"],
];

/** Lab looks (lab.css). Workbench is the site's leather-and-paper; the rest are terminals. */
export const THEMES = [
  ["slate", "Slate"],
  ["amber", "Amber CRT"],
  ["phosphor", "Green phosphor"],
  ["solarized", "Solarized"],
  ["mainframe", "Mainframe"],
  ["printout", "Printout"],
  ["workbench", "Workbench"],
] as const;
export type Theme = (typeof THEMES)[number][0];
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

export interface LabOptions {
  /** a brute or a draft was opened: layouts that show one section at a time switch to the editor */
  onShowEditor?: () => void;
  /** Play was pressed: layouts that show one section at a time switch to the fight */
  onShowArena?: () => void;
}

export function useLab({ onShowEditor, onShowArena }: LabOptions = {}) {
  // "Try a copy in the Lab" from a Classic cell passes the brute in the navigation state; it is only a copy
  const location = useLocation();
  const { lang } = useLanguage();
  // new fights start in the site language; loaded payloads keep their own
  const [state, dispatch] = useReducer(labReducer, (location.state as { brute?: SpecBrute } | null)?.brute, (copy) => {
    const s = initLab(copy);
    return { ...s, spec: { ...s.spec, lang } };
  });
  const { spec, selected } = state;
  const store = useLabStore();
  const [bench, setBench] = useState<SavedBrute[]>([]);
  const reloadBench = useCallback(() => store.listBrutes().then(setBench, () => setBench([])), [store]);
  useEffect(() => {
    void reloadBench();
  }, [reloadBench]);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  // the layout callbacks change identity every render; keep the latest in a ref so `act` stays stable
  const show = useRef({ onShowEditor, onShowArena });
  show.current = { onShowEditor, onShowArena };

  // picking or adding a brute opens it in the editor (matters when sections are shown one at a time)
  const act = useCallback((a: LabAction) => {
    dispatch(a);
    if (a.type === "select" || a.type === "addBrute") {
      show.current.onShowEditor?.();
      setDraft(null);
    }
  }, []);
  const openDraft = (d: Draft) => {
    setDraft(d);
    dispatch({ type: "select", index: null });
    show.current.onShowEditor?.();
  };
  const editBench = (item: SavedBrute) =>
    openDraft({ kind: "bench", key: "b" + item.key, item, brute: structuredClone(item.brute), original: structuredClone(item.brute) });

  const toastTimer = useRef<number>();
  const [theme, setTheme] = useState(readTheme);
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
    const end = registerEnd(() => setPlayback((p) => (p ? { ...p, ended: true } : p)));
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
    spec.brutes.forEach((b, i) => errors.some((e) => e.includes(b.name || `Brute ${b.id}`) || e.includes(String(b.id))) && s.add(i));
    return s;
  }, [spec.brutes, errors]);

  const play = () => {
    if (errors.length) return notify("Fix the problems listed under the arena first.");
    setPlayback({
      params: buildParams(spec, { mini: swfUrl("mini_perso.swf"), end: endUrl }),
      nonce: Date.now(),
      snapshot: JSON.stringify(spec),
      ended: false,
    });
    show.current.onShowArena?.();
  };

  const newFight = () => {
    dispatch({ type: "load", spec: { ...newLabFight(), lang }, label: "New fight" });
    setPlayback(null);
  };

  const loadPayload = (params: string, label: string) => {
    const { spec: loaded } = importPayload(params);
    dispatch({ type: "load", spec: loaded, label });
    setPlayback(null);
    notify(`Opened ${label}.`);
  };

  const copyParams = () => {
    if (errors.length) return notify("Fix the problems listed under the arena first.");
    navigator.clipboard.writeText(portable(spec)).then(
      () => notify("Payload copied."),
      () => notify("Couldn't reach the clipboard."),
    );
  };

  const savePayload = () => {
    if (errors.length) return notify("Fix the problems listed under the arena first.");
    const label = window.prompt("Name this fight", fightLabel(spec));
    if (label === null) return;
    store.savePayload(label.trim() || fightLabel(spec), portable(spec)).then(
      () => notify(store.where === "account" ? "Fight saved to your account." : "Fight saved in this browser."),
      (e: Error) => notify(e.message),
    );
  };

  const saveBrute = (b: SpecBrute) => {
    const label = window.prompt("Name this saved brute", `${b.name}, level ${b.levelUps + 1}`);
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

  // bench saves arrive one at a time, last first: the bench lists newest first, so it ends up in the pasted order
  const importToBench = async (brutes: SpecBrute[]) => {
    let saved = 0;
    try {
      for (const b of [...brutes].reverse()) {
        await store.saveBrute(b.name, b);
        saved++;
      }
      notify(brutes.length === 1 ? `Imported ${brutes[0].name} to the bench.` : `Imported ${saved} brutes to the bench.`);
    } catch (e) {
      notify(`Imported ${saved} of ${brutes.length}: ${(e as Error).message}`);
    }
    void reloadBench();
  };
  const deleteFromBench = (key: string) => {
    store.deleteBrute(key).then(reloadBench, (e: Error) => notify(e.message));
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
    openDraft({ kind: "support", key: "s" + team, team, brute: b, original: structuredClone(b) });
  };
  const draftDesc = useMemo(() => {
    if (!draft) return null;
    try {
      return describe(draft.brute.id, draft.brute.levelUps, draft.brute.choices);
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
            setDraft((d) => (d && d.kind === "bench" ? { ...d, item, original: structuredClone(b) } : d));
            void reloadBench();
            notify(`Saved ${old.label} on the bench.`);
          },
          (e: Error) => notify(e.message),
        );
      return;
    }
    const supportTeam =
      target === "origin" && draft?.kind === "support" ? draft.team : target === "support:0" ? 0 : target === "support:1" ? 1 : null;
    if (supportTeam !== null) {
      dispatch({ type: "setTeam", team: supportTeam, patch: { _st: toSupport(b) } });
      if (target === "origin") setDraft((d) => d && { ...d, original: structuredClone(b) });
      return notify(`Saved as the team ${supportTeam} support brute.`);
    }
    const team = target === "team:1" ? 1 : 0;
    if (spec.brutes.some((x) => x.id === b.id)) return notify(`Id ${b.id} is already in this fight. Change the id before adding it.`);
    act({ type: "addBrute", brute: { ...structuredClone(b), team } });
    notify(`Added ${b.name} to team ${team}.`);
  };

  const sel = selected !== null ? spec.brutes[selected] : undefined;
  const updateDraft = (patch: Partial<SpecBrute>) => setDraft((d) => d && { ...d, brute: patchBrute(d.brute, patch) });
  const updateSelected = (patch: Partial<SpecBrute>) => {
    if (selected !== null) dispatch({ type: "updateBrute", index: selected, patch });
  };

  return {
    state, spec, selected, dispatch, act, store, bench, reloadBench, importToBench, deleteFromBench,
    playback, play, toast, notify, draft, setDraft, editBench, editSupport, updateDraft, draftDesc,
    sel, updateSelected, descs, errors, sim, stats, pets, problems,
    newFight, loadPayload, copyParams, savePayload, saveTo, applyBenchBrute, theme, pickTheme,
  };
}

export type Lab = ReturnType<typeof useLab>;

/**
 * What the brute editor needs for whatever is open: a draft (bench save or support brute) or the
 * selected fight brute. Both Labs use this, so save targets and Remove/Close follow the same rules.
 */
export function editorTargets(lab: Lab) {
  const { draft, spec, selected, sel, state } = lab;
  if (draft) {
    return {
      kind: "draft" as const,
      key: draft.key,
      brute: draft.brute,
      original: draft.original as SpecBrute | undefined,
      desc: lab.draftDesc,
      source: draft.kind === "bench" ? `Bench: ${draft.item.label}` : `Team ${draft.team} support`,
      takenIds: draft.kind === "support" ? spec.brutes.map((b) => b.id) : [],
      update: lab.updateDraft,
      onReset: () => lab.setDraft((d) => d && { ...d, brute: structuredClone(d.original) }),
      teamCount: undefined as number | undefined,
      onRemove: undefined as (() => void) | undefined,
      onClose: () => lab.setDraft(null),
      saveTargets: (draft.kind === "bench"
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
            [`support:${1 - draft.team}` as SaveTarget, `Team ${1 - draft.team} support`],
          ]) as [SaveTarget, string][],
    };
  }
  if (sel && selected !== null) {
    return {
      kind: "fight" as const,
      key: String(selected),
      brute: sel,
      original: state.originals[selected] as SpecBrute | undefined,
      desc: lab.descs[selected],
      source: undefined as string | undefined,
      takenIds: spec.brutes.filter((_, i) => i !== selected).map((b) => b.id),
      update: lab.updateSelected,
      onReset: () => lab.dispatch({ type: "resetBrute", index: selected }),
      teamCount: spec.brutes.filter((b) => b.team === sel.team).length as number | undefined,
      onRemove: (() => lab.dispatch({ type: "removeBrute", index: selected })) as (() => void) | undefined,
      onClose: undefined as (() => void) | undefined,
      saveTargets: [
        ["bench", "Bench"],
        ["support:0", "Team 0 support"],
        ["support:1", "Team 1 support"],
      ] as [SaveTarget, string][],
    };
  }
  return null;
}
