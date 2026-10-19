import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");

describe("vendored original files", () => {
  const expected: Record<string, string> = {
    "glad.js": "73cacfe1b7a81a1b1b9bf59b2becc3ae63fbbfcf8d0f1f6f1de42180ccff1573",
    "fight.js": "cc27c5888345489f5894bdfa7248b4f422a3e4fa5a572b253799b3c959ca4875", // + documented one-line patch
    "labrute.js": "f74f34a01be81dd01e5e753c9f5471bea1d82a6e97f0fc82d0028d84cf5dc102",
    "fightlog.js": "90caf9ba90f5d082620d45d1599ba2d79cefd938d25c12161bd349c5d7136e1b",
    "inventory.js": "2892f4661828c4e3735866143409b49a2ab1b490ca3e8f1a15cb9562253d3de1",
  };
  for (const [file, hash] of Object.entries(expected)) {
    it(`${file} is unchanged`, () => expect(sha(join(root, "vendor", file))).toBe(hash));
    it(`generated/${file} embeds the vendored source verbatim`, () => {
      const src = readFileSync(join(root, "vendor", file), "utf8");
      const gen = readFileSync(join(root, "src/generated", file), "utf8");
      expect(gen.includes("// ---- vendor source begins ----\n" + src + "\n// ---- vendor source ends ----")).toBe(true);
    });
  }

  it("fight.js differs from the original only by the FightAPI return line", () => {
    const orig = readFileSync(join(root, "../../legacy/fight.js"), "utf8").split("\n");
    const patched = readFileSync(join(root, "vendor/fight.js"), "utf8").split("\n");
    expect(patched.length).toBe(orig.length);
    const diff = orig.map((l, i) => (l === patched[i] ? -1 : i)).filter((i) => i >= 0);
    expect(diff).toEqual([1266]);
    expect(orig[1266]).toBe("\treturn { win : arena1, history : result};");
  });
});
