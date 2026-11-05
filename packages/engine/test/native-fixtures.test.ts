// The native repo's tests are only as good as their answer key: it must not change between runs.
import { expect, test } from "vitest";
import { buildFixtures } from "../scripts/native-fixtures";

test("native fixtures are deterministic", () => {
  expect(JSON.stringify(buildFixtures())).toBe(JSON.stringify(buildFixtures()));
}, 600_000);
