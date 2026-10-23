import { defineConfig } from 'vitest/config'

/** Only the authored test files run; editor journals under `.surgeon/` never do. */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
