import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["test/global-setup.ts"],
    fileParallelism: false, // the API test files share one database
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
