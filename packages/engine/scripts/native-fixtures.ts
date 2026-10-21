// Builds the "answer key" JSON files that the native C++/Qt app (labrute-native) tests itself against.
// Every case is produced by running the real TypeScript code, so the C++ port must give identical output.
// All randomness comes from one tiny LCG (same as make-golden.cjs) so the files are byte-identical on every run.
// Never call engine helpers that use Math.random (newLabBrute, randomGfx(), randomKey, initLab()...).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BONUSES, FightLog, INVENTORY_LANGS, NAME_LANGS, applyAvoid, bitsToB64, bitsToHex, bonusKey, bonusName, buildParams,
  describe, destiny, extractPetStats, extractStats, gfxHash, gfxParts, gfxString, hexToChoices, importPayload,
  inventoryParams, isValidGfx, localizeHistory, nearestIdWithStance, normalizeChoices, optionText, payloadPlain,
  pendingOptions, persoParams, randomGfx, runFight, toEngineInput, validateSpec,
  type Choice, type FightSpec, type LevelOption, type SpecBrute,
} from "../src/index";
import { labReducer, type LabAction, type LabState } from "../../../apps/web/src/lab/state";

const here = dirname(fileURLToPath(import.meta.url));
const examplePayloads: { name: string; params: string }[] = JSON.parse(readFileSync(join(here, "../test/fixtures/fights.json"), "utf8"));

// ---------------------------------------------------------------- the random number source

// The LCG: same recipe as make-golden.cjs. rnd(n) gives a whole number from 0 to n-1.
// It uses the HIGH bits (st / 2^32): the low bits of this kind of LCG repeat with a tiny period.
let st = 123456789;
const rnd = (n: number) => {
  st = (Math.imul(st, 1103515245) + 12345) >>> 0;
  return Math.floor((st / 2 ** 32) * n);
};
const pick = <T>(list: readonly T[]): T => list[rnd(list.length)];

const KEY_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
// An 8-character codec key made from the LCG (the engine's own randomKey uses Math.random).
const makeKey = () => Array.from({ length: 8 }, () => KEY_CHARS[rnd(KEY_CHARS.length)]).join("");
// A brute id like the Lab's "rand id" button gives (10,000,000 to 99,999,999).
const makeId = () => 10_000_000 + rnd(90_000_000);
const makeChoices = (n: number): Choice[] => Array.from({ length: n }, () => rnd(2) as Choice);
const makeGfx = () => randomGfx(rnd);
const NAMES = ["Warcott", "Fifitzi", "Torres", "Minky", "Bruno", "Kali", "Olaf", "Zed", "Mira", "Gus", "Pixel", "Ronin"];
const UNICODE_NAMES = ["Gröm", "Ñandú", "战士", "🐻 Bear"];
const LANGS = INVENTORY_LANGS; // en, fr, es, de (same list as NAME_LANGS)

// ---------------------------------------------------------------- small shared builders

// A brute with a unique id (not in `taken`), LCG-made gfx and choices. Ids are added to `taken`.
function makeBrute(team: 0 | 1, levelUps: number, taken: number[], name?: string): SpecBrute {
  let id = makeId();
  while (taken.includes(id)) id = makeId();
  taken.push(id);
  return { name: name ?? `${pick(NAMES)}${rnd(100)}`, id, team, levelUps, gfx: makeGfx(), choices: makeChoices(levelUps) };
}

// The _st object the Lab stores for a support brute (hex bits, like VersusBoard.tsx).
const toSupport = (b: SpecBrute) => ({ _s: b.id, _lvl: b.levelUps, _bits: bitsToHex(b.choices, b.levelUps), _gfx: b.gfx });

// A team property object in the shape the engine uses: _poi poisoned, _sab sabotaged, _st support brute.
const teamProps = (opts: { poi?: boolean; sab?: boolean; st?: SpecBrute }) => ({
  _poi: opts.poi ? true : null,
  _sab: opts.sab ? true : null,
  _st: opts.st ? toSupport(opts.st) : null,
});

