import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@plugins': fileURLToPath(new URL('./plugins', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 0
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/utils/**/*.ts'],
      exclude: ['src/utils/a11y.ts'],
      reporter: ['text-summary', 'json-summary']
    }
  }
});
