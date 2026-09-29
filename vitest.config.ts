import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts", "supabase/**/*.test.ts"],
    // Each RLS test boots an in-process Postgres (PGlite), which takes a few seconds.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
