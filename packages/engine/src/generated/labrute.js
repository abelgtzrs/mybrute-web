// GENERATED from vendor/labrute.js by scripts/gen-esm.mjs. Do not edit.
/* eslint-disable */
// @ts-nocheck
const module = { exports: {} };
// ---- vendor source begins ----
// LaBrute client.swf FlashVars codec + Haxe serializer helpers (port of the Python tools)
(function (root) {
  const T64 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
  function state(key) {
    const S = new Array(256);
    for (let i = 0; i < 256; i++) S[i] = (i & 127) & 255;
    let j = 0; const n = key.length;
    for (let i = 0; i < 256; i++) {
      j = (j + S[i] + key.charCodeAt(i % n)) & 127;
      const t = S[i]; S[i] = S[j] & 255; S[j] = t & 255;
    }
    return S;
  }
  function chk(a, b) {
    const r = a ^ (b << 8); let s = "";
    for (const sh of [0, 6, 12, 18]) s += T64[(r >> sh) & 63];
    return s;
  }
  function decode(data, key) {
    const S = state(key); let a = S[0], b = S[1]; let out = "";
    const n = data.length - 4;
    for (let i = 0; i < n; i++) {
      const c = data.charCodeAt(i), x = c ^ S[i & 255];
      out += String.fromCharCode(x !== 0 ? x : c);
      const cc = x === 0 ? 0 : c;
      a = (a + cc) % 65521; b = (b + a) % 65521;
    }
    return { plain: out, ok: data.slice(-4) === chk(a, b) };
  }
  function encode(plain, key) {
    const S = state(key); let a = S[0], b = S[1]; let out = "";
    for (let i = 0; i < plain.length; i++) {
      const c = plain.charCodeAt(i), x = c ^ S[i & 255];
      out += String.fromCharCode(x !== 0 ? x : c);
      a = (a + x) % 65521; b = (b + a) % 65521;
    }
    return out + chk(a, b);
  }
  function pdecode(s) { // percent-decode to a latin1 string
    let o = "";
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "%" && /^[0-9a-fA-F]{2}$/.test(s.substr(i + 1, 2))) { o += String.fromCharCode(parseInt(s.substr(i + 1, 2), 16)); i += 2; }
      else o += s[i];
    }
    return o;
  }
  function pencode(s) { // keep A-Za-z0-9 _ . - ~ ; everything else %XX
    let o = "";
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (/[A-Za-z0-9_.\-~]/.test(ch)) o += ch;
      else o += "%" + s.charCodeAt(i).toString(16).toUpperCase().padStart(2, "0");
    }
    return o;
  }
  // ---- Haxe 2 serializer subset (strings kept in raw url-encoded form) ----
  function parseHx(t) {
    let p = 0; const cache = [];
    const num = () => { const s = p; while (p < t.length && "+-0123456789.eE".includes(t[p])) p++; return t.slice(s, p); };
    function get() {
      const c = t[p++];
      switch (c) {
        case "n": return { k: "n" }; case "z": return { k: "z" }; case "t": return { k: "t" }; case "f": return { k: "f" };
        case "i": return { k: "i", v: num() }; case "d": return { k: "d", v: num() };
        case "y": { const n = parseInt(num(), 10); p++; const raw = t.substr(p, n); p += n; cache.push(raw); return { k: "y", v: raw }; }
        case "R": { const i = parseInt(num(), 10); return { k: "y", v: cache[i] }; }
        case "s": { const n = parseInt(num(), 10); p++; const raw = t.substr(p, n); p += n; return { k: "s", v: raw }; }
        case "a": { const a = []; while (t[p] !== "h") a.push(get()); p++; return { k: "a", v: a }; }
        case "o": { const f = []; while (t[p] !== "g") { const key = get(); f.push([key, get()]); } p++; return { k: "o", v: f }; }
        default: throw new Error("unsupported serializer tag '" + c + "' at " + (p - 1));
      }
    }
    return get();
  }
  function serHx(node) {
    const cache = new Map();
    function w(n) {
      switch (n.k) {
        case "n": return "n"; case "z": return "z"; case "t": return "t"; case "f": return "f";
        case "i": return "i" + n.v; case "d": return "d" + n.v;
        case "y": if (cache.has(n.v)) return "R" + cache.get(n.v); cache.set(n.v, cache.size); return "y" + n.v.length + ":" + n.v;
        case "s": return "s" + n.v.length + ":" + n.v;
        case "a": return "a" + n.v.map(w).join("") + "h";
        case "o": return "o" + n.v.map(([k, v]) => w(k) + w(v)).join("") + "g";
      }
    }
    return w(node);
  }
  const field = (obj, name) => { const f = obj.v.find(([k]) => pdecode(k.v) === name); return f ? f[1] : null; };
  const setField = (obj, name, val) => { const f = obj.v.find(([k]) => pdecode(k.v) === name); if (f) f[1] = val; };
  // ---- user-facing helpers ----
  function parseInput(text) {
    let t = String(text).replace(/&amp;/g, "&");
    const i = t.indexOf("data="); if (i < 0) throw new Error("no 'data=' found in the pasted text");
    t = t.slice(i).split(/["'`\s]/)[0];
    const params = {};
    for (const part of t.split("&")) { const j = part.indexOf("="); if (j > 0) params[part.slice(0, j)] = part.slice(j + 1); }
    if (!params.data) throw new Error("empty data parameter");
    if (!params.k) throw new Error("no k= parameter found (it is the key; the payload can't be decoded without it)");
    return { data: params.data, k: params.k, lang: params.lang || "en" };
  }
  function convert(text, opts) {
    opts = opts || {};
    const inp = parseInput(text);
    const d = decode(pdecode(inp.data), inp.k);
    if (!d.ok) throw new Error("checksum mismatch: wrong k, or the data was truncated/altered when copied");
    const ast = parseHx(d.plain);
    const mini = field(ast, "_mini"), end = field(ast, "_end");
    const info = { mini: mini && pdecode(mini.v), end: end && end.k === "y" ? pdecode(end.v) : null, lang: inp.lang, k: inp.k };
    setField(ast, "_mini", { k: "y", v: pencode(opts.mini || "mini_perso.swf") });
    if (end && end.k === "y") setField(ast, "_end", { k: "y", v: pencode(opts.end || "javascript:()") });
    const seed = field(ast, "_seed"); info.seed = seed && seed.v;
    const ar = field(ast, "_arena"); info.arena = ar && ar.v;
    info.glads = (field(ast, "_glads").v || []).map(g => ({ name: pdecode(field(g, "_n").v), lvl: +field(g, "_lvl").v, team: field(g, "_t").k === "z" ? 0 : +field(g, "_t").v, id: +field(g, "_s").v }));
    const enc = encode(serHx(ast), inp.k);
    return { params: "data=" + pencode(enc) + "&k=" + inp.k + "&lang=" + inp.lang, info, plain: d.plain };
  }
  const api = { state, decode, encode, pdecode, pencode, parseHx, serHx, parseInput, convert };

  // ---- bytes <-> Haxe base64 ("%:" alphabet) ----
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%:";
  function b64enc(bytes) {
    let out = "", bits = 0, n = 0;
    for (const x of bytes) { bits = (bits << 8) | x; n += 8; while (n >= 6) { n -= 6; out += B64[(bits >> n) & 63]; bits &= (1 << n) - 1; } }
    if (n) out += B64[(bits << (6 - n)) & 63];
    return out;
  }
  function b64dec(s) {
    const out = []; let bits = 0, n = 0;
    for (const ch of s) { bits = (bits << 6) | B64.indexOf(ch); n += 6; if (n >= 8) { n -= 8; out.push((bits >> n) & 255); bits &= (1 << n) - 1; } }
    return out;
  }
  // level-up choices: byte i, bit j (LSB first) = choice at level-up number i*8+j
  const bytesToChoices = (bytes, n) => Array.from({ length: n }, (_, i) => ((bytes[i >> 3] || 0) >> (i & 7)) & 1);
  function choicesToBytes(choices, n) {
    const b = new Array(Math.ceil(n / 8)).fill(0);
    for (let i = 0; i < n; i++) if (choices[i]) b[i >> 3] |= 1 << (i & 7);
    return b;
  }
  const intNode = v => v === 0 ? { k: "z" } : { k: "i", v: String(v) };
  const intVal = n => n.k === "z" ? 0 : parseInt(n.v, 10);
  // ---- editing session: open a payload, edit gladiators, get playable params back ----
  function open(text, opts) {
    opts = opts || {};
    const inp = parseInput(text);
    const d = decode(pdecode(inp.data), inp.k);
    if (!d.ok) throw new Error("checksum mismatch: wrong k, or the data was truncated/altered when copied");
    const ast = parseHx(d.plain);
    const mini = field(ast, "_mini"), end = field(ast, "_end");
    const info = { mini: mini && pdecode(mini.v), lang: inp.lang, k: inp.k, seed: intVal(field(ast, "_seed")), arena: intVal(field(ast, "_arena")) };
    setField(ast, "_mini", { k: "y", v: pencode(opts.mini || "mini_perso.swf") });
    if (end && end.k === "y") setField(ast, "_end", { k: "y", v: pencode(opts.end || "javascript:()") });
    const nodes = field(ast, "_glads").v;
    const glads = nodes.map(g => {
      const lvl = intVal(field(g, "_lvl"));
      return { name: pdecode(field(g, "_n").v), id: intVal(field(g, "_s")), team: intVal(field(g, "_t")),
               lvl, gfx: pdecode(field(g, "_gfx").v), choices: bytesToChoices(b64dec(field(g, "_bits").v), Math.max(lvl, 0)) };
    });
    function params() {
      glads.forEach((g, i) => {
        setField(nodes[i], "_lvl", intNode(g.lvl));
        setField(nodes[i], "_gfx", { k: "y", v: pencode(g.gfx) });
        setField(nodes[i], "_bits", { k: "s", v: b64enc(choicesToBytes(g.choices, g.lvl)) });
      });
      return "data=" + pencode(encode(serHx(ast), inp.k)) + "&k=" + inp.k + "&lang=" + inp.lang;
    }
    const plain = n => { switch (n.k) {
      case "n": return null; case "z": return 0; case "t": return true; case "f": return false;
      case "i": return parseInt(n.v, 10); case "d": return parseFloat(n.v); case "y": return pdecode(n.v);
      case "s": return b64dec(n.v).map(b => b.toString(16).padStart(2, "0")).join("");
      case "a": return n.v.map(plain);
      case "o": { const o = {}; n.v.forEach(([k, v]) => { o[pdecode(k.v)] = plain(v); }); return o; } } };
    const team = k => { const f = field(ast, k); return f ? plain(f) : null; };
    // input for the original simulator (FightAPI.run), reflecting the current edits
    function fightInput() {
      return { seed: info.seed,
        glads: glads.map(g => ({ s: g.id, t: g.team, gfx: g.gfx, lvl: g.lvl, bits: choicesToBytes(g.choices, g.lvl).map(b => b.toString(16).padStart(2, "0")).join(""), n: g.name })),
        p0: team("_p0"), p1: team("_p1") };
    }
    // support brute (team property _st) of each team that has one: {team,id,lvl,bits(hex),gfx}
    function supports() {
      return [0, 1].map(t => { const p = team("_p" + t); return p && p._st ? { team: t, id: p._st._s, lvl: p._st._lvl, bits: p._st._bits, gfx: p._st._gfx } : null; }).filter(Boolean);
    }
    const Y = str => ({ k: "y", v: pencode(str) });
    const mkGlad = g => ({ k: "o", v: [[Y("_bits"), { k: "s", v: b64enc(choicesToBytes(g.choices, g.lvl)) }], [Y("_n"), Y(g.name)], [Y("_s"), intNode(g.id)],
                                       [Y("_t"), intNode(g.team)], [Y("_gfx"), Y(g.gfx)], [Y("_lvl"), intNode(g.lvl)]] });
    // add a brute ({name,id,team,lvl,gfx,choices}); returns its index. ids must be unique (they are the fighter ids in the history)
    function addGlad(g) {
      if (glads.some(o => o.id === g.id)) throw new Error("a brute with id " + g.id + " already exists");
      const o = { name: g.name, id: g.id, team: g.team, lvl: g.lvl, gfx: g.gfx, choices: (g.choices || []).slice() };
      while (o.choices.length < o.lvl) o.choices.push(0);
      glads.push(o); nodes.push(mkGlad(o)); return glads.length - 1;
    }
    function removeGlad(i) {
      const t = glads[i].team;
      if (glads.filter(o => o.team === t).length < 2) throw new Error("team " + t + " needs at least one brute");
      glads.splice(i, 1); nodes.splice(i, 1);
    }
    function supportNode(t) { const p = field(ast, "_p" + t); return p && p.k === "o" ? field(p, "_st") : null; }
    const hexBytes = h => (String(h).replace(/[^0-9a-fA-F]/g, "").match(/../g) || []).map(x => parseInt(x, 16));
    function setSeed(n) { info.seed = n; setField(ast, "_seed", intNode(n)); }
    function setArena(n) { info.arena = n; setField(ast, "_arena", intNode(n)); }
    // edit a support brute: any of {id, lvl, bits (hex), gfx}
    function setSupport(t, v) {
      const st = supportNode(t); if (!st || st.k !== "o") throw new Error("team " + t + " has no support brute");
      if (v.id !== undefined) setField(st, "_s", intNode(v.id));
      if (v.lvl !== undefined) setField(st, "_lvl", intNode(v.lvl));
      if (v.bits !== undefined) setField(st, "_bits", { k: "s", v: b64enc(hexBytes(v.bits)) });
      if (v.gfx !== undefined) setField(st, "_gfx", Y(v.gfx));
    }
    return { info, glads, params, fightInput, addGlad, removeGlad, supports, setSeed, setArena, setSupport, hexBytes };
  }
  api.open = open; api.b64enc = b64enc; api.b64dec = b64dec; api.bytesToChoices = bytesToChoices; api.choicesToBytes = choicesToBytes;
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.LaBrute = api;
})(typeof window !== "undefined" ? window : globalThis);

// ---- vendor source ends ----

export const LaBrute = module.exports;
