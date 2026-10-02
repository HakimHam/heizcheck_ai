import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts', 'supabase/**/*.test.ts'],
    testTimeout: 30_000,
    // Each database test boots its own PGlite; booting several at once in
    // parallel workers times out or crashes them.
    hookTimeout: 30_000,
    fileParallelism: false,
  },
})
