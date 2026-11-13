import { describe, expect, it } from "vitest";
import { tournoiParams, tournoiSize } from "../src/tournoi";
import { LaBrute } from "../src/vendor";
import { fromBytes, hxToPlain } from "../src/payload";

const entrants = Array.from({ length: 16 }, (_, i) => ({ name: `B${i}`, level: i + 1, gfx: "0;0;1;2;3;4;5;6;7;8;9;10;11;12;13;14", isBrute: i === 3 }));
const opts = { perso: "/perso.swf", fightPrefix: "/fight/", user: "Me", league: 2 };
const decode = (p: string) => hxToPlain(LaBrute.parseHx(decodeURIComponent(p.replace(/^data=/, "")))) as any;

describe("tournoiSize", () => {
  it("matches Tournoi.hx", () => {
    expect(tournoiSize(16)).toEqual({ width: 800, height: 600 });
    expect(tournoiSize(64)).toEqual({ width: 800, height: 600 });
    expect(tournoiSize(128)).toEqual({ width: 960, height: 1172 });
    expect(tournoiSize(256)).toEqual({ width: 1120, height: 2324 });
  });
});

describe("tournoiParams", () => {
  const d = decode(tournoiParams({ entrants, winners: [[1, 2, 5, 6, 8, 11, 13, 14]] }, opts));
  it("counts only revealed wins", () => {
    expect(d._glads[1]._m).toBe(1);
    expect(d._glads[0]._m).toBe(0);
    expect(d._glads.every((g: any) => g._m <= 1)).toBe(true);
  });
  it("marks only the brute as the user", () => {
    expect(d._glads.filter((g: any) => g._u === "Me").map((g: any) => g._id)).toEqual([3]);
    expect(d._view).toBeNull();
    expect(d._max).toBe(16);
  });
});

describe("non-ASCII names", () => {
  it("decode back unchanged, the way the SWF reads them", () => {
    const named = entrants.map((e, i) => (i === 0 ? { ...e, name: "Zoé" } : e));
    const d = decode(tournoiParams({ entrants: named, winners: [] }, { ...opts, user: "Zoé" }));
    expect(fromBytes(d._glads[0]._n)).toBe("Zoé");
    expect(fromBytes(d._glads[3]._u)).toBe("Zoé");
    expect(fromBytes(d._user)).toBe("Zoé");
  });
});
