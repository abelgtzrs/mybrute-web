import {
  bitsToHex,
  hexToChoices,
  isValidSeedId,
  MAX_LAB_LEVEL,
  type SpecBrute,
} from "@mybrute/engine";

const PREFIX = "MYBRUTE1:";

const toB64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64 = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

/** A brute as one copyable text string: prefix plus base64url JSON. The team is not included. */
export function exportBrute(b: SpecBrute): string {
  const data: Record<string, unknown> = {
    n: b.name,
    i: b.id,
    l: b.levelUps,
    g: b.gfx,
    c: bitsToHex(b.choices, b.levelUps),
  };
  if (b.avoid?.length) data.a = b.avoid;
  return PREFIX + toB64(JSON.stringify(data));
}

/** Reads a string made by exportBrute. Throws an Error with a readable message when it isn't one. */
export function importBrute(text: string, team: 0 | 1 = 0): SpecBrute {
  const t = text.trim().replace(/\s+/g, "");
  if (!t.startsWith(PREFIX)) throw new Error("That isn't a brute code.");
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(fromB64(t.slice(PREFIX.length)));
  } catch {
    throw new Error("That brute code is damaged.");
  }
  if (!d || typeof d !== "object") throw new Error("That brute code is damaged.");
  const { n, i, l, g, c, a } = d;
  if (typeof n !== "string" || !n.trim()) throw new Error("The brute code has no name.");
  if (!isValidSeedId(i)) throw new Error("The brute code has an invalid id.");
  if (!Number.isInteger(l) || (l as number) < 0 || (l as number) >= MAX_LAB_LEVEL)
    throw new Error("The brute code has an invalid level.");
  if (typeof g !== "string" || typeof c !== "string")
    throw new Error("The brute code is incomplete.");
  const brute: SpecBrute = {
    name: n.slice(0, 40),
    id: i,
    team,
    levelUps: l as number,
    gfx: g,
    choices: hexToChoices(c, l as number),
  };
  if (Array.isArray(a) && a.every((x) => typeof x === "string") && a.length)
    brute.avoid = a as string[];
  return brute;
}

/** Several brutes as text: one code per line. */
export const exportBrutes = (brutes: SpecBrute[]) => brutes.map((b) => exportBrute(b)).join("\n");

/**
 * Reads any number of codes pasted together (one per line, space-separated, or even line-wrapped).
 * Every code that reads fine is returned; each broken one gives an error naming its position.
 */
export function importBrutes(text: string, team: 0 | 1 = 0): { brutes: SpecBrute[]; errors: string[] } {
  // codes are base64url after the prefix, so they never contain ":" or spaces: cutting at each prefix finds them
  const [junk, ...codes] = text.replace(/\s+/g, "").split(PREFIX);
  if (!codes.length) return { brutes: [], errors: [text.trim() ? "That isn't a brute code." : "Paste one or more brute codes."] };
  const brutes: SpecBrute[] = [];
  const errors: string[] = junk ? ["Text before the first code was ignored."] : [];
  codes.forEach((c, n) => {
    try {
      brutes.push(importBrute(PREFIX + c, team));
    } catch (e) {
      errors.push(codes.length > 1 ? `Code ${n + 1}: ${(e as Error).message}` : (e as Error).message);
    }
  });
  return { brutes, errors };
}
