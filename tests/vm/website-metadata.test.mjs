import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

// The test command enables --experimental-vm-modules to supply the build
// environment while executing the actual three small metadata modules.
// Full website build and SEOHead DOM/browser qualification remain deferred.
const repositoryRoot = new URL('../../', import.meta.url);
const paths = [
  'ui/src/utils/staticAssetHref.js',
  'ui/src/components/seo/siteMetadata.js',
  'ui/src/components/seo/structuredData.js',
  'ui/src/data/agentProtocolContent.js',
];
const sources = await Promise.all(paths.map(async (path) => [
  new URL(path, repositoryRoot).href,
  await readFile(new URL(path, repositoryRoot), 'utf8'),
]));
const revisionBase = '/_website/0123456789abcdef0123456789abcdef01234567/';
const siteUrl = 'https://elevenidllc.com';

async function loadWebsite(assetBase) {
  const browserWindow = {
    __MARTY_RUNTIME_CONFIG__: { websiteAssetBase: '/runtime-before/' },
  };
  const context = vm.createContext({ URL, window: browserWindow });
  const env = vm.runInContext('({})', context);
  if (assetBase !== undefined) env.VITE_WEBSITE_ASSET_BASE = assetBase;
  const modules = new Map(sources.map(([identifier, source]) => [
    identifier,
    new vm.SourceTextModule(source, {
      context,
      identifier,
      initializeImportMeta(meta) { meta.env = env; },
    }),
  ]));
  // Load each module even when checking the unadapted source for regression.
  const entry = new vm.SourceTextModule(
    paths.map((path) => `import './${path}';`).join('\n'),
    { context, identifier: new URL('__metadata_test_entry__.js', repositoryRoot).href },
  );
  await entry.link((specifier, referrer) => {
    assert.ok(specifier.startsWith('.'), `Unexpected dependency: ${specifier}`);
    const target = new URL(specifier, referrer.identifier).href;
    const dependency = modules.get(target) || modules.get(`${target}.js`);
    assert.ok(dependency, `Dependency outside the metadata slice: ${specifier}`);
    return dependency;
  });
  await entry.evaluate();
  return {
    asset: modules.get(sources[0][0]).namespace,
    metadata: modules.get(sources[1][0]).namespace,
    schemas: modules.get(sources[2][0]).namespace,
    env,
    browserWindow,
  };
}

function assertSharedImage(loaded, expected) {
  assert.equal(loaded.metadata.SITE_URL, siteUrl);
  assert.equal(loaded.metadata.DEFAULT_SEO_IMAGE_URL, expected);
  assert.equal(loaded.schemas.organizationSchema().logo, expected);
  const article = loaded.schemas.articleSchema({
    headline: 'Example',
    description: 'Example article',
    datePublished: '2026-11-16',
    url: `${siteUrl}/learn/example`,
  });
  assert.equal(article.publisher.logo.url, expected);
}

test('root builds retain root assets and absolute metadata image URLs', async () => {
  for (const base of [undefined, '', '/']) {
    const loaded = await loadWebsite(base);
    assert.equal(loaded.asset.staticAssetHref('/logo512.png'), '/logo512.png');
    assertSharedImage(loaded, `${siteUrl}/logo512.png`);
  }
});

test('revision builds share a namespaced image across metadata and JSON-LD', async () => {
  const loaded = await loadWebsite(revisionBase);
  assert.equal(loaded.asset.staticAssetHref('/logo512.png'), `${revisionBase}logo512.png`);
  assertSharedImage(loaded, `${siteUrl}${revisionBase}logo512.png`);
});

test('static assets preserve external, protocol-relative and non-root inputs', async () => {
  const { asset } = await loadWebsite(revisionBase);
  const object = { toString() { throw new Error('Unexpected coercion'); } };
  for (const value of [
    'https://cdn.example/logo.png', '//cdn.example/logo.png',
    'data:image/png;base64,example', 'images/logo.png', './logo.png',
    '?download=1', '#logo', '', undefined, null, 0, object,
  ]) {
    assert.equal(asset.staticAssetHref(value), value);
  }
});

test('namespaced assets preserve query strings and fragments', async () => {
  const { asset } = await loadWebsite(revisionBase);
  assert.equal(
    asset.staticAssetHref('/blog/example.png?width=640#preview'),
    `${revisionBase}blog/example.png?width=640#preview`,
  );
});

test('evaluated build base ignores runtime settings and later env mutations', async () => {
  const loaded = await loadWebsite(revisionBase);
  loaded.browserWindow.__MARTY_RUNTIME_CONFIG__ = {
    websiteAssetBase: 'https://mutable.example/assets/',
    VITE_WEBSITE_ASSET_BASE: '/runtime-after/',
  };
  loaded.env.VITE_WEBSITE_ASSET_BASE = '/changed-after-evaluation/';
  assert.equal(loaded.asset.staticAssetHref('/logo512.png'), `${revisionBase}logo512.png`);
  assertSharedImage(loaded, `${siteUrl}${revisionBase}logo512.png`);
});
