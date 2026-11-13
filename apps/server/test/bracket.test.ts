import { randomInt } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bitsToHex, displayLevel, randomGfx, runFight } from "@mybrute/engine";
import { simulateBracket, type Snapshot } from "../src/bracket";

const rand = (n: number) => randomInt(n);

function snapshot(levelUps: number): Snapshot {
  const choices = Array.from({ length: levelUps }, () => rand(2) as 0 | 1);
  return { seedId: 123456, name: "Tester", gfx: randomGfx(rand), levelUps, bits: bitsToHex(choices, levelUps) };
}

describe("simulateBracket", () => {
  it("plays the brute's path through a 16-brute bracket", () => {
    const snap = snapshot(9);
    const rounds = simulateBracket(snap, 0, 16, rand);
    expect(rounds.length).toBeGreaterThanOrEqual(1);
    expect(rounds.length).toBeLessThanOrEqual(4);
    rounds.slice(0, -1).forEach((r) => expect(r.result).toBe("win"));
    if (rounds.length < 4) expect(rounds[rounds.length - 1].result).toBe("loss");
    const ids = rounds.map((r) => r.opponent.seedId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(snap.seedId);
    for (const r of rounds) {
      const level = displayLevel(r.opponent.levelUps);
      expect(level).toBeGreaterThanOrEqual(10);
      expect(level).toBeLessThanOrEqual(15);
    }
  });

  it("stores specs that replay to the stored result", () => {
    const snap = snapshot(9);
    for (const round of simulateBracket(snap, 0, 16, rand)) {
      const win = runFight(round.spec).win;
      if (win !== null) expect(win).toBe(round.result === "win" ? 0 : 1);
      expect(round.spec.brutes[0].id).toBe(snap.seedId);
    }
  });

  it("a champion wins every round of a 256 bracket", () => {
    const start = Date.now();
    const rounds = simulateBracket(snapshot(499), 0, 256, rand);
    expect(rounds.length).toBe(8);
    rounds.forEach((r) => expect(r.result).toBe("win"));
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
