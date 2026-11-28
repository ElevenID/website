import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { websiteAssetBase, websiteAssetsPlugin } from './scripts/website-assets.mjs';
import { websiteBuildSelection, webSurfaceBuildContractPlugin } from './scripts/web-surface-build-contract.mjs';
import { productionBuildContract, productionBuildContractPlugin } from './scripts/production-build-contract.mjs';
import { muiIconMjsCompatibilityPlugin } from './scripts/mui-icon-compatibility.mjs';
import { devServerOrigin } from './scripts/dev-server-origin.mjs';
import { verifyHeaderSource } from './src/shared/web-layout/verify-source.mjs';

const uiRoot = fileURLToPath(new URL('.', import.meta.url));
verifyHeaderSource(new URL('./src/shared/web-layout/', import.meta.url));
const { sourceSha, pages, commerceSha, revision } = websiteBuildSelection();
const commerceEntry = productionBuildContract({ pages, surface: 'website',
  extensionPath: process.env.MARTY_COMMERCE_EXTENSION_PATH, sourceSha: commerceSha });
const assetBase = websiteAssetBase(revision);

export default defineConfig({
  root: uiRoot,
  publicDir: false,
  // assetsDir already owns the immutable prefix. Applying it as base as well
  // doubles every entry/preload URL and prevents the browser from starting.
  base: '/',
  define: { 'import.meta.env.VITE_WEBSITE_ASSET_BASE': JSON.stringify(assetBase) },
  server: {
    ...devServerOrigin(process.env),
    headers: { 'Cache-Control': 'no-store' },
  },
  resolve: {
    alias: {
      '@ui-public-config': fileURLToPath(new URL('./src/variants/publicConfig.website.js', import.meta.url)),
      '@marty/commerce-extension': commerceEntry
        || fileURLToPath(new URL('./src/extensions/commerce/publicStub.jsx', import.meta.url)),
      'react-router-dom': 'react-router',
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime',
      'react-router', '@mui/material', '@mui/icons-material', '@emotion/react',
      '@emotion/styled', 'prop-types'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-router'],
    exclude: ['@elevenid/marty-blog'],
  },
  plugins: [
    muiIconMjsCompatibilityPlugin(),
    webSurfaceBuildContractPlugin({ surface: 'website', sourceSha, revision, pages, commerceSha,
      commerceEntry: commerceEntry || undefined }),
    ...(commerceEntry ? [productionBuildContractPlugin(commerceEntry)] : []),
    websiteAssetsPlugin(revision),
    react(),
  ],
  build: {
    outDir: 'dist-website',
    assetsDir: `${assetBase.slice(1)}assets`,
    emptyOutDir: true,
    // Full builds must never publish raw private modules in source maps.
    sourcemap: pages === 'public',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: { main: fileURLToPath(new URL('./index.html', import.meta.url)) },
    },
  },
});
