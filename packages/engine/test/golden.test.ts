// The vendored + wrapped + patched engine must reproduce the outputs recorded from the ORIGINAL files.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FightAPI, GladAPI, importPayload, runFight } from "../src";
import golden from "./fixtures/golden.json";
import fights from "./fixtures/fights.json";

const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

describe("historical payloads", () => {
  golden.payloads.forEach((g, i) => {
    it(`${g.name}: same winner and identical history`, () => {
      const { spec } = importPayload(fights[i].params);
      const r = runFight(spec);
      expect(r.win).toBe(g.win);
      expect(r.history.length).toBe(g.events);
      expect(sha(r.history)).toBe(g.historySha);
    });
    it(`${g.name}: same progression for every brute`, () => {
      for (const d of g.describe) {
        const { levels, check, fin } = d as any;
        expect(GladAPI.describe(d.id, d.lvl, (importPayload(fights[i].params).spec.brutes.find((b) => b.id === d.id)!).choices))
          .toEqual({ levels, check, fin });
      }
    });
  });
});

describe("random fights and progressions", () => {
  it("60 recorded fights replay identically", () => {
    for (const f of golden.fights) {
      const r = FightAPI.run(JSON.parse(JSON.stringify(f.input)));
      expect([r.win, r.history.length, sha(r.history)]).toEqual([f.win, f.events, f.historySha]);
    }
  });
  it("40 recorded progressions describe identically", () => {
    for (const d of golden.describes) expect(sha(GladAPI.describe(d.id, d.n, d.choices))).toBe(d.sha);
  });
  it("is deterministic", () => {
    const { spec } = importPayload(fights[0].params);
    expect(sha(runFight(spec))).toBe(sha(runFight(spec)));
  });
});
