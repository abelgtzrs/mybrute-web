// perso.swf appearance strings. Format and checksum as documented in the lab README:
//  gfx = "a;b;...;p" (16 ints). gfx[0] body variant, gfx[1..10] part variants, gfx[11..15] palette colours.
//  chk: h = 1; for each field x: h = ((h * 11) ^ x) % 2097151. perso.swf refuses to draw on mismatch.
//  In fights client.swf overwrites gfx[1] with the brute's armor level.

export const GFX_FIELDS = 16;
export const GFX_COLOURS = 11; // gfx[11..15] may also be -1

const range = (n: number) => Array.from({ length: n }, (_, i) => String(i));
/** What each field does, as found in the GFX editor: [index, label, option labels]. Parts 8-10 do nothing. */
export const GFX_FIELD_OPTIONS: readonly (readonly [number, string, readonly string[]])[] = [
  [0, "Body", ["Male", "Female"]],
  [1, "Armor", ["None", "Armor"]],
  [2, "Musculature (male)", range(8)],
  [3, "Hair style", range(12)],
  [4, "Beard / fringe", range(6)],
  [5, "T-shirt (male)", ["No", "Yes"]],
  [6, "Bottoms", ["Short (male) / long (female)", "Long (male) / short (female)"]],
  [7, "Clothes style", range(7)],
  [11, "Skin colour", range(6)],
  [12, "Hair colour", range(10)],
  [13, "Main clothing colour", range(20)],
  [14, "Secondary colour + eyes", range(20)],
  [15, "T-shirt colour (male)", range(20)],
];

export function gfxParts(gfx: string): number[] {
  const p = String(gfx ?? "").split(";").map((s, i) => Math.max(i >= GFX_COLOURS ? -1 : 0, parseInt(s, 10) || 0));
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
  return parts.length === GFX_FIELDS && parts.every((s, i) => /^\d{1,6}$/.test(s) || (i >= GFX_COLOURS && s === "-1"));
}