// A fight: `perTeam` brutes on each side, at the given levels, with optional team properties.
function makeSpec(perTeam: number, levelUps: () => number, p0: Parameters<typeof teamProps>[0] | null, p1: Parameters<typeof teamProps>[0] | null): FightSpec {
  const taken: number[] = [];
  const brutes: SpecBrute[] = [];
  for (let i = 0; i < perTeam; i++) brutes.push(makeBrute(0, levelUps(), taken));
  for (let i = 0; i < perTeam; i++) brutes.push(makeBrute(1, levelUps(), taken));
  return {
    seed: rnd(2 ** 30), arena: rnd(6), brutes, lang: pick(LANGS),
    p0: p0 ? teamProps(p0) : null, p1: p1 ? teamProps(p1) : null,
  };
}

// Turns a caught error into the bare message (the C++ side compares against exactly this).
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------- describe.json

// Level-up descriptions, destiny, pending options, avoid lists and the three choice encodings.
function describeCases() {
  const cases = [];
  for (let i = 0; i < 300; i++) {
    const levelUps = i < 295 ? rnd(151) : 499;
    const id = 1 + rnd(2 ** 30);
    const choices = makeChoices(levelUps);
    const description = describe(id, levelUps, choices);
    // Every 3rd case avoids 1 to 4 rewards: the first one is really offered to this brute, the rest are random.
    let avoid: string[] = [];
    if (i % 3 === 0) {
      const offered = description.levels.map((l) => l.opts[0]).filter((o): o is Extract<LevelOption, { t: "b" }> => o.t === "b");
      const count = 1 + rnd(4);
      for (let k = 0; k < count; k++) {
        const b = k === 0 && offered.length ? pick(offered) : pick(BONUSES);
        const key = bonusKey(b.kind, b.id);
        if (!avoid.includes(key)) avoid.push(key);
      }
    }
    const hex = bitsToHex(choices, levelUps);
    cases.push({
      i, id, levelUps, choices, description,
      destiny: destiny(id),
      pending: pendingOptions(id, levelUps, choices),
      avoid,
      applied: applyAvoid(id, levelUps, choices, avoid),
      hex, b64: bitsToB64(choices, levelUps), hexBack: hexToChoices(hex, levelUps),
    });
  }
  return cases;
}

// ---------------------------------------------------------------- stance.json

// nearestIdWithStance: different stances, taken lists and ranges, including a search that finds nothing.
function stanceCases() {
  const cases = [];
  for (let i = 0; i < 20; i++) {
    const from = 1 + rnd(2 ** 30);
    // stance null is common, 0 and 1 are rare, so rare ones get a wide range
    const stance: number | null = i < 8 ? null : i % 2 ? 0 : 1;
    let range = stance === null ? 1000 : 3000;
    let taken: number[] = i % 4 === 0 ? [from, from + 1, from - 1] : [];
    if (i === 18 || i === 19) { range = 5; } // the two small-range cases
    if (i === 19) taken = []; // a rare stance within 5 ids: expected to find nothing
    cases.push({ i, from, stance, taken, range, result: nearestIdWithStance(from, stance, taken, range) });
  }
  return cases;
}

// ---------------------------------------------------------------- payloads.json

// One payload case: build the params, then read them back. Errors are recorded instead of thrown.
function payloadCase(i: number, spec: FightSpec, mini: string, end: string) {
  const key = makeKey();
  const out: Record<string, unknown> = { i, spec, mini, end, key, validate: validateSpec(spec) };
  try {
    out.plain = payloadPlain(spec, { mini, end });
    out.params = buildParams(spec, { mini, end, key });
    out.reimported = importPayload(out.params as string).spec;
  } catch (e) {
    out.plain = null; out.params = null; out.reimported = null; out.error = errorMessage(e);
  }
  return out;
}

