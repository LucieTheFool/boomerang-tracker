import { defineConfig } from 'vitest/config';

// Tests run from the project root (vite.config.ts points at the renderer folder).
export default defineConfig({
  test: { root: '.', include: ['test/**/*.test.ts'] },
});
