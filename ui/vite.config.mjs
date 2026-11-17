import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { websiteAssetBase, websiteAssetsPlugin } from './scripts/website-assets.mjs';
import { websiteBuildRevision, webSurfaceBuildContractPlugin } from './scripts/web-surface-build-contract.mjs';
import { muiIconMjsCompatibilityPlugin } from './scripts/mui-icon-compatibility.mjs';

const uiRoot = fileURLToPath(new URL('.', import.meta.url));
const sourceSha = process.env.MARTY_WEBSITE_SOURCE_SHA || 'development';
const pages = process.env.MARTY_PRODUCTION_PAGES || 'public';
if (pages !== 'public') throw new Error('The standalone public website does not include private commerce');
const revision = websiteBuildRevision({ sourceSha, pages, revision: process.env.MARTY_WEBSITE_REVISION });
const assetBase = websiteAssetBase(revision);

export default defineConfig({
  root: uiRoot,
  publicDir: false,
  base: assetBase,
  define: { 'import.meta.env.VITE_WEBSITE_ASSET_BASE': JSON.stringify(assetBase) },
  resolve: {
    alias: {
      '@ui-public-config': fileURLToPath(new URL('./src/variants/publicConfig.website.js', import.meta.url)),
      '@marty/commerce-extension': fileURLToPath(new URL('./src/extensions/commerce/publicStub.jsx', import.meta.url)),
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
    webSurfaceBuildContractPlugin({ surface: 'website', sourceSha, revision, pages }),
    websiteAssetsPlugin(revision),
    react(),
  ],
  build: {
    outDir: 'dist-website',
    assetsDir: `${assetBase.slice(1)}assets`,
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: { main: fileURLToPath(new URL('./index.html', import.meta.url)) },
    },
  },
});
