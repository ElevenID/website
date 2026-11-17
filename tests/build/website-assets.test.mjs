import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { build } from 'vite';

const revision = '0123456789abcdef0123456789abcdef01234567';
const base = '/_website/' + revision + '/';
const pluginSource = fileURLToPath(new URL('../../ui/scripts/website-assets.mjs', import.meta.url));

test('real Vite build preserves website asset emission contracts', { timeout: 30000 }, async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'elevenid-website-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const ui = path.join(root, 'ui');
  const outDir = path.join(root, 'dist');
  async function write(relative, source) {
    const target = path.join(ui, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, source);
  }

  // Preserve the real plugin's bytes and relative public-root lookup. The test
  // never changes the repository's public directory or imports upstream assets.
  assert.ok((await stat(pluginSource)).size < 16384);
  const pluginCopy = path.join(ui, 'scripts', 'website-assets.mjs');
  await mkdir(path.dirname(pluginCopy), { recursive: true });
  await copyFile(pluginSource, pluginCopy);
  const { websiteAssetsPlugin } = await import(pathToFileURL(pluginCopy).href);

  const manifest = {
    name: 'Fixture website', display: 'standalone',
    start_url: '/old-entry', scope: '/old-scope',
    icons: [
      { src: '/favicon.ico', sizes: '16x16', type: 'image/x-icon' },
      { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
  const publicFiles = {
    'favicon.ico': 'small-icon-fixture',
    'apple-touch-icon.png': 'small-image-fixture',
    'manifest.json': JSON.stringify(manifest),
    'startup.js': 'globalThis.fixtureStartup = true;\n',
    'runtime-config.js': 'window.__MARTY_RUNTIME_CONFIG__ = {};\n',
    'llms.txt': 'Fixture website crawler description.\n',
    'blog/rss.xml': '<rss version="2.0"><channel/></rss>\n',
    'images/photo.txt': 'small-owned-image-fixture\n',
    'locales/en/common.json': '{"continue":"Continue"}\n',
    'locales/en/marketing.json': '{"product":"Product"}\n',
    'locales/en/application.json': '{"private":"Application only"}\n',
    'test-harness.html': '<p>Excluded harness</p>\n',
    'nested/fixture.html': '<p>Excluded nested HTML</p>\n',
  };
  for (const [name, source] of Object.entries(publicFiles)) await write('public/' + name, source);
  await write('index.html', [
    '<!doctype html><html><head>',
    '<link rel="icon" href="/favicon.ico?v=2">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/manifest.json">',
    '<script src="/runtime-config.js"></script>',
    '<script src="/startup.js"></script>',
    '</head><body><a href="/verify">Verify</a>',
    '<img src="https://cdn.example/external.png">',
    '<script type="module" src="/src/index.jsx"></script>',
    '</body></html>',
  ].join('\n'));
  // Deliberately omit src/index.jsx: only the website-entry rewrite can build.
  await write('src/website.jsx', [
    'import blog from "@elevenid/marty-blog";',
    'globalThis.websiteAssetFixture = { blog, local: "/images/local.txt" };',
  ].join('\n'));
  await write('node_modules/@elevenid/marty-blog/package.json', JSON.stringify({
    name: '@elevenid/marty-blog', type: 'module', exports: './index.js',
  }));
  await write('node_modules/@elevenid/marty-blog/index.js', [
    'export default {',
    '  owned: "/images/photo.txt", directory: "/images",',
    '  defaultLogo: "/logo512.png", absoluteDefaultLogo: "https://elevenidllc.com/logo512.png",'
    '  external: "https://cdn.example/images/photo.txt",',
    '  similar: "/images-other/photo.txt", route: "/blog/example"',
    '};',
  ].join('\n'));

  const result = await build({
    configFile: false, root: ui, publicDir: false, logLevel: 'silent',
    plugins: [websiteAssetsPlugin(revision)],
    build: {
      outDir, emptyOutDir: true, assetsDir: base.slice(1) + 'assets',
      minify: false, sourcemap: false, reportCompressedSize: false,
    },
  });
  const output = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
  const assets = new Set(output.filter((item) => item.type === 'asset').map((item) => item.fileName));
  const entry = output.find((item) => item.type === 'chunk' && item.isEntry);
  assert.ok(entry, 'Vite emitted the website entry chunk');
  const html = await readFile(path.join(outDir, 'index.html'), 'utf8');
  const asset = (name) => readFile(path.join(outDir, name), 'utf8');

  await t.test('builds the rewritten website entry into the immutable asset directory', async () => {
    assert.ok(Object.keys(entry.modules).some((id) => id.replace(/\\/g, '/').endsWith('/src/website.jsx')));
    assert.ok(entry.fileName.startsWith(base.slice(1) + 'assets/'));
    assert.ok(html.includes('src="/' + entry.fileName + '"'));
    assert.ok(!html.includes('/src/index.jsx'));
    assert.ok((await stat(path.join(outDir, entry.fileName))).size > 0);
  });

  await t.test('writes versioned public files and preserves stable runtime/crawler paths', async () => {
    for (const name of ['favicon.ico', 'apple-touch-icon.png', 'startup.js', 'images/photo.txt']) {
      const emitted = base.slice(1) + name;
      assert.ok(assets.has(emitted), emitted);
      assert.equal(await asset(emitted), publicFiles[name]);
      assert.ok(!assets.has(name), 'no unversioned duplicate: ' + name);
    }
    for (const [original, emitted] of [
      ['runtime-config.js', '_website/runtime-config.js'],
      ['llms.txt', 'llms.txt'], ['blog/rss.xml', 'blog/rss.xml'],
    ]) {
      assert.equal(await asset(emitted), publicFiles[original]);
      assert.ok(!assets.has(base.slice(1) + original));
    }
  });

  await t.test('retains only website translation namespaces and excludes HTML harnesses', async () => {
    for (const name of ['locales/en/common.json', 'locales/en/marketing.json']) {
      assert.equal(await asset(base.slice(1) + name), publicFiles[name]);
    }
    for (const name of ['locales/en/application.json', 'test-harness.html', 'nested/fixture.html']) {
      assert.ok(!assets.has(name));
      assert.ok(!assets.has(base.slice(1) + name));
    }
  });

  await t.test('rewrites emitted manifest icons while preserving other metadata', async () => {
    const emitted = JSON.parse(await asset(base.slice(1) + 'manifest.json'));
    assert.deepEqual(emitted, {
      ...manifest, start_url: '/', scope: '/',
      icons: manifest.icons.map((icon) => ({ ...icon, src: base + icon.src.replace(/^\//, '') })),
    });
  });

  await t.test('rewrites owned HTML URLs without changing route or external links', () => {
    for (const value of ['favicon.ico?v=2', 'apple-touch-icon.png', 'manifest.json', 'startup.js']) {
      assert.ok(html.includes('"' + base + value + '"'), value);
    }
    assert.ok(html.includes('src="/_website/runtime-config.js"'));
    assert.ok(html.includes('href="/verify"'));
    assert.ok(html.includes('src="https://cdn.example/external.png"'));
  });

  await t.test('bundles scoped blog image rewriting without rewriting unrelated URLs', () => {
    assert.ok(entry.code.includes(base + 'images/photo.txt'));
    assert.ok(entry.code.includes(base + 'images'));
    assert.ok(entry.code.includes(base + 'logo512.png'));
    assert.ok(entry.code.includes('https://elevenidllc.com' + base + 'logo512.png'));
    assert.ok(!entry.code.includes('https://elevenidllc.com/logo512.png'));
    assert.match(entry.code, /["']\/images\/local\.txt["']/);
    assert.ok(entry.code.includes('https://cdn.example/images/photo.txt'));
    assert.ok(entry.code.includes('/images-other/photo.txt'));
    assert.ok(entry.code.includes('/blog/example'));
  });
});
