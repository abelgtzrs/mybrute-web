import { describe, expect, it } from "vitest";
import { gfxParts, isValidGfx } from "../src";

describe("gfx", () => {
  it("allows -1 only in the colour fields", () => {
    const ok = "0;0;0;0;0;0;0;0;0;0;0;-1;-1;-1;-1;-1";
    expect(isValidGfx(ok)).toBe(true);
    expect(gfxParts(ok).slice(11)).toEqual([-1, -1, -1, -1, -1]);
    expect(isValidGfx("0;0;-1;0;0;0;0;0;0;0;0;0;0;0;0;0")).toBe(false);
    expect(gfxParts("0;0;-1")[2]).toBe(0);
  });
});
