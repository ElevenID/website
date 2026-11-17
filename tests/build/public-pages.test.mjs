import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { muiIconMjsCompatibilityPlugin } from '../../ui/scripts/mui-icon-compatibility.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const pageNames = [
  'WhatIsDigitalCredentialPage', 'WhatIsCredentialVerificationPage',
  'WhatIsMartyProtocolPage', 'WhatIsOpenBadgePage',
  'EudiWalletVerificationPage', 'IsoMdocVerificationPage',
  'OpenBadgesIssuancePage', 'OpenBadgesVerificationPage',
  'SdJwtVerificationPage', 'TrustRegistryPage',
];
const relativeSources = [
  ...pageNames.map((name) => 'ui/src/components/pages/' + name + '.jsx'),
  'ui/src/components/FromIDVPage.jsx',
  'ui/src/components/pages/ProtocolSupportCatalogView.jsx',
  'ui/src/application/protocolSupportCatalog.js',
  'ui/src/application/verifier/verifierDemoFlow.js',
  'ui/src/components/landing/proofLabRuntime.js',
  'ui/src/components/demos/DemoVideoPlayer.jsx',
  'ui/src/extensions/commerce/website.js',
  'ui/src/extensions/commerce/publicStub.jsx',
];
const assetBase = '/_website/0123456789abcdef0123456789abcdef01234567/';
const normalized = (value) => value.replace(/\\/g, '/').split('?', 1)[0];
function assertAllowedGraphId(id) {
  assert.ok(!/\.svg(?:$|#)/i.test(id), 'SVG is outside this fixture: ' + id);
  assert.ok(!/\/@elevenid\/(?:marty-api-core|marty-blog)\//.test(id), id);
  assert.ok(!/\/ui\/src\/apps\/(?:public|console|website)\//.test(id), id);
  assert.ok(!/\/ui\/src\/(?:bootstrapApp\.jsx|website\.jsx|hooks\/useAuth\.js|services\/)/.test(id), id);
  assert.ok(!id.endsWith('/variants/marketingRoutes.jsx'), id);
  assert.ok(!id.endsWith('/contracts/protocol-support-catalog.json'), id);
  assert.ok(!/\/demoManifests\./.test(id), id);
}

test('Vite bundles the audited public pages, catalog view and demo helpers', { timeout: 60000 }, async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'elevenid-public-pages-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const entryPath = path.join(fixture, 'page-entry.mjs');
  const sourcePaths = relativeSources.map((source) => path.join(repositoryRoot, source));
  for (const source of sourcePaths) assert.ok((await stat(source)).size < 16384, source);
  await writeFile(entryPath, [
    ...sourcePaths.map((source, index) => 'import * as Source' + index + ' from ' + JSON.stringify(normalized(source)) + ';'),
    // Exercise the extracted resolver against a real installed MUI 9 icon.
    'import LegacyVerified from "@mui/icons-material/Verified.js";',
    'globalThis.websiteClosedFixture = [' + sourcePaths.map((_, index) => 'Source' + index).join(', ') + ', LegacyVerified];',
  ].join('\n'));

  const visitedSources = new Set();
  const repositoryPrefix = normalized(path.resolve(repositoryRoot)) + '/';
  const sourceBoundary = {
    name: 'audited-website-source-boundary', enforce: 'pre',
    async load(id) {
      const source = normalized(id);
      assertAllowedGraphId(source);
      if (!source.startsWith(repositoryPrefix) || source.includes('/node_modules/')) return null;
      assert.ok((await stat(source)).size < 16384, 'Source exceeds the bounded fixture: ' + source);
      visitedSources.add(source);
      return null;
    },
  };
  const outDir = path.join(fixture, 'dist');
  const result = await build({
    configFile: false, root: repositoryRoot, publicDir: false, logLevel: 'silent',
    define: { 'import.meta.env.VITE_WEBSITE_ASSET_BASE': JSON.stringify(assetBase) },
    resolve: {
      alias: {
        '@ui-public-config': path.join(repositoryRoot, 'ui/src/variants/publicConfig.website.js'),
        // The checked-in public implementation is the fixture's explicit
        // commerce boundary; this does not configure a production website build.
        '@marty/commerce-extension': path.join(repositoryRoot, 'ui/src/extensions/commerce/publicStub.jsx'),
      },
      dedupe: [
        'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-router',
        '@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled', 'prop-types',
      ],
    },
    plugins: [sourceBoundary, muiIconMjsCompatibilityPlugin(), react()],
    build: {
      outDir, emptyOutDir: true, assetsDir: assetBase.slice(1) + 'assets',
      minify: false, sourcemap: false, reportCompressedSize: false,
      rolldownOptions: { input: entryPath },
    },
  });
  const output = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
  const chunks = output.filter((item) => item.type === 'chunk');
  const moduleIds = new Set(chunks.flatMap((chunk) => Object.keys(chunk.modules).map(normalized)));
  for (const source of sourcePaths) {
    const id = normalized(source);
    assert.ok(visitedSources.has(id), 'Actual source was not loaded: ' + id);
    // The commerce entry is a pure re-export; its implementation must still be
    // retained even if the bundler omits that zero-byte facade from chunk data.
    if (!id.endsWith('/extensions/commerce/website.js')) assert.ok(moduleIds.has(id), id);
  }
  assert.ok([...moduleIds].some((id) => id.endsWith('/@mui/icons-material/Verified.mjs')));
  for (const id of new Set([...moduleIds, ...visitedSources])) {
    assertAllowedGraphId(id);
  }
  assert.ok(chunks.length > 0);
  for (const chunk of chunks) {
    assert.ok(chunk.fileName.startsWith(assetBase.slice(1) + 'assets/'), chunk.fileName);
    assert.ok((await stat(path.join(outDir, chunk.fileName))).size > 0);
  }
  t.diagnostic(JSON.stringify({
    auditedSourceInputs: sourcePaths.length,
    loadedRepositorySources: visitedSources.size,
    bundledModuleCount: moduleIds.size,
    emittedChunks: chunks.length,
  }));
});
