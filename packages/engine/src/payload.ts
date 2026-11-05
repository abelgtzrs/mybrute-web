// client.swf payloads. A payload carries the fight INPUTS (seed, arena, brutes, team properties);
// client.swf re-simulates the fight itself, and FightAPI.run (fight.js) is the same Arena in JS.
// Decoded shape (from real payloads):
//   { _mini, _seed, _p0, _p1, _glads: [{ _bits, _n, _s, _t, _gfx, _lvl }], _arena, _end }
// This module only builds/reads that structure with the original codec (labrute.js).
import { FightAPI, LaBrute, type EngineInput, type EngineResult, type HxNode } from "./vendor";
import { bitsToHex, hexToChoices, isValidSeedId, MAX_LAB_LEVEL, normalizeChoices, type Choice } from "./progression";
import { isValidGfx } from "./gfx";

export interface SpecBrute {
  name: string;
  /** deterministic seed id (Gladiator id) */
  id: number;
  team: 0 | 1;
  /** level-ups taken (original lvl); displayed level is levelUps + 1 */
  levelUps: number;
  gfx: string;
  choices: Choice[];
  /** Laboratory only: rewards ("Kind:ID") to steer away from; never sent to the engine or the SWF */
  avoid?: string[];
}

/** Team property object (_p0/_p1) in plain form; _bits fields are hex strings. */
export type TeamProps = Record<string, unknown>;

export interface FightSpec {
  seed: number;
  arena: number;
  brutes: SpecBrute[];
  p0: TeamProps | null;
  p1: TeamProps | null;
  /** language passed to client.swf */
  lang: string;
}

export interface BuildOptions {
  /** URL of mini_perso.swf as client.swf will resolve it */
  mini: string;
  /** URL client.swf opens when playback ends (originally "javascript:showEnd()") */
  end: string;
  /** codec key; random when omitted */
  key?: string;
}

// ---- unicode <-> the latin1 byte strings the codec works with (Haxe strings are URL-encoded UTF-8) ----
export const toBytes = (s: string) => unescape(encodeURIComponent(s));
export function fromBytes(s: string): string {
  try { return decodeURIComponent(escape(s)); } catch { return s; }
}

// ---- Haxe AST helpers ----
const Y = (s: string): HxNode => ({ k: "y", v: LaBrute.pencode(s) });
const I = (n: number): HxNode => (n === 0 ? { k: "z" } : { k: "i", v: String(n) });
const hexToB64 = (hex: string) => LaBrute.b64enc((hex.match(/../g) ?? []).map((x) => parseInt(x, 16)));
const b64ToHex = (b64: string) => LaBrute.b64dec(b64).map((b) => b.toString(16).padStart(2, "0")).join("");

/** Haxe node -> plain value; 's' (bytes) become hex, strings stay latin1 byte strings */
export function hxToPlain(n: HxNode): unknown {
  switch (n.k) {
    case "n": return null;
    case "z": return 0;
    case "t": return true;
    case "f": return false;
    case "i": return parseInt(n.v, 10);
    case "d": return parseFloat(n.v);
    case "y": return LaBrute.pdecode(n.v);
    case "s": return b64ToHex(n.v);
    case "a": return n.v.map(hxToPlain);
    case "o": {
      const o: Record<string, unknown> = {};
      for (const [k, v] of n.v) o[LaBrute.pdecode((k as { v: string }).v)] = hxToPlain(v);
      return o;
    }
  }
}

/** plain value -> Haxe node; keys named _bits are bytes (hex in plain form) */
export function plainToHx(v: unknown, key?: string): HxNode {
  if (v === null || v === undefined) return { k: "n" };
  if (v === true) return { k: "t" };
  if (v === false) return { k: "f" };
  if (typeof v === "number") return Number.isInteger(v) ? I(v) : { k: "d", v: String(v) };
  if (typeof v === "string") return key === "_bits" ? { k: "s", v: hexToB64(v) } : Y(v);
  if (Array.isArray(v)) return { k: "a", v: v.map((x) => plainToHx(x)) };
  return { k: "o", v: Object.entries(v as Record<string, unknown>).map(([k, x]) => [Y(k), plainToHx(x, k)] as [HxNode, HxNode]) };
}

export interface ImportedPayload {
  spec: FightSpec;
  /** what the original payload contained, kept for reference/round-trips */
  source: { key: string; mini: string | null; end: string | null; plain: string };
}

