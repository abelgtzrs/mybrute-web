// Turns the original simulator's action history into readable log lines.
(function (root) {
  const en = v => (v && typeof v === "object" && "a" in v ? v.a : v);
  const pretty = s => String(en(s)).split("_").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
  // glads: [{id,name,team,life}]  history: FightAPI.run(...).history
  function format(history, glads) {
    const name = {}, life = {}, hp = {}, dead = new Set(); const lines = [];
    glads.forEach(g => { name[g.id] = g.name; life[g.id] = g.life; hp[g.id] = g.life; });
    const N = id => (name[id] !== undefined ? name[id] : "#" + id);
    const hpTxt = id => (hp[id] !== undefined ? "  [" + N(id) + " " + Math.max(0, hp[id]) + "/" + life[id] + "]" : "");
    const dmg = (id, d) => { if (hp[id] !== undefined) hp[id] -= d; };
    const add = (i, kind, text) => lines.push({ i, kind, text });
    history.forEach((x, i) => {
      const p = x.p;
      switch (x.a) {
        case "AddFighter": name[p[0]] = p[5]; add(i, "info", p[5] + " (level " + (p[3] + 1) + ") joins team " + p[1]); break;
        case "AddFollower": name[p[0]] = pretty(p[2]) + " (team " + p[1] + ")"; add(i, "info", pretty(p[2]) + " joins team " + p[1]); break;
        case "Leave": add(i, "info", N(p[0]) + " leaves the fight"); break;
        case "MoveTo": add(i, "move", N(p[0]) + " moves toward " + N(p[1])); break;
        case "MoveBack": add(i, "move", N(p[0]) + " returns"); break;
        case "Weapon": add(i, "info", N(p[0]) + " takes " + pretty(p[1]) + (p[2] ? " (sabotaged)" : "")); break;
        case "Trash": add(i, "info", N(p[0]) + " throws away the weapon"); break;
        case "Attack": {
          const [a, t, d, sab, dis, disShield, disAtt] = p; let t1;
          if (d < 0) t1 = N(a) + " attacks " + N(t) + " -> dodged";
          else if (d === 0) t1 = N(a) + " attacks " + N(t) + " -> blocked";
          else { t1 = N(a) + " hits " + N(t) + " for " + d; dmg(t, d); }
          const extra = [];
          if (sab) extra.push("destroys " + N(t) + "'s " + pretty(sab));
          if (dis) extra.push("knocks away " + N(t) + "'s weapon");
          if (disShield) extra.push("breaks " + N(t) + "'s shield");
          if (disAtt) extra.push(N(a) + "'s weapon is knocked away");
          add(i, d > 0 ? "hit" : "miss", t1 + (extra.length ? "  (" + extra.join("; ") + ")" : "") + (d > 0 ? hpTxt(t) : "")); break; }
        case "ThrowAttack": dmg(p[1], p[2]); add(i, "hit", N(p[0]) + " throws a weapon at " + N(p[1]) + " for " + p[2] + hpTxt(p[1])); break;
        case "Steal": add(i, "info", N(p[0]) + " steals " + N(p[1]) + "'s weapon"); break;
        case "Grab": dmg(p[1], p[2]); add(i, "hit", N(p[0]) + " grabs " + N(p[1]) + " for " + p[2] + hpTxt(p[1])); break;
        case "Bomb": add(i, "hit", N(p[0]) + " throws a bomb (" + p[1] + " damage to the last enemy hit; not tracked in HP)"); break;
        case "Medecine": if (hp[p[0]] !== undefined) hp[p[0]] = Math.min(life[p[0]], hp[p[0]] + p[1]); add(i, "info", N(p[0]) + " drinks a potion (+" + p[1] + " life)" + hpTxt(p[0])); break;
        case "Status": add(i, "info", N(p[0]) + (p[1] === 0 ? (p[2] ? " goes into a brute rage" : " calms down") : (p[2] ? " is caught in a net" : " is free of the net"))); break;
        case "Net": add(i, "info", N(p[0]) + " throws a net on " + N(p[1])); break;
        case "Escape": add(i, "info", N(p[0]) + " escapes"); break;
        case "Hypno": add(i, "info", N(p[0]) + " hypnotizes " + p[1].map(N).join(", ")); break;
        case "Downpour": add(i, "hit", N(p[0]) + " calls a downpour of " + p[1].map(pretty).join(", ") + " (not tracked in HP)"); break;
        case "Eat": if (hp[p[0]] !== undefined) hp[p[0]] = Math.min(life[p[0]], hp[p[0]] + p[1]); add(i, "info", N(p[0]) + " eats " + N(p[2]) + " (+" + p[1] + " life)"); break;
        case "Poison": dmg(p[0], p[1]); add(i, "hit", N(p[0]) + " takes " + p[1] + " poison damage" + hpTxt(p[0])); break;
        case "FxResistDamage": add(i, "info", N(p[0]) + " resists the damage"); break;
        case "Death": add(i, "death", N(p[0]) + (dead.has(p[0]) ? " is dead (event repeated by the original engine)" : " is dead")); dead.add(p[0]); break;
        case "EndFight": add(i, "end", "Team " + p[0] + " wins the fight"); break;
        default: add(i, "info", x.a + " " + JSON.stringify(p));
      }
    });
    return lines;
  }
  const api = { format };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.FightLog = api;
})(typeof window !== "undefined" ? window : globalThis);
