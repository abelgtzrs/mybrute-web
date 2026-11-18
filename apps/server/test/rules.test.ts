import { describe, expect, it } from "vitest";
import {
  bracketSize,
  bruteNameProblem,
  capFor,
  classicDay,
  fightsUsedToday,
  isWaiting,
  RANKS,
  rankInfo,
  requiredXp,
  titleXp,
  xpFor,
} from "../src/rules";

describe("Classic rules", () => {
  it("requires level * 2 XP", () => {
    expect([1, 2, 3, 4, 5, 10, 25, 50, 100].map(requiredXp)).toEqual([2, 4, 6, 8, 10, 20, 50, 100, 200]);
    expect(() => requiredXp(0)).toThrow();
  });

  it("awards 2 XP for a win and 1 for a loss or a draw", () => {
    expect([xpFor("win"), xpFor("loss"), xpFor("draw")]).toEqual([2, 1, 1]);
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

describe("ranks", () => {
  it("has 12 ranks whose NPC ranges sit below their caps", () => {
    expect(RANKS.length).toBe(12);
    for (const rank of RANKS) {
      expect(rank.npcMin).toBeLessThanOrEqual(rank.npcMax);
      expect(rank.npcMax).toBeLessThan(rank.cap);
    }
    expect(RANKS[11].titlesNeeded).toBeNull(); // top rank has nothing to climb to
    expect(RANKS.slice(0, 11).map((r) => r.titlesNeeded)).toEqual([3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5]);
  });

  it("sizes brackets by titles and caps them at 256", () => {
    expect(bracketSize(0)).toBe(16);
    expect(bracketSize(2)).toBe(64);
    expect(bracketSize(4)).toBe(256);
    expect(bracketSize(9)).toBe(256);
  });

  it("pays 5, 10, 15, 20, 25 XP for titles, then 25", () => {
    expect([0, 1, 2, 3, 4, 5, 40].map(titleXp)).toEqual([5, 10, 15, 20, 25, 25, 25]);
  });

  it("only waits for a level-up below the cap", () => {
    expect(isWaiting(40, 19, 20)).toBe(true);
    expect(isWaiting(999, 20, 20)).toBe(false);
    expect(isWaiting(999, 25, capFor(0, true))).toBe(true);
  });

  it("gives admin brutes no cap", () => {
    expect(capFor(0, false)).toBe(20);
    expect(capFor(0, true)).toBe(Infinity);
    expect(rankInfo(0, 0, true).cap).toBeNull();
  });
});
