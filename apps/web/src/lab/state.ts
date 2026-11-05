import { applyAvoid, newLabBrute, newLabFight, normalizeChoices, randomSeed, type FightSpec, type SpecBrute, type TeamProps } from "@mybrute/engine";

export interface LabState {
  spec: FightSpec;
  /** what each brute looked like when it entered the fight (for Reset), keyed by row */
  originals: SpecBrute[];
  selected: number | null;
  /** where the fight came from, shown in the toolbar */
  sourceLabel: string;
}

export type LabAction =
  | { type: "load"; spec: FightSpec; label: string }
  | { type: "select"; index: number | null }
  | { type: "updateBrute"; index: number; patch: Partial<SpecBrute> }
  | { type: "resetBrute"; index: number }
  | { type: "addBrute"; brute: SpecBrute }
  | { type: "removeBrute"; index: number }
  | { type: "setFight"; patch: Partial<Pick<FightSpec, "seed" | "arena" | "lang">> }
  /** team props (_p0/_p1): _st support brute, _sab sabotaged, _poi poisoned */
  | { type: "setTeam"; team: 0 | 1; patch: TeamProps };

/** A fresh fight, or (from a Classic cell) a copy of that brute against a random brute of the same level. */
export function initLab(copy?: SpecBrute): LabState {
  if (copy) {
    const mine: SpecBrute = { ...structuredClone(copy), team: 0 };
    const rival = newLabBrute(1, { levelUps: mine.levelUps, takenIds: [mine.id] });
    const spec: FightSpec = { seed: randomSeed(), arena: 2, brutes: [mine, rival], p0: null, p1: null, lang: "en" };
    return { spec, originals: structuredClone(spec.brutes), selected: 0, sourceLabel: `Copy of ${copy.name} (your Classic brute is unchanged)` };
  }
  const spec = newLabFight();
  return { spec, originals: structuredClone(spec.brutes), selected: 0, sourceLabel: "New fight" };
}

/** A brute with an edit applied; choices stay one per level and the avoid list stays enforced, whatever changed. */
export function patchBrute(b: SpecBrute, patch: Partial<SpecBrute>): SpecBrute {
  const merged = { ...b, ...patch };
  merged.choices = normalizeChoices(merged.choices, merged.levelUps);
  if (merged.avoid?.length) merged.choices = applyAvoid(merged.id, merged.levelUps, merged.choices, merged.avoid).choices;
  return merged;
}

export function labReducer(state: LabState, action: LabAction): LabState {
  const brutes = state.spec.brutes;
  switch (action.type) {
    case "load":
      return { spec: action.spec, originals: structuredClone(action.spec.brutes), selected: action.spec.brutes.length ? 0 : null, sourceLabel: action.label };
    case "select":
      return { ...state, selected: action.index };
    case "updateBrute": {
      const next = brutes.map((b, i) => (i === action.index ? patchBrute(b, action.patch) : b));
      return { ...state, spec: { ...state.spec, brutes: next } };
    }
    case "resetBrute": {
      const orig = state.originals[action.index];
      if (!orig) return state;
      return labReducer(state, { type: "updateBrute", index: action.index, patch: structuredClone(orig) });
    }
    case "addBrute":
      return {
        ...state,
        spec: { ...state.spec, brutes: [...brutes, action.brute] },
        originals: [...state.originals, structuredClone(action.brute)],
        selected: brutes.length,
      };
    case "removeBrute": {
      const keep = (_: unknown, i: number) => i !== action.index;
      const sel = state.selected === null || state.selected === action.index ? null : state.selected > action.index ? state.selected - 1 : state.selected;
      return { ...state, spec: { ...state.spec, brutes: brutes.filter(keep) }, originals: state.originals.filter(keep), selected: sel };
    }
    case "setFight":
      return { ...state, spec: { ...state.spec, ...action.patch } };
    case "setTeam": {
      const key = action.team === 0 ? "p0" : "p1";
      // the same shape the engine starts every team with
      const prop = (state.spec[key] as TeamProps | null) ?? { _poi: null, _sab: null, _st: null };
      return { ...state, spec: { ...state.spec, [key]: { ...prop, ...action.patch } } };
    }
  }
}
