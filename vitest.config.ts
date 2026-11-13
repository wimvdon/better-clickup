import { defineConfig } from 'vitest/config';

// Unit tests: plain TypeScript logic in src/ and scripts/, no Electron and no browser needed.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