export function importPayload(text: string): ImportedPayload {
  const inp = LaBrute.parseInput(text);
  const d = LaBrute.decode(LaBrute.pdecode(inp.data), inp.k);
  if (!d.ok) throw new Error("Checksum mismatch: the k= key is wrong, or the data was cut or altered when copied.");
  const root = hxToPlain(LaBrute.parseHx(d.plain)) as Record<string, any>;
  if (!Array.isArray(root._glads)) throw new Error("This payload has no _glads list, so it isn't a client.swf fight.");
  const brutes: SpecBrute[] = root._glads.map((g: any) => {
    const levelUps = Math.max(0, g._lvl | 0);
    return { name: fromBytes(String(g._n ?? "")), id: g._s, team: g._t === 1 ? 1 : 0, levelUps, gfx: String(g._gfx ?? ""), choices: hexToChoices(String(g._bits ?? ""), levelUps) };
  });
  return {
    spec: { seed: root._seed | 0, arena: root._arena | 0, brutes, p0: root._p0 ?? null, p1: root._p1 ?? null, lang: inp.lang || "en" },
    source: { key: inp.k, mini: root._mini ?? null, end: typeof root._end === "string" ? root._end : null, plain: d.plain },
  };
}

const KEY_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const randomKey = () => Array.from({ length: 8 }, () => KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)]).join("");

/** The decoded Haxe-serialized plaintext of a payload (before encryption). */
export function payloadPlain(spec: FightSpec, opts: Omit<BuildOptions, "key">): string {
  const glad = (b: SpecBrute): HxNode => ({ k: "o", v: [
    [Y("_bits"), { k: "s", v: hexToB64(bitsToHex(b.choices, b.levelUps)) }],
    [Y("_n"), Y(toBytes(b.name))], [Y("_s"), I(b.id)], [Y("_t"), I(b.team)],
    [Y("_gfx"), Y(b.gfx)], [Y("_lvl"), I(b.levelUps)],
  ] });
  const root: HxNode = { k: "o", v: [
    [Y("_mini"), Y(opts.mini)], [Y("_seed"), I(spec.seed)],
    [Y("_p0"), plainToHx(spec.p0)], [Y("_p1"), plainToHx(spec.p1)],
    [Y("_glads"), { k: "a", v: spec.brutes.map(glad) }],
    [Y("_arena"), I(spec.arena)], [Y("_end"), Y(opts.end)],
  ] };
  return LaBrute.serHx(root);
}

/** FlashVars string for client.swf */
export function buildParams(spec: FightSpec, opts: BuildOptions): string {
  const key = opts.key ?? randomKey();
  const enc = LaBrute.encode(payloadPlain(spec, opts), key);
  return "data=" + LaBrute.pencode(enc) + "&k=" + key + "&lang=" + encodeURIComponent(spec.lang || "en");
}

/** Input for the original simulator, equivalent to labrute.js session.fightInput() */
export function toEngineInput(spec: FightSpec): EngineInput {
  return JSON.parse(JSON.stringify({
    seed: spec.seed,
    glads: spec.brutes.map((b) => ({ s: b.id, t: b.team, gfx: b.gfx, lvl: b.levelUps, bits: bitsToHex(b.choices, b.levelUps), n: toBytes(b.name) })),
    p0: spec.p0, p1: spec.p1,
  }));
}

/** Runs the original Arena. Deterministic: the same spec always produces the same result. */
export function runFight(spec: FightSpec): EngineResult {
  return FightAPI.run(toEngineInput(spec));
}

export function supportOf(spec: FightSpec, team: 0 | 1): { id: number; levelUps: number; bits: string; gfx: string } | null {
  const st = (team === 0 ? spec.p0 : spec.p1)?._st as Record<string, any> | undefined;
  return st ? { id: st._s, levelUps: st._lvl | 0, bits: String(st._bits ?? ""), gfx: String(st._gfx ?? "") } : null;
}

/** Problems that would make the fight invalid for the engine or the SWF. Empty when the spec is usable. */
export function validateSpec(spec: FightSpec): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(spec.seed)) errors.push("Seed must be a whole number.");
  if (!Number.isInteger(spec.arena) || spec.arena < 0) errors.push("Arena must be a whole number of 0 or more.");
  for (const t of [0, 1] as const) if (!spec.brutes.some((b) => b.team === t)) errors.push(`Team ${t} needs at least one brute.`);
  const ids = new Map<number, string>();
  const claim = (id: number, who: string) => {
    if (!isValidSeedId(id)) errors.push(`${who}: id must be between 1 and 2147483647.`);
    else if (ids.has(id)) errors.push(`${who} and ${ids.get(id)} share id ${id}. Fighter ids must be unique.`);
    else ids.set(id, who);
  };
  spec.brutes.forEach((b) => {
    const who = b.name || `Brute ${b.id}`;
    claim(b.id, who);
    if (!Number.isInteger(b.levelUps) || b.levelUps < 0 || b.levelUps >= MAX_LAB_LEVEL) errors.push(`${who}: level must be between 1 and ${MAX_LAB_LEVEL}.`);
    if (!isValidGfx(b.gfx)) errors.push(`${who}: appearance needs 16 numbers separated by semicolons.`);
    if (b.choices.length < b.levelUps) errors.push(`${who}: missing level-up choices.`);
  });
  for (const t of [0, 1] as const) { const s = supportOf(spec, t); if (s) claim(s.id, `Team ${t} support`); }
  return errors;
}

export { normalizeChoices };
