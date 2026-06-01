import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__integration__/**/*.integration.test.ts'],
    testTimeout: 30000,
    setupFiles: ['__integration__/setup.ts'],
  },
});
