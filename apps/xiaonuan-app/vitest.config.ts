import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  define: {
    __DEV__: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    root: resolve(__dirname),
    include: ['src/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
