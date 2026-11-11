import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so the build also works from a sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
