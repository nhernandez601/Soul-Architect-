import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.tsx', 'src/App.tsx', 'src/ui/**', 'src/vite-env.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@t': resolve(__dirname, 'src/types'),
      '@engine': resolve(__dirname, 'src/engine'),
      '@systems': resolve(__dirname, 'src/systems'),
      '@scripting': resolve(__dirname, 'src/scripting'),
      '@config': resolve(__dirname, 'src/config'),
    },
  },
});
