import { describe, expect, it } from "vitest";
import { LaBrute, buildParams, describe as describeBrute, importPayload, newLabFight, payloadPlain, toEngineInput, validateSpec } from "../src";
import fights from "./fixtures/fights.json";

describe("payload import/build", () => {
  fights.forEach((f) => {
    it(`${f.name}: rebuilding gives the original plaintext byte for byte`, () => {
      const { spec, source } = importPayload(f.params);
      expect(payloadPlain(spec, { mini: source.mini!, end: source.end! })).toBe(source.plain);
    });
    it(`${f.name}: engine input matches labrute.js session.fightInput()`, () => {
      const { spec } = importPayload(f.params);
      expect(toEngineInput(spec)).toEqual(JSON.parse(JSON.stringify(LaBrute.open(f.params).fightInput())));
    });
    it(`${f.name}: params decode back to the same spec`, () => {
      const { spec } = importPayload(f.params);
      const again = importPayload(buildParams(spec, { mini: "/swf/mini_perso.swf", end: "javascript:void(0)" }));
      expect(again.spec).toEqual(spec);
      expect(again.source.mini).toBe("/swf/mini_perso.swf");
    });
  });

  it("builds a playable payload from scratch and keeps unicode names", () => {
    const spec = newLabFight();
    spec.brutes[0].name = "Élodie le Brûté";
    const back = importPayload(buildParams(spec, { mini: "m", end: "e" })).spec;
    expect(back).toEqual(spec);
    expect(validateSpec(spec)).toEqual([]);
  });

  it("allows level 5000 and rejects levels above the simulator limit", () => {
    const spec = newLabFight();
    spec.brutes[0].levelUps = 4999;
    spec.brutes[0].choices = Array.from({ length: 4999 }, () => 0);
    expect(validateSpec(spec)).toEqual([]);
    expect(describeBrute(spec.brutes[0].id, 4999, spec.brutes[0].choices).levels).toHaveLength(4999);

    spec.brutes[0].levelUps = 5000;
    spec.brutes[0].choices.push(0);
    expect(validateSpec(spec).some((error) => error.includes("level must be between 1 and 5000"))).toBe(true);
  });

  it("rejects duplicate ids, empty teams and bad appearance", () => {
    const spec = newLabFight();
    spec.brutes[1].id = spec.brutes[0].id;
    spec.brutes[1].gfx = "1;2;3";
    const errors = validateSpec(spec);
    expect(errors.some((e) => e.includes("share id"))).toBe(true);
    expect(errors.some((e) => e.includes("appearance"))).toBe(true);
    spec.brutes.pop();
    expect(validateSpec(spec).some((e) => e.includes("Team 1 needs"))).toBe(true);
  });

  it("refuses a payload with a wrong key", () => {
    const p = fights[0].params.replace(/k=[^&]+/, "k=wrongkey");
    expect(() => importPayload(p)).toThrow(/Checksum/);
  });
});
