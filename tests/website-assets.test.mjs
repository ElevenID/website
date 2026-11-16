import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  websiteAssetBase,
  websiteAssetsPlugin,
} from '../ui/scripts/website-assets.mjs';

const publicRevision = 'a'.repeat(40);
const commerceRevision = 'b'.repeat(40);

test('website assets retain development, public and combined revision namespaces', () => {
  for (const revision of [
    'development', publicRevision, publicRevision + '-' + commerceRevision,
  ]) {
    assert.equal(websiteAssetBase(revision), '/_website/' + revision + '/');
  }
});

test('unsupported revision names cannot create an asset namespace', () => {
  for (const revision of [
    '', 'main', '../development', 'development/', '/development',
    'a'.repeat(39), 'A'.repeat(40), publicRevision + '-short',
    publicRevision + '-' + commerceRevision + '-extra',
  ]) {
    assert.throws(() => websiteAssetBase(revision), /Invalid website asset revision/);
    assert.throws(() => websiteAssetsPlugin(revision), /Invalid website asset revision/);
  }
});

test('HTML uses the website entry, stable runtime URL and revision-specific assets', () => {
  const plugin = websiteAssetsPlugin(publicRevision);
  const html = [
    '<script type="module" src="/src/index.jsx"></script>',
    '<script src="/runtime-config.js"></script>',
    '<link rel="icon" href="/favicon.ico?generation=2">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/manifest.json">',
    '<script src="/startup.js"></script>',
    '<a href="/login">Application</a>',
    '<a href="/blog/example">Article</a>',
    '<img src="https://cdn.example/image.png">',
  ].join('\n');
  const transformed = plugin.transformIndexHtml.handler(html);
  const base = websiteAssetBase(publicRevision);
  assert.equal(plugin.enforce, 'pre');
  assert.equal(plugin.transformIndexHtml.order, 'pre');
  assert.ok(transformed.includes('src="/src/website.jsx"'));
  assert.ok(transformed.includes('src="/_website/runtime-config.js"'));
  for (const file of ['favicon.ico?generation=2', 'apple-touch-icon.png', 'manifest.json', 'startup.js']) {
    assert.ok(transformed.includes('"' + base + file + '"'), file);
  }
  assert.ok(transformed.includes('href="/login"'));
  assert.ok(transformed.includes('href="/blog/example"'));
  assert.ok(transformed.includes('src="https://cdn.example/image.png"'));
  assert.ok(!transformed.includes(base + 'runtime-config.js'));
});

test('only blog-owned local image literals receive the asset prefix', () => {
  const plugin = websiteAssetsPlugin(publicRevision);
  const base = websiteAssetBase(publicRevision);
  const tick = String.fromCharCode(96);
  const code = [
    'const photo = "/images/photo.png";',
    "const single = '/images';",
    'const template = ' + tick + '/images/template.png' + tick + ';',
    'const external = "https://cdn.example/images/photo.png";',
    'const protocolRelative = "//cdn.example/images/photo.png";',
    'const similar = "/images-other/photo.png";',
    'const route = "/blog/example";',
  ].join('\n');
  const expected = code
    .replace('"/images/photo.png"', '"' + base + 'images/photo.png"')
    .replace("'/images'", "'" + base + "images'")
    .replace(tick + '/images/template.png', tick + base + 'images/template.png');

  for (const id of [
    '/project/node_modules/@elevenid/marty-blog/dist/data.js',
    'C:\\project\\node_modules\\@elevenid\\marty-blog\\dist\\data.js',
  ]) {
    assert.deepEqual(plugin.transform(code, id), { code: expected, map: null });
  }
});

test('unrelated modules and unchanged blog code remain untouched', () => {
  const plugin = websiteAssetsPlugin('development');
  const imageCode = 'const image = "/images/local.png";';
  for (const id of [
    '/project/src/data.js',
    '/project/node_modules/@elevenid/marty-blog-other/dist/data.js',
  ]) {
    assert.equal(plugin.transform(imageCode, id), null);
  }
  assert.equal(plugin.transform(
    'const image = "https://cdn.example/images/photo.png";',
    '/project/node_modules/@elevenid/marty-blog/dist/data.js',
  ), null);
});
