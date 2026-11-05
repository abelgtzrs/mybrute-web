// Reward names in the player's language, from the original game's Lang.hx (see generated/names.ts).
import { BONUS_NAMES } from "./generated/names";
import type { BonusKind } from "./avoid";
import type { LevelOption } from "./vendor";

export const NAME_LANGS = ["en", "fr", "es", "de"] as const;
export type NameLang = (typeof NAME_LANGS)[number];
export const isNameLang = (l: unknown): l is NameLang => (NAME_LANGS as readonly unknown[]).includes(l);

const byKind = (l: NameLang, kind: BonusKind) => BONUS_NAMES[l][kind] as Record<string, string> | undefined;
const fallback = (id: string) => id.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

/** The game's name for a reward (English, then the id, when a language has none). */
export function bonusName(kind: BonusKind, id: string, lang: string = "en"): string {
  return byKind(isNameLang(lang) ? lang : "en", kind)?.[id] ?? byKind("en", kind)?.[id] ?? fallback(id);
}

/** A level-up option's label with the reward named in `lang`; stat options keep the engine's text. */
export function optionText(o: LevelOption, lang: string): string {
  return o.t === "b" ? `${o.text.split(": ")[0]}: ${bonusName(o.kind, o.id, lang)}` : o.text;
}

// FightLog (vendored, byte-pinned) names items with pretty(id): words split on "_", first letter kept, rest lowercased.
// Handing it the translated name with "_" for spaces makes it print that name unchanged.
const forLog = (kind: BonusKind, v: unknown, lang: string) => {
  const id = v && typeof v === "object" && "a" in v ? (v as { a: string }).a : String(v);
  return bonusName(kind, id, lang).replace(/ /g, "_");
};

/** A copy of a fight history whose weapon and pet names FightLog.format will print in `lang`. */
export function localizeHistory<T extends { a: string; p: any[] }>(history: readonly T[], lang: string): T[] {
  if (!isNameLang(lang)) return history.slice();
  return history.map((x) => {
    const p = x.p.slice();
    switch (x.a) {
      case "Weapon": p[1] = forLog("Weapons", p[1], lang); break;
      case "AddFollower": p[2] = forLog("Followers", p[2], lang); break;
      case "Attack": if (p[3]) p[3] = forLog("Weapons", p[3], lang); break;
      case "Downpour": p[1] = p[1].map((w: unknown) => forLog("Weapons", w, lang)); break;
      default: return x;
    }
    return { ...x, p };
  });
}
