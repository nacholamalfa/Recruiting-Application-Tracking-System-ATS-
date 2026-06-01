import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['app/**/__tests__/**/*.regression.test.{ts,tsx}'],
    testTimeout: 15000,
  },
});
