import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves the site from /<repository>/. The deploy workflow sets
// BASE_PATH; locally the site is served from the root.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: false },
  test: {
    include: ['src/tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
});
