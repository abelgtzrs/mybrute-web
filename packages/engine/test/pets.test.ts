import { describe, expect, it } from "vitest";
import { extractPetStats, extractStats, newLabFight, runFight } from "../src";

describe("pet stats", () => {
  it("adds up to each brute's pet damage in 1v1 fights", () => {
    let checked = 0;
    for (let n = 0; n < 60 && checked < 5; n++) {
      const spec = newLabFight();
      spec.brutes.forEach((b) => (b.levelUps = 30));
      const sim = runFight(spec);
      const pets = extractPetStats(sim);
      if (!pets.length || sim.history.some((e) => e.a === "Hypno")) continue;
      const stats = extractStats(sim);
      for (const b of spec.brutes) {
        const mine = pets.filter((p) => p.team === b.team);
        expect(mine.reduce((t, p) => t + p.damageDealt, 0)).toBe(stats.get(b.id)!.petDamageDealt);
        expect(mine.reduce((t, p) => t + p.damageReceived, 0)).toBe(stats.get(b.id)!.petDamageReceived);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
