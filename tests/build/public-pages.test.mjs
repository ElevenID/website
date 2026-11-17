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
const pageRoot = path.join(repositoryRoot, 'ui/src/components/pages');
const pageNames = [
  'WhatIsDigitalCredentialPage', 'WhatIsCredentialVerificationPage',
  'WhatIsMartyProtocolPage', 'WhatIsOpenBadgePage',
  'EudiWalletVerificationPage', 'IsoMdocVerificationPage',
  'OpenBadgesIssuancePage', 'OpenBadgesVerificationPage',
  'SdJwtVerificationPage', 'TrustRegistryPage',
];
const assetBase = '/_website/0123456789abcdef0123456789abcdef01234567/';
const normalized = (value) => value.replace(/\\/g, '/').split('?', 1)[0];

test('Vite bundles the ten actual public pages with the audited dependency boundary', { timeout: 60000 }, async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'elevenid-public-pages-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const entryPath = path.join(fixture, 'page-entry.mjs');
  const pagePaths = pageNames.map((name) => path.join(pageRoot, name + '.jsx'));
  for (const source of pagePaths) assert.ok((await stat(source)).size < 16384, source);
  await writeFile(entryPath, [
    ...pagePaths.map((source, index) => 'import Page' + index + ' from ' + JSON.stringify(normalized(source)) + ';'),
    // Exercise the extracted resolver against a real installed MUI 9 icon.
    'import LegacyVerified from "@mui/icons-material/Verified.js";',
    'globalThis.websitePageFixture = [' + pageNames.map((_, index) => 'Page' + index).join(', ') + ', LegacyVerified];',
  ].join('\n'));

  const outDir = path.join(fixture, 'dist');
  const result = await build({
    configFile: false, root: repositoryRoot, publicDir: false, logLevel: 'silent',
    define: { 'import.meta.env.VITE_WEBSITE_ASSET_BASE': JSON.stringify(assetBase) },
    resolve: {
      alias: {
        '@ui-public-config': path.join(repositoryRoot, 'ui/src/variants/publicConfig.website.js'),
      },
      dedupe: [
        'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-router',
        '@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled', 'prop-types',
      ],
    },
    plugins: [muiIconMjsCompatibilityPlugin(), react()],
    build: {
      outDir, emptyOutDir: true, assetsDir: assetBase.slice(1) + 'assets',
      minify: false, sourcemap: false, reportCompressedSize: false,
      rolldownOptions: { input: entryPath },
    },
  });
  const output = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
  const chunks = output.filter((item) => item.type === 'chunk');
  const moduleIds = new Set(chunks.flatMap((chunk) => Object.keys(chunk.modules).map(normalized)));
  for (const source of pagePaths) assert.ok(moduleIds.has(normalized(source)), source);
  assert.ok([...moduleIds].some((id) => id.endsWith('/@mui/icons-material/Verified.mjs')));
  for (const id of moduleIds) {
    assert.ok(!id.includes('/@elevenid/marty-api-core/'), id);
    assert.ok(!/\/ui\/src\/apps\/(?:public|console)\//.test(id), id);
    assert.ok(!/\/ui\/src\/(?:bootstrapApp\.jsx|hooks\/useAuth\.js|services\/)/.test(id), id);
  }
  assert.ok(chunks.length > 0);
  for (const chunk of chunks) {
    assert.ok(chunk.fileName.startsWith(assetBase.slice(1) + 'assets/'), chunk.fileName);
    assert.ok((await stat(path.join(outDir, chunk.fileName))).size > 0);
  }
  t.diagnostic(JSON.stringify({
    publicPageModules: pagePaths.length,
    bundledModuleCount: moduleIds.size,
    emittedChunks: chunks.length,
  }));
});
