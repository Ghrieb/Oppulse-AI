import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const API_TARGET = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // The frontend talks to a same-origin path prefix so that development,
    // tests and production all use an identical request shape.
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    // The mock server patches the process-wide `fetch`, so test files share
    // a worker. Running them sequentially keeps the shared mock state
    // deterministic and removes a class of order-dependent failures.
    fileParallelism: false,
    maxWorkers: 1,
    sequence: { concurrent: false },
    // jsdom plus a real request round trip is slower than the 5s default on
    // a loaded machine, and a flaky test is worse than a slow one.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/mocks/**', 'src/test/**'],
    },
  },
});