// Ten specs that validateSpec must complain about, each in a different way.
function invalidSpecs(): FightSpec[] {
  const base = () => makeSpec(1, () => 5, null, null);
  const list: FightSpec[] = [];
  const add = (change: (s: FightSpec) => void) => { const s = base(); change(s); list.push(s); };
  add((s) => { s.brutes[1].id = s.brutes[0].id; });                       // shared ids
  add((s) => { s.brutes[0].levelUps = 599; s.brutes[0].choices = makeChoices(599); }); // level 600
  add((s) => { s.brutes[0].gfx = "1;2"; });                               // bad appearance
  add((s) => { s.brutes.pop(); });                                        // team 1 empty
  add((s) => { s.brutes.forEach((b) => { b.team = 1; }); });              // team 0 empty
  add((s) => { s.brutes[0].id = 0; });                                    // id too small
  add((s) => { s.brutes[1].id = 2 ** 31; });                              // id too big
  add((s) => { s.seed = 1.5; s.arena = -1; });                            // seed and arena
  add((s) => { s.brutes[0].choices = []; s.brutes[0].levelUps = 8; });    // missing choices
  add((s) => { s.p0 = teamProps({ st: { ...s.brutes[0], team: 0 } }); s.brutes[1].gfx = "x"; }); // support shares an id + bad gfx
  return list;
}

// Every example payload re-built, 200 generated specs, unicode names and 10 invalid specs.
function payloadCases() {
  const cases: Record<string, unknown>[] = [];
  const add = (spec: FightSpec, mini?: string, end?: string) => {
    const i = cases.length;
    cases.push(payloadCase(i, spec, mini ?? (i % 2 ? "mini_perso.swf" : "http://localhost/swf/mini_perso.swf"), end ?? (i % 2 ? "javascript:()" : "javascript:showEnd()")));
  };
  for (const ex of examplePayloads) {
    const { spec, source } = importPayload(ex.params);
    add(spec, source.mini ?? "", source.end ?? "");
  }
  for (let n = 0; n < 200; n++) {
    const two = n % 2 === 1;
    const level = () => rnd(80);
    const flavour = n % 5; // 0 plain, 1 sabotage, 2 poison, 3 support, 4 everything
    const side = (): Parameters<typeof teamProps>[0] | null => (flavour === 0 ? null : { sab: flavour === 1 || flavour === 4, poi: flavour === 2 || flavour === 4 });
    const p0Opts = side();
    const p1Opts = flavour >= 3 ? side() : null;
    const spec = makeSpec(two ? 2 : 1, level, p0Opts, p1Opts);
    if (flavour >= 3) {
      // flavours 3 and 4 also give team 0 a support brute
      const support = makeBrute(0, rnd(40), spec.brutes.map((b) => b.id));
      spec.p0 = teamProps({ ...p0Opts, st: support });
    }
    add(spec);
  }
  for (const name of UNICODE_NAMES) {
    const spec = makeSpec(1, () => 12, null, null);
    spec.brutes[0].name = name;
    spec.brutes[1].name = `${name} II`;
    add(spec);
  }
  invalidSpecs().forEach((spec) => add(spec));
  return cases;
}

// ---------------------------------------------------------------- imports.json

// Pasted-text variants of a payload: whitespace, newline, truncated data, wrong key, plus plain junk.
function importCases() {
  const texts: string[] = [];
  const good = (n: number) => examplePayloads[n % examplePayloads.length].params;
  for (let n = 0; n < examplePayloads.length; n++) texts.push(good(n));
  const p = good(0);
  const generated = buildParams(makeSpec(1, () => 20, null, null), { mini: "mini_perso.swf", end: "javascript:()", key: makeKey() });
  texts.push(generated, "  " + p, p + "  ", p + "\n", "\n\n" + p + "\r\n", "\t" + generated + " \n");
  // Cut the data= part short (a copy that lost its tail), keeping &k= so only the data is wrong.
  const dataEnd = p.indexOf("&k=");
  texts.push(p.slice(0, Math.floor(dataEnd / 2)) + p.slice(dataEnd), p.slice(0, Math.floor(dataEnd / 2)), p.slice(0, dataEnd));
  // A wrong key, a missing key and a key of the wrong length.
  texts.push(p.replace(/k=[^&]+/, "k=wrongkey"), p.replace(/k=[^&]+/, "k=a"), p.replace(/&k=[^&]+/, ""));
  texts.push(generated.replace(/k=[^&]+/, "k=ZZZZZZZZ"));
  texts.push("", "hello world", "data=", "data=abc&k=12345678", "lang=fr&" + p.replace(/&lang=[^&]*/, ""));
  return texts.map((text, i) => {
    try {
      return { i, text, ok: true, spec: importPayload(text).spec };
    } catch (e) {
      return { i, text, ok: false, error: errorMessage(e) };
    }
  });
}

