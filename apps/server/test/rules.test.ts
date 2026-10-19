import { describe, expect, it } from "vitest";
import { bruteNameProblem, classicDay, fightsUsedToday, isPending, requiredXp, xpFor } from "../src/rules";

describe("Classic rules", () => {
  it("requires level * 2 XP", () => {
    expect([1, 2, 3, 4, 5, 10, 25, 50, 100].map(requiredXp)).toEqual([2, 4, 6, 8, 10, 20, 50, 100, 200]);
    expect(() => requiredXp(0)).toThrow();
  });

  it("awards 2 XP for a win and 1 for a loss or a draw", () => {
    expect([xpFor("win"), xpFor("loss"), xpFor("draw")]).toEqual([2, 1, 1]);
  });

  it("marks a level-up as pending once the requirement is met, without levelling", () => {
    expect(isPending(1, 1)).toBe(false);
    expect(isPending(2, 1)).toBe(true);
    expect(isPending(3, 1)).toBe(true); // carry-over
    expect(isPending(5, 3)).toBe(false);
  });

  it("uses Bordeaux days, including the summer-time offset", () => {
    expect(classicDay(new Date("2026-07-14T21:59:00Z"))).toBe("2026-07-14"); // 23:59 CEST
    expect(classicDay(new Date("2026-07-14T22:00:00Z"))).toBe("2026-07-15"); // 00:00 CEST
    expect(classicDay(new Date("2026-01-10T22:59:00Z"))).toBe("2026-01-10"); // 23:59 CET
    expect(classicDay(new Date("2026-01-10T23:00:00Z"))).toBe("2026-01-11"); // 00:00 CET
  });

  it("resets the daily count on a new day", () => {
    expect(fightsUsedToday("2026-10-18", 7, "2026-10-19")).toBe(0);
    expect(fightsUsedToday("2026-10-19", 7, "2026-10-19")).toBe(7);
    expect(fightsUsedToday(null, 0, "2026-10-19")).toBe(0);
  });

  it("validates brute names", () => {
    expect(bruteNameProblem("Warcott77")).toBeNull();
    expect(bruteNameProblem("Élodie Brûte")).toBeNull();
    expect(bruteNameProblem("x")).not.toBeNull();
    expect(bruteNameProblem("<script>")).not.toBeNull();
    expect(bruteNameProblem(" ")).not.toBeNull();
  });
});
