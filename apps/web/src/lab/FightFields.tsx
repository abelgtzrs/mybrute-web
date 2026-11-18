// The fight-wide settings (seed, arena, language, theme). The desktop toolbar and the mobile settings sheet both show these.
import { INVENTORY_LANGS, randomSeed } from "@mybrute/engine";
import { CommitInput, parseIntStrict } from "../ui/CommitInput";
import { THEMES, type Lab, type Theme } from "./useLab";

/** Arena ids offered in the Arena dropdown. */
const ARENA_IDS = Array.from({ length: 10 }, (_, i) => i);

export function FightFields({ lab }: { lab: Lab }) {
  const { spec, dispatch, theme, pickTheme } = lab;
  return (
    <>
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
          <button type="button" className="btn small ghost" onClick={() => dispatch({ type: "setFight", patch: { seed: randomSeed() } })}>
            Reroll
          </button>
        </span>
      </label>
      <label>
        Arena
        <select value={spec.arena} onChange={(e) => dispatch({ type: "setFight", patch: { arena: Number(e.target.value) } })}>
          {/* shortcut: arena ids 0-9 are a guess, the repo does not list them; a loaded id outside this range is kept in the list */}
          {[...new Set([spec.arena, ...ARENA_IDS])].sort((a, b) => a - b).map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </label>
      <label>
        Language
        <select value={spec.lang} onChange={(e) => dispatch({ type: "setFight", patch: { lang: e.target.value } })}>
          {[...new Set([spec.lang, ...INVENTORY_LANGS])].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      <label>
        Theme
        <select value={theme} onChange={(e) => pickTheme(e.target.value as Theme)}>
          {THEMES.map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </label>
    </>
  );
}
