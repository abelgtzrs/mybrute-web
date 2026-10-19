import { applyAvoid, newLabFight, normalizeChoices, type FightSpec, type SpecBrute, type TeamProps } from "@mybrute/engine";

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
  | { type: "setSupport"; team: 0 | 1; patch: Record<string, unknown> };

export function initLab(): LabState {
  const spec = newLabFight();
  return { spec, originals: structuredClone(spec.brutes), selected: 0, sourceLabel: "New fight" };
}

export function labReducer(state: LabState, action: LabAction): LabState {
  const brutes = state.spec.brutes;
  switch (action.type) {
    case "load":
      return { spec: action.spec, originals: structuredClone(action.spec.brutes), selected: action.spec.brutes.length ? 0 : null, sourceLabel: action.label };
    case "select":
      return { ...state, selected: action.index };
    case "updateBrute": {
      const next = brutes.map((b, i) => {
        if (i !== action.index) return b;
        const merged = { ...b, ...action.patch };
        merged.choices = normalizeChoices(merged.choices, merged.levelUps);
        // keep the avoid list enforced whatever changed (id, level, choices or the list itself)
        if (merged.avoid?.length) merged.choices = applyAvoid(merged.id, merged.levelUps, merged.choices, merged.avoid).choices;
        return merged;
      });
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
    case "setSupport": {
      const key = action.team === 0 ? "p0" : "p1";
      const prop = state.spec[key] as TeamProps | null;
      if (!prop || !prop._st) return state;
      return { ...state, spec: { ...state.spec, [key]: { ...prop, _st: { ...(prop._st as object), ...action.patch } } } };
    }
  }
}