// ---------------------------------------------------------------- fights.json

// Picks level-ups until a brute that owns at least one pet comes up (deterministic, since it only uses the LCG).
function petBrute(team: 0 | 1, taken: number[]): SpecBrute {
  for (;;) {
    const b = makeBrute(team, 30 + rnd(80), taken.slice());
    if (describe(b.id, b.levelUps, b.choices).fin.followers.length) { taken.push(b.id); return b; }
  }
}

// The nine kinds of fight the answer key covers; case i uses kind i % 9.
function fightSpecFor(i: number): FightSpec {
  switch (i % 9) {
    case 0: return makeSpec(1, () => rnd(10), null, null);                         // 1v1 low level
    case 1: return makeSpec(1, () => 20 + rnd(40), null, null);                    // 1v1 mid level
    case 2: return makeSpec(1, () => 100 + rnd(51), null, null);                   // 1v1 high level
    case 3: return makeSpec(2, () => 5 + rnd(60), null, null);                     // 2v2
    case 4: {                                                                      // pets: both sides own pets
      const taken: number[] = [];
      const first = petBrute(0, taken);
      const second = petBrute(1, taken);
      return { seed: rnd(2 ** 30), arena: rnd(6), brutes: [first, second], p0: null, p1: null, lang: pick(LANGS) };
    }
    case 5: {                                                                      // support brute on each side
      const spec = makeSpec(1, () => 10 + rnd(50), { st: undefined }, { st: undefined });
      const taken = spec.brutes.map((b) => b.id);
      spec.p0 = teamProps({ st: makeBrute(0, rnd(30), taken) });
      spec.p1 = teamProps({ st: makeBrute(1, rnd(30), taken) });
      return spec;
    }
    case 6: return makeSpec(1, () => 10 + rnd(60), { sab: true }, { sab: i % 2 === 0 }); // sabotage
    case 7: return makeSpec(2, () => 10 + rnd(60), { poi: true }, { poi: i % 2 === 0 }); // poison
    default: return makeSpec(2, () => 20 + rnd(80), { sab: true, poi: true }, { poi: true });   // a bit of everything
  }
}

// Runs each fight and records the engine input, the result, the stats and the fight log in 5 flavours.
function fightCases(count: number) {
  const cases = [];
  for (let i = 0; i < count; i++) {
    const spec = fightSpecFor(i);
    const result = runFight(spec);
    // Same list ArenaPanel.tsx hands to FightLog.format.
    const logGlads = spec.brutes.map((b) => ({ id: b.id, name: b.name, team: b.team, life: describe(b.id, b.levelUps, b.choices).fin.life }));
    cases.push({
      i, spec,
      input: toEngineInput(spec),
      result,
      stats: [...extractStats(result).values()],
      pets: extractPetStats(result),
      logGlads,
      logRaw: FightLog.format(result.history, logGlads),
      log: Object.fromEntries(NAME_LANGS.map((lang) => [lang, FightLog.format(localizeHistory(result.history, lang), logGlads)])),
    });
  }
  return cases;
}

// ---------------------------------------------------------------- misc.json

