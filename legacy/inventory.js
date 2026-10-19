// Inventory panel for brute cards: runs inventory.swf in Ruffle with a forged, encoded payload.
// inventory.swf reads data=<Codec string> & k=<key>; the decoded data is {_l: lang, _s: brute id, _level: level-ups, _bits: level-up choices, _a: flag}.
// Needs LaBrute (labrute.js) to expose encode, serHx, pencode, b64enc, choicesToBytes.
(function (root) {
  const LANGS = ["en", "fr", "es", "de"];
  const keyFor = id => { const A = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let h = (id * 2654435761) >>> 0, k = ""; for (let i = 0; i < 8; i++) { k += A[h % 62]; h = (Math.imul(h, 1103515245) + 12345) >>> 0; } return k; };
  function params(g, opts) {
    opts = opts || {}; const L = root.LaBrute;
    for (const f of ["encode", "serHx", "pencode", "b64enc", "choicesToBytes"]) if (typeof L[f] !== "function") throw new Error("labrute.js is missing " + f);
    const lang = LANGS.includes(opts.lang) ? opts.lang : "en";
    const Y = s => ({ k: "y", v: L.pencode(s) });
    const I = v => (v === 0 ? { k: "z" } : { k: "i", v: String(v) });
    const node = { k: "o", v: [
      [Y("_l"), Y(lang)], [Y("_s"), I(g.id)], [Y("_level"), I(g.lvl)],
      [Y("_bits"), { k: "s", v: L.b64enc(L.choicesToBytes(g.choices, g.lvl)) }],
      [Y("_a"), { k: opts.ownedOnly ? "t" : "f" }] ] };
    const key = keyFor(g.id);
    return "data=" + L.pencode(L.encode(L.serHx(node), key)) + "&k=" + key + "&lang=" + lang;
  }
  function mount(c) {
    if (c.inv) return c.inv;
    const det = c.el.querySelector("details") || c.el.querySelector(".invd"), box = det && det.querySelector(".inv");
    if (!det || !box) throw new Error("inventory container is missing");
    box.innerHTML = "<div class='invbar'><label><input type='checkbox' class='inva'> owned only (experimental)</label> " +
      "<label>language <select class='invl'>" + LANGS.map(l => "<option>" + l + "</option>").join("") + "</select></label></div><div class='invpl'></div>";
    const inv = c.inv = { det, box, pl: box.querySelector(".invpl"), all: box.querySelector(".inva"), lang: box.querySelector(".invl"), player: null, dirty: true, t: null };
    const sess = root.session; if (sess && sess.info && LANGS.includes(sess.info.lang)) inv.lang.value = sess.info.lang;
    inv.all.onchange = inv.lang.onchange = () => { inv.dirty = true; load(c); };
    det.addEventListener("toggle", () => { if (det.open) load(c); });
    if (det.open) setTimeout(() => load(c), 0);
    return inv;
  }
  function load(c) {
    const inv = mount(c); if (!inv.det.open || !inv.dirty) return; inv.dirty = false;
    try {
      const r = root.RufflePlayer.newest();
      if (!inv.player) { inv.player = r.createPlayer(); inv.player.style.width = "330px"; inv.player.style.height = "600px"; inv.pl.replaceChildren(inv.player); }
      inv.player.load({ url: "inventory.swf", parameters: params(c.g, { lang: inv.lang.value, ownedOnly: inv.all.checked }), base: ".", allowScriptAccess: false, letterbox: "on", contextMenu: "off", logLevel: "warn" });
    } catch (e) { inv.pl.textContent = "inventory unavailable: " + e.message; }
  }
  // call after any edit that changes the brute (level, choices, id, name)
  function refresh(c) { const inv = mount(c); inv.dirty = true; clearTimeout(inv.t); inv.t = setTimeout(() => load(c), 300); }
  function dispose(c) { if (c.inv) { clearTimeout(c.inv.t); if (c.inv.player) c.inv.player.remove(); c.inv = null; } }
  root.Inventory = { params, refresh, dispose, mount };
})(typeof window !== "undefined" ? window : globalThis);
