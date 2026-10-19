// perso.swf appearance strings. Format and checksum as documented in the lab README:
//  gfx = "a;b;...;p" (16 ints). gfx[0] body variant, gfx[1..10] part variants, gfx[11..15] palette colours.
//  chk: h = 1; for each field x: h = ((h * 11) ^ x) % 2097151. perso.swf refuses to draw on mismatch.
//  In fights client.swf overwrites gfx[1] with the brute's armor level.

export const GFX_FIELDS = 16;
export const GFX_LABELS = [
  "Body", "Part 1", "Part 2", "Part 3", "Part 4", "Part 5", "Part 6", "Part 7", "Part 8", "Part 9", "Part 10",
  "Colour 1", "Colour 2", "Colour 3", "Colour 4", "Colour 5",
] as const;

export function gfxParts(gfx: string): number[] {
  const p = String(gfx ?? "").split(";").map((s) => Math.max(0, parseInt(s, 10) || 0));
  while (p.length < GFX_FIELDS) p.push(0);
  return p.slice(0, GFX_FIELDS);
}

export const gfxString = (parts: readonly number[]) => gfxParts(parts.join(";")).join(";");

export function gfxHash(parts: readonly number[]): number {
  let h = 1;
  for (const x of parts) h = ((h * 11) ^ x) % 2097151;
  return h;
}

export interface PersoOptions { stop?: boolean; flip?: boolean; head?: boolean }

/** FlashVars for perso.swf */
export function persoParams(gfx: string, opts: PersoOptions = { stop: true }): string {
  const p = gfxParts(gfx);
  let s = "data=" + encodeURIComponent(p.join(";")) + "&chk=" + gfxHash(p);
  if (opts.stop) s += "&stop=1";
  if (opts.flip) s += "&flip=1";
  if (opts.head) s += "&head=1";
  return s;
}

/** Same ranges as the original lab's randGfx: body 0/1, gfx[1] 0 (armor slot), others 0..99. */
export function randomGfx(rand: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  const p = [rand(2), 0];
  for (let i = 2; i < GFX_FIELDS; i++) p.push(rand(100));
  return p.join(";");
}

export function isValidGfx(gfx: unknown): gfx is string {
  if (typeof gfx !== "string") return false;
  const parts = gfx.split(";");
  return parts.length === GFX_FIELDS && parts.every((s) => /^\d{1,6}$/.test(s));
}
