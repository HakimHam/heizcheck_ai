import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "supabase/tests/**/*.test.ts"],
    // Each test file boots its own in-process Postgres; give it time.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
