import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  WEB_SURFACE_ROUTES,
  WEB_ROUTE_CONTRACT,
  canonicalJson,
  getWebSurface,
} from '../ui/scripts/web-surface-contract.mjs';
import { validateWebSurfaceContract } from '../ui/src/application/routing/webSurfaceContract.mjs';

test('explicit marketing pages, resources and reserved pricing keep website ownership', () => {
  for (const route of [
    '/', '/product', '/product/', '/resources', '/pricing', '/pricing/',
    '/blog/example', '/authors/example', '/demos/latest/example',
    '/_website/abc/assets/main.js', '/robots.txt', '/sitemap-0.xml',
  ]) {
    assert.equal(getWebSurface(route), 'website', route);
  }
});

test('application entrypoints and unknown paths do not acquire website ownership', () => {
  for (const route of [
    '/login', '/login/error', '/auth/callback', '/console', '/console/org',
    '/verify', '/verify/', '/verify/examples',
    '/docs', '/pricing/checkout', '/resources/', '/v1/protocol-support',
    '/wallet/setup', '/unknown', '/blogger', '/sitemap-bad/path.xml',
  ]) {
    assert.equal(getWebSurface(route), 'application', route);
  }
});

test('controls, URL separators and non-path inputs fall back without normalization', () => {
  const controls = [
    ...Array.from({ length: 33 }, (_, code) => String.fromCharCode(code)),
    String.fromCharCode(127), '\\', '?', '#',
  ];
  for (const character of controls) {
    assert.equal(getWebSurface(`/blog/${character}post`), 'application');
  }
  for (const value of [null, undefined, 42, {}, '', '//other.example/',
    'https://other.example/', '/product?x=1', '/product#section']) {
    assert.equal(getWebSurface(value), 'application');
  }
  assert.equal(getWebSurface('/blog/日本語'), 'website');
});

test('closed schema prevents invalid or ambiguous route ownership', () => {
  for (const mutation of [
    null,
    [],
    { ...WEB_SURFACE_ROUTES, schema_version: 2 },
    { ...WEB_SURFACE_ROUTES, extra: true },
    { ...WEB_SURFACE_ROUTES, fallback: 'website' },
    { ...WEB_SURFACE_ROUTES, website: { ...WEB_SURFACE_ROUTES.website, extra: true } },
    { ...WEB_SURFACE_ROUTES, website: { ...WEB_SURFACE_ROUTES.website, path_prefixes: ['/'] } },
    { ...WEB_SURFACE_ROUTES, website: { ...WEB_SURFACE_ROUTES.website, exact_paths: ['/', '/'] } },
    { ...WEB_SURFACE_ROUTES, website: { ...WEB_SURFACE_ROUTES.website, exact_paths: ['/product'] } },
    { ...WEB_SURFACE_ROUTES, website: { ...WEB_SURFACE_ROUTES.website, filename_patterns: ['.*'] } },
  ]) {
    assert.throws(() => validateWebSurfaceContract(mutation));
  }
});

test('canonical digest preserves the exact source route contract', () => {
  assert.equal(canonicalJson({ b: 2, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":2}');
  assert.equal(WEB_ROUTE_CONTRACT.version, 1);
  assert.equal(WEB_ROUTE_CONTRACT.sha256,
    'sha256:0bf3a247f0cf831af4146670d5944d5480384dc47621ccb9066ddb688a1c0595');
});

test('copied source and license retain their recorded Git blob identities', () => {
  const provenance = JSON.parse(readFileSync(
    new URL('../contracts/extraction-provenance.json', import.meta.url), 'utf8',
  ));
  assert.equal(provenance.schema_version, 1);
  assert.equal(provenance.purpose, 'source-extraction-record');
  assert.deepEqual(provenance.source, {
    repository: 'ElevenID/marty-ui',
    commit: 'df6ec6c4bfee803d89c54e9333297f29f378cee3',
  });
  assert.deepEqual(provenance.files.map((entry) => entry.target_path).sort(), [
    'LICENSE',
    'contracts/web-surface-routes.json',
    'ui/scripts/dev-server-origin.mjs',
    'ui/scripts/dev-server-origin.test.mjs',
    'ui/scripts/generated-text.mjs',
    'ui/scripts/generated-text.test.mjs',
    'ui/scripts/web-surface-contract.mjs',
    'ui/src/application/routing/webSurfaceContract.mjs',
    'ui/src/utils/hasAsciiControlCharacters.js',
  ]);
  assert.deepEqual(provenance.adapted_files.filter(
    (entry) => entry.target_path === 'ui/scripts/website-assets.mjs',
  ), [{
    source_path: 'ui/scripts/website-assets.mjs',
    target_path: 'ui/scripts/website-assets.mjs',
    source_git_blob_sha1: '0cf0fee406e2d4c1888f254e0b7867a9092149d4',
    changes: 'Reject non-string revisions before validation or interpolation; preserve valid primitive string behavior.',
  }]);
  for (const entry of provenance.files) {
    assert.equal(entry.source_path, entry.target_path);
    assert.equal(entry.transfer, 'verbatim');
    const file = new URL(`../${entry.target_path}`, import.meta.url);
    assert.ok(lstatSync(file).isFile(), entry.target_path);
    const bytes = readFileSync(file);
    const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(hash, entry.git_blob_sha1, entry.target_path);
  }
});
