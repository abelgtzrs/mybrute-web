import { describe, expect, it } from "vitest";
import { FightLog, bonusName, localizeHistory, newLabFight, optionText, runFight } from "../src";

describe("reward names from Lang.hx", () => {
  it("names rewards per language, falling back to English", () => {
    expect(bonusName("Weapons", "WOOD_CLUB", "fr")).toBe("Massue");
    expect(bonusName("Weapons", "IRON_CLUB", "fr")).toBe("Étoile du matin");
    expect(bonusName("Talent", "COOK", "es")).toBe("Jefe");
    expect(bonusName("Permanent", "SUPER_SPEED", "xx")).toBe("Lightning Bolt");
    expect(optionText({ t: "b", kind: "Followers", id: "BEAR", text: "Followers: Bear" }, "de")).toBe("Followers: Bär");
  });

  it("makes the fight log print weapon and pet names in the chosen language, unchanged otherwise", () => {
    for (let n = 0; n < 20; n++) {
      const spec = newLabFight();
      const sim = runFight(spec);
      const glads = spec.brutes.map((b) => ({ id: b.id, name: b.name, team: b.team, life: 100 }));
      const fr = FightLog.format(localizeHistory(sim.history, "fr"), glads).map((l: { text: string }) => l.text);
      const taken = sim.history.find((x: { a: string }) => x.a === "Weapon");
      if (!taken) continue;
      const id = typeof taken.p[1] === "object" ? taken.p[1].a : taken.p[1];
      expect(fr.join("\n")).toContain("takes " + bonusName("Weapons", id, "fr"));
      expect(FightLog.format(localizeHistory(sim.history, "en"), glads).length).toBe(FightLog.format(sim.history, glads).length);
      return;
    }
    throw new Error("no fight in 20 tries picked up a weapon");
  });
});