// Appearance strings: 40 good ones plus 20 broken ones the parser must cope with.
function gfxCases() {
  const inputs: string[] = Array.from({ length: 40 }, makeGfx);
  inputs.push(
    "", "1;2", "a;b;c", "0;0;0;0;0;0;0;0;0;0;0;-1;-1;-1;-1;-1", "0;-1;0;0;0;0;0;0;0;0;0;0;0;0;0;0",
    "0;0;0;0;0;0;0;0;0;0;0;1;2;3;4;5;6", "-5;-5;-5;-5;-5;-5;-5;-5;-5;-5;-5;-5;-5;-5;-5;-5", "1;0;99;99;99;99;99;99;99;99;99;99;99;99;99;99",
    "0;0;1234567;0;0;0;0;0;0;0;0;0;0;0;0;0", " 0; 0;1;2;3;4;5;6;7;8;9;10;11;12;13;14", "0;0;1.5;2;3;4;5;6;7;8;9;10;11;12;13;14",
    "0;0;1;2;3;4;5;6;7;8;9;10;11;12;13;", ";;;;;;;;;;;;;;;", "0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0", "99;99;99;99;99;99;99;99;99;99;99;99;99;99;99;99",
    "1;1;1;1;1;1;1;1;1;1;1;-1;-1;-1;-1;-1", "x", "0;0;1e3;0;0;0;0;0;0;0;0;0;0;0;0;0", "007;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0", "0,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14",
  );
  return inputs.map((input) => {
    const parts = gfxParts(input);
    return {
      in: input, parts, string: gfxString(parts), hash: gfxHash(parts),
      perso: persoParams(input), persoFlipHead: persoParams(input, { stop: true, flip: true, head: true }),
      valid: isValidGfx(input),
    };
  });
}

// Reward names: every bonus in all four languages.
const nameCases = () => BONUSES.flatMap((b) => NAME_LANGS.map((lang) => ({ kind: b.kind, id: b.id, lang, name: bonusName(b.kind, b.id, lang) })));

// Option texts: real level-up options (rewards and stat boosts) in random languages.
function optionCases() {
  const out = [];
  while (out.length < 40) {
    const id = 1 + rnd(2 ** 30);
    const levels = describe(id, 12, makeChoices(12)).levels;
    const opt = pick(levels).opts[rnd(2)];
    const lang = pick(LANGS);
    out.push({ opt, lang, text: optionText(opt, lang) });
  }
  return out;
}

// inventory.swf parameters for random brutes.
function inventoryCases() {
  return Array.from({ length: 20 }, (_, n) => {
    const levelUps = rnd(80);
    const brute = { id: 1 + rnd(2 ** 30), levelUps, choices: makeChoices(levelUps) };
    const lang = LANGS[n % 4];
    const ownedOnly = n % 3 === 0;
    return { brute, lang, ownedOnly, params: inventoryParams(brute, { lang, ownedOnly }) };
  });
}

const miscCases = () => ({ gfx: gfxCases(), names: nameCases(), options: optionCases(), inventory: inventoryCases() });

// ---------------------------------------------------------------- lab-actions.json

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const ACTION_KINDS = ["load", "select", "updateBrute", "resetBrute", "addBrute", "removeBrute", "setFight", "setTeam"] as const;

// The fixed state every sequence starts from (built by hand, not by initLab(), which is random).
function labStart(): LabState {
  const brutes: SpecBrute[] = [
    { name: "Alpha", id: 11111111, team: 0, levelUps: 6, gfx: "0;0;1;2;3;4;5;6;7;8;9;10;11;12;13;14", choices: [1, 0, 1, 1, 0, 0] },
    { name: "Beta", id: 22222222, team: 1, levelUps: 4, gfx: "1;0;14;13;12;11;10;9;8;7;6;5;4;3;2;1", choices: [0, 0, 1, 0] },
  ];
  const spec: FightSpec = { seed: 424242, arena: 2, brutes, p0: null, p1: null, lang: "en" };
  return { spec, originals: clone(brutes), selected: 0, sourceLabel: "Fixture start" };
}

// A patch for updateBrute; `kind` chooses which fields change (levelUps, choices, avoid, name, gfx or several).
function brutePatch(b: SpecBrute, kind: number): Partial<SpecBrute> {
  switch (kind) {
    case 0: return { levelUps: rnd(40) };                                       // level change keeps old choices
    case 1: { const n = rnd(30); return { levelUps: n, choices: makeChoices(n + rnd(3)) }; } // new choices, maybe too long
    case 2: return { choices: makeChoices(b.levelUps) };                        // choices only
    case 3: return { avoid: [0, 1].map(() => { const x = pick(BONUSES); return bonusKey(x.kind, x.id); }) }; // avoid list
    case 4: return { avoid: [] };                                               // clear the avoid list
    case 5: return { name: pick(NAMES), gfx: makeGfx() };                       // plain fields
    default: return { levelUps: 20 + rnd(60), avoid: [bonusKey("Weapons", "AXE")] }; // level and avoid together
  }
}

