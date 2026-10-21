import { describe as group, expect, it } from "vitest";
import { bitsToHex, describe, destiny, nearestIdWithStance, randomChoices, displayLevel, hexToChoices, levelUpsFor, pendingOptions, persoParams, gfxHash, isValidSeedId } from "../src";

group("progression adapters", () => {
  it("displayed level is level-ups + 1", () => {
    expect(displayLevel(0)).toBe(1);
    expect(levelUpsFor(66)).toBe(65);
  });

  it("pending options are the authentic next options, whatever gets chosen", () => {
    const id = 18327968, choices = [1, 0, 1, 1, 0, 0, 1];
    const opts = pendingOptions(id, choices.length, choices);
    expect(describe(id, 8, [...choices, 0]).levels[7].opts).toEqual(opts);
    expect(describe(id, 8, [...choices, 1]).levels[7].opts).toEqual(opts);
  });

  it("a choice only changes LATER options (and option 1 reseeds the RNG)", () => {
    const a = describe(42, 6, [0, 0, 0, 0, 0, 0]).levels, b = describe(42, 6, [0, 0, 1, 0, 0, 0]).levels;
    expect(a.slice(0, 3).map((l) => l.opts)).toEqual(b.slice(0, 3).map((l) => l.opts));
    expect(a.slice(3).map((l) => l.opts)).not.toEqual(b.slice(3).map((l) => l.opts));
  });

  it("matches the original setLevels for many brutes", () => {
    for (let i = 0; i < 50; i++) {
      const n = (i * 7) % 120, ch = Array.from({ length: n }, (_, j) => ((i + j * 3) % 5 === 0 ? 1 : 0));
      expect(describe(1000 + i * 7919, n, ch).check).toBe(true);
    }
  });

  it("packs bits LSB first, one byte per 8 level-ups", () => {
    expect(bitsToHex([1, 0, 0, 0, 0, 0, 0, 0, 0, 1], 10)).toBe("0102");
    expect(hexToChoices("0102", 10)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  });

  it("perso checksum follows the documented formula", () => {
    const p = [0, 0, 19, 36, 36, 42, 90, 71, 66, 65, 59, 80, 61, 48, 18, 61];
    let h = 1; for (const x of p) h = ((h * 11) ^ x) % 2097151;
    expect(gfxHash(p)).toBe(h);
    expect(persoParams(p.join(";"), { stop: true, flip: true })).toBe(`data=${encodeURIComponent(p.join(";"))}&chk=${h}&stop=1&flip=1`);
  });

  it("seed ids must fit a Flash signed int", () => {
    expect(isValidSeedId(1)).toBe(true);
    expect(isValidSeedId(2 ** 31 - 1)).toBe(true);
    expect(isValidSeedId(2 ** 31)).toBe(false);
    expect(isValidSeedId(0)).toBe(false);
  });

  it("destiny: banned rewards are never offered, and the rare ones are banned most of the time", () => {
    let thiefBanned = 0, stances = 0;
    for (let s = 0; s < 300; s++) {
      const id = 1 + s * 7_158_013;
      const { stance, banned } = destiny(id);
      if (stance !== null) { stances++; expect([0, 1]).toContain(stance); }
      if (banned.some((b) => b.id === "THIEF")) thiefBanned++;
      const keys = new Set(banned.map((b) => b.kind + ":" + b.id));
      if (s < 40) for (const lv of describe(id, 150, randomChoices(150)).levels)
        for (const o of lv.opts) if (o.t === "b") expect(keys.has(o.kind + ":" + o.id)).toBe(false);
    }
    expect(thiefBanned).toBeGreaterThan(150); // banned with odds 2/3
    expect(stances).toBeLessThan(10); // odds 1/1000
  });

  it("finds the nearest id with a stance", () => {
    for (const stance of [0, 1]) {
      const id = nearestIdWithStance(5000, stance)!;
      expect(destiny(id).stance).toBe(stance);
      for (let x = 5000 - Math.abs(id - 5000) + 1; x < 5000 + Math.abs(id - 5000); x++) if (x !== id) expect(destiny(x).stance).not.toBe(stance);
      expect(nearestIdWithStance(5000, stance, [id])).not.toBe(id);
    }
    expect(destiny(nearestIdWithStance(5000, null)!).stance).toBeNull();
  });
});
