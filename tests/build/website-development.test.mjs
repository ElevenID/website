import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer, loadConfigFromFile } from 'vite';

test('the standalone Vite config retains the reviewed public origin and HMR port', async () => {
  const previous = process.env.VITE_DEV_PUBLIC_ORIGIN;
  process.env.VITE_DEV_PUBLIC_ORIGIN = 'https://website.dev.example:8443';
  try {
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' },
      fileURLToPath(new URL('../../ui/vite.config.mjs', import.meta.url)));
    assert.equal(loaded.config.server.origin, 'https://website.dev.example:8443');
    assert.deepEqual(loaded.config.server.allowedHosts, ['localhost', 'website.dev.example']);
    assert.deepEqual(loaded.config.server.hmr, { protocol: 'wss', host: 'website.dev.example', clientPort: 8443 });
    assert.deepEqual(loaded.config.server.cors, { origin: 'https://website.dev.example:8443' });
  } finally {
    if (previous === undefined) delete process.env.VITE_DEV_PUBLIC_ORIGIN;
    else process.env.VITE_DEV_PUBLIC_ORIGIN = previous;
  }
});

test('the real website development server serves executable and public resources without SPA fallbacks', { timeout: 30000 }, async (t) => {
  const server = await createServer({
    configFile: fileURLToPath(new URL('../../ui/vite.config.mjs', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent',
  });
  t.after(() => server.close());
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const resource = async (pathname, type, source) => {
    const response = await fetch(origin + pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(response.headers.get('content-type'), type, pathname);
    assert.equal(response.headers.get('cache-control'), 'no-store', pathname);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (source) assert.deepEqual(bytes, readFileSync(new URL('../../ui/public/' + source, import.meta.url)), pathname);
    return bytes;
  };
  const page = await fetch(origin + '/product');
  const html = await page.text();
  assert.match(html, /src="\/_website\/runtime-config\.js"/);
  assert.match(html, /src="\/_website\/development\/startup\.js"/);
  assert.match(html, /src="\/src\/website\.jsx"/);
  await resource('/_website/runtime-config.js', /javascript/, 'runtime-config.js');
  await resource('/_website/development/startup.js', /javascript/, 'startup.js');
  await resource('/_website/development/config.json', /application\/json/, 'config.json');
  for (const language of ['en', 'de', 'es', 'fr', 'ja', 'nl']) {
    for (const namespace of ['common', 'marketing']) {
      const name = `locales/${language}/${namespace}.json`;
      await resource('/_website/development/' + name, /application\/json/, name);
    }
  }
  await resource('/_website/development/demos/manifests/index.json', /application\/json/, 'demos/manifests/index.json');
  await resource('/_website/development/logo512.png', /image\/png/, 'logo512.png');
  await resource('/blog/rss.xml', /application\/xml/, 'blog/rss.xml');
  await resource('/llms.txt', /text\/plain/, 'llms.txt');
  const manifest = JSON.parse(await resource('/_website/development/manifest.json', /application\/json/));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.icons.every(({ src }) => src.startsWith('/_website/development/')));
  for (const pathname of ['/_website/expired/startup.js', '/_website/development/missing.json',
    '/_website/development/locales/en/console.json', '/_website/development/runtime-config.js',
    '/_website/development/%2e%2e%2fpackage.json', '/_website/development/%ZZ']) {
    const missing = await fetch(origin + pathname);
    assert.equal(missing.status, 404, pathname);
    assert.doesNotMatch(await missing.text(), /<!doctype html>/i, pathname);
  }
  const head = await fetch(origin + '/_website/development/config.json', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});
