import { describe as group, expect, it } from "vitest";
import { BONUSES, applyAvoid, bonusKey, describe, randomChoices } from "../src";

const finHas = (fin: ReturnType<typeof describe>["fin"], kind: string, id: string) =>
  ({ Weapons: fin.weapons, Super: fin.supers, Followers: fin.followers, Permanent: fin.perms, Talent: fin.talents } as Record<string, string[]>)[kind]?.includes(id);

group("avoid list", () => {
  it("lists every reward the engine can offer", () => {
    const keys = new Set(BONUSES.map((b) => bonusKey(b.kind, b.id)));
    expect(keys.size).toBe(BONUSES.length);
    for (let s = 0; s < 60; s++) {
      for (const lv of describe(1000 + s * 7907, 120, randomChoices(120)).levels) {
        for (const o of lv.opts) if (o.t === "b") expect(keys.has(bonusKey(o.kind, o.id))).toBe(true);
      }
    }
  });

  it("never leaves an avoided reward chosen, and the brute never ends up owning it", () => {
    const avoid = ["Weapons:SWORD", "Weapons:KNIFE", "Super:NET", "Followers:DOG_0", "Permanent:SHIELD", "Talent:SPY"];
    for (let s = 0; s < 40; s++) {
      const id = 5000 + s * 104729, n = 30 + (s % 5) * 30;
      const { choices } = applyAvoid(id, n, randomChoices(n), avoid);
      const d = describe(id, n, choices);
      d.levels.forEach((lv) => {
        if (lv.bit === 0 && lv.opts[0].t === "b") expect(avoid).not.toContain(bonusKey(lv.opts[0].kind, lv.opts[0].id));
      });
      for (const key of avoid) { const [kind, bid] = key.split(":"); expect(finHas(d.fin, kind, bid)).toBeFalsy(); }
    }
  });

  it("only changes the levels it reports, and switches them to the second option", () => {
    const id = 18327968, n = 80, before = randomChoices(n);
    const { choices, forced } = applyAvoid(id, n, before, ["Weapons:LANCE", "Permanent:SUPER_LIFE", "Weapons:WOOD_CLUB"]);
    choices.forEach((c, i) => {
      if (forced.includes(i)) { expect(before[i]).toBe(0); expect(c).toBe(1); }
      else expect(c).toBe(before[i]);
    });
  });

  it("does nothing with an empty list", () => {
    const before = randomChoices(50);
    expect(applyAvoid(42, 50, before, [])).toEqual({ choices: before, forced: [] });
  });
});
