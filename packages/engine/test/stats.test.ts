import { describe, expect, it } from "vitest";
import { describe as describeBrute, extractStats, importPayload, runFight, type FightSpec } from "../src";
import golden from "./fixtures/golden.json";
import fights from "./fixtures/fights.json";

const specs: FightSpec[] = [
  ...fights.map((f) => importPayload(f.params).spec),
  ...golden.fights.map((f) => ({
    seed: f.input.seed, arena: 2, p0: null, p1: null, lang: "en",
    brutes: f.input.glads.map((g) => ({ name: g.n, id: g.s, team: g.t as 0 | 1, levelUps: g.lvl, gfx: g.gfx,
      choices: Array.from({ length: g.lvl }, (_, i) => ((parseInt(g.bits.slice((i >> 3) * 2, (i >> 3) * 2 + 2) || "0", 16) >> (i & 7)) & 1) as 0 | 1) })),
  })),
];

describe("combat statistics", () => {
  it("gives exactly one winner and one loser in 1v1", () => {
    for (const spec of specs) {
      const r = runFight(spec), s = [...extractStats(r).values()];
      expect(s.map((x) => x.result).sort()).toEqual(["loss", "win"]);
      expect(s.find((x) => x.result === "loss")!.died).toBe(true);
    }
  });

  it("damage dealt by one side equals direct damage received by the other", () => {
    for (const spec of specs) {
      const [a, b] = [...extractStats(runFight(spec)).values()];
      expect(a.damageDealt + a.petDamageDealt).toBe(b.damageReceived - b.poisonDamageReceived + b.petDamageReceived);
      expect(b.totalDamageDealt).toBe(a.damageReceived - a.poisonDamageReceived + a.petDamageReceived);
    }
  });

  it("a loser without bombs or downpours against it took at least its life in damage", () => {
    for (const spec of specs) {
      const r = runFight(spec);
      if (r.history.some((e) => e.a === "Bomb" || e.a === "Downpour")) continue;
      const loser = [...extractStats(r).values()].find((x) => x.result === "loss")!;
      const b = spec.brutes.find((x) => x.id === loser.id)!;
      const life = describeBrute(b.id, b.levelUps, b.choices).fin.life;
      expect(loser.damageReceived).toBeGreaterThanOrEqual(life - loser.lifeRestored - 1);
    }
  });

  it("event-derived dodges agree with the engine's own DODGE counter", () => {
    for (const spec of specs) {
      for (const s of extractStats(runFight(spec)).values()) expect(s.dodges).toBe(s.teamCounters.DODGE);
    }
  });

  it("counts a repeated Death only once", () => {
    const r = runFight(specs[0]);
    const deathId = r.history.find((e) => e.a === "Death")!.p[0];
    const dup = { ...r, history: [...r.history, { a: "Death", p: [deathId] }] };
    expect([...extractStats(dup).values()].map((s) => s.enemyBrutesDown)).toEqual([...extractStats(r).values()].map((s) => s.enemyBrutesDown));
  });
});
