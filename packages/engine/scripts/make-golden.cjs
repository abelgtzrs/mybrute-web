// Records reference outputs from the ORIGINAL, unpatched engine files in /legacy.
// The vendored engine (and its one-line FightAPI patch) must reproduce these exactly.
// Run once: node packages/engine/scripts/make-golden.cjs
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const legacy = path.join(__dirname, "../../../legacy");
const L = require(path.join(legacy, "labrute.js"));
const { GladAPI } = require(path.join(legacy, "glad.js"));
const { FightAPI } = require(path.join(legacy, "fight.js"));

const sha = (v) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
const clone = (v) => JSON.parse(JSON.stringify(v));

// small deterministic LCG so the random cases are reproducible
let st = 123456789;
const rnd = (n) => { st = (Math.imul(st, 1103515245) + 12345) >>> 0; return st % n; };

const payloads = require(path.join(__dirname, "../test/fixtures/fights.json")).map((f) => {
  const inp = L.parseInput(f.params);
  const d = L.decode(L.pdecode(inp.data), inp.k);
  const s = L.open(f.params);
  const fi = s.fightInput();
  const r = FightAPI.run(clone(fi));
  return {
    name: f.name,
    plain: d.plain,
    win: r.win,
    events: r.history.length,
    historySha: sha(r.history),
    describe: s.glads.map((g) => ({ id: g.id, lvl: g.lvl, ...GladAPI.describe(g.id, g.lvl, g.choices) })),
  };
});

const fights = [];
for (let i = 0; i < 60; i++) {
  const lvl = rnd(150);
  const mk = (t) => ({ s: 1 + rnd(2 ** 30), t, gfx: "0;0;1;2;3;4;5;6;7;8;9;10;11;12;13;14", lvl,
    bits: Array.from({ length: Math.ceil(lvl / 8) }, () => rnd(256).toString(16).padStart(2, "0")).join(""), n: "b" + t });
  const input = { seed: rnd(2 ** 30), glads: [mk(0), mk(1)], p0: null, p1: null };
  const r = FightAPI.run(clone(input));
  fights.push({ input, win: r.win, events: r.history.length, historySha: sha(r.history) });
}

const describes = [];
for (let i = 0; i < 40; i++) {
  const id = 1 + rnd(2 ** 31 - 2), n = rnd(200);
  const choices = Array.from({ length: n }, () => rnd(2));
  const d = GladAPI.describe(id, n, choices);
  describes.push({ id, n, choices, sha: sha(d), check: d.check });
}

const out = path.join(__dirname, "../test/fixtures/golden.json");
fs.writeFileSync(out, JSON.stringify({ generatedFrom: "legacy/ (original, unpatched)", payloads, fights, describes }, null, 1));
console.log("wrote", out, payloads.length, "payloads,", fights.length, "fights,", describes.length, "describes");
