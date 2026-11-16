import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({ jsxRuntime: 'automatic' })],
  define: {
    'import.meta.env.VITE_WEBSITE_ASSET_BASE': JSON.stringify(
      '/_website/0123456789abcdef0123456789abcdef01234567/',
    ),
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'https://192.0.2.10/product' },
    },
    globals: false,
    pool: 'threads',
    fileParallelism: false,
    include: [
      'ui/src/apps/shared/WebSurfaceBoundary.test.tsx',
      'tests/dom/**/*.test.jsx',
    ],
  },
});