// Builds one action of the given kind that makes sense for the current state (indexes mostly in range).
function makeAction(kind: (typeof ACTION_KINDS)[number], s: LabState): LabAction {
  const n = s.spec.brutes.length;
  const index = () => (n ? rnd(n) : 0);
  switch (kind) {
    case "load": {
      const spec = makeSpec(1 + rnd(2), () => rnd(30), rnd(2) ? { sab: true } : null, null);
      return { type: "load", spec, label: `Loaded ${rnd(1000)}` };
    }
    case "select": return { type: "select", index: rnd(4) === 0 ? null : index() };
    case "updateBrute": return { type: "updateBrute", index: index(), patch: brutePatch(s.spec.brutes[index()] ?? makeBrute(0, 0, []), rnd(7)) };
    case "resetBrute": return { type: "resetBrute", index: rnd(5) === 0 ? n + 1 : index() }; // sometimes out of range
    case "addBrute": return { type: "addBrute", brute: makeBrute(rnd(2) as 0 | 1, rnd(25), s.spec.brutes.map((b) => b.id)) };
    case "removeBrute": {
      // pick the selected row, a row below it, or any row
      const sel = s.selected;
      const mode = rnd(3);
      const target = mode === 0 && sel !== null ? sel : mode === 1 && sel !== null && sel > 0 ? sel - 1 : index();
      return { type: "removeBrute", index: target };
    }
    case "setFight": return { type: "setFight", patch: pick([{ seed: rnd(2 ** 30) }, { arena: rnd(6) }, { lang: pick(LANGS) }, { seed: rnd(1000), arena: rnd(6), lang: pick(LANGS) }]) };
    case "setTeam": {
      const support = makeBrute(0, rnd(20), s.spec.brutes.map((b) => b.id));
      const patch = pick([{ _sab: true }, { _sab: null }, { _poi: true }, { _poi: null }, { _st: toSupport(support) }, { _st: null }, { _sab: true, _poi: true }]);
      return { type: "setTeam", team: rnd(2) as 0 | 1, patch };
    }
  }
}

// 30 action sequences; sequence k opens with action kind k % 8 so every kind is always covered.
function labActionCases() {
  const cases = [];
  for (let i = 0; i < 30; i++) {
    let state = labStart();
    const start = clone(state);
    const actions: LabAction[] = [];
    const states: LabState[] = [];
    const length = 4 + rnd(5);
    for (let k = 0; k < length; k++) {
      const kind = k === 0 ? ACTION_KINDS[i % 8] : pick(ACTION_KINDS);
      const action = makeAction(kind, state);
      state = labReducer(state, action);
      actions.push(clone(action));
      states.push(clone(state));
    }
    cases.push({ i, start, actions, states });
  }
  return cases;
}

// ---------------------------------------------------------------- the public entry points

// All fixture files: file name -> contents. Starts the LCG over so the output never changes.
// `fightCount` is the number of generated fights (300 unless the size limit forces fewer).
export function buildFixtures(fightCount = 300): Record<string, unknown> {
  st = 123456789;
  return {
    "describe.json": describeCases(),
    "stance.json": stanceCases(),
    "payloads.json": payloadCases(),
    "imports.json": importCases(),
    "fights.json": fightCases(fightCount),
    "misc.json": miscCases(),
    "lab-actions.json": labActionCases(),
  };
}

// Writes the fixture files into <labrute-native>/tests/fixtures/.
export function writeFixtures(target: string): void {
  const dir = join(target, "tests", "fixtures");
  mkdirSync(dir, { recursive: true });
  for (const [name, contents] of Object.entries(buildFixtures())) {
    writeFileSync(join(dir, name), JSON.stringify(contents));
  }
}
