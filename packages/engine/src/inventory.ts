// inventory.swf FlashVars, built by the original inventory.js `params` (data=<encoded {_l,_s,_level,_bits,_a}>&k=&lang=).
import { Inventory } from "./vendor";
import { normalizeChoices } from "./progression";

export const INVENTORY_LANGS = ["en", "fr", "es", "de"] as const;

export function inventoryParams(
  brute: { id: number; levelUps: number; choices: readonly number[] },
  opts: { lang?: string; ownedOnly?: boolean } = {},
): string {
  return Inventory.params({ id: brute.id, lvl: brute.levelUps, choices: normalizeChoices(brute.choices, brute.levelUps) }, opts);
}
