import { describe as group, expect, it } from "vitest";
import { bitsToHex, describe, displayLevel, hexToChoices, levelUpsFor, pendingOptions, persoParams, gfxHash, isValidSeedId } from "../src";

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
});
