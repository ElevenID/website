import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../ui/dist-website/', import.meta.url));
function requireFile(relative) {
  const target = path.join(root, relative);
  assert.ok(existsSync(target) && statSync(target).isFile(), `Missing website artifact: ${relative}`);
  return target;
}
const release = JSON.parse(readFileSync(requireFile('marty-website-release.json'), 'utf8'));
assert.equal(release.repository, 'ElevenID/website');
assert.equal(release.surface, 'website');
assert.equal(release.audience, 'development');
assert.equal(release.source_sha, 'development');
assert.equal(release.revision, 'development');
assert.equal(release.production_pages, 'public');
assert.equal(release.commerce_extension, null);

const html = readFileSync(requireFile('index.html'), 'utf8');
assert.match(html, /ElevenID/);
assert.match(html, /_website\\/development\\/assets\\/[^"']+\\.js/);
assert.doesNotMatch(html, /src=["']\\/src\\/index\\.jsx/);
const assets = path.join(root, '_website/development/assets');
const chunks = readdirSync(assets).filter((name) => name.endsWith('.js'));
assert.ok(chunks.length > 0, 'No real Vite JavaScript chunks emitted');
for (const filename of ['logo192.png', 'logo512.png', 'manifest.json', 'favicon.ico',
  'locales/en/common.json', 'locales/en/marketing.json',
  'demos/manifests/index.json', 'images/demos/2026.08.0/portfolio-draft.svg']) {
  requireFile('_website/development/' + filename);
}
for (const filename of ['llms.txt', 'blog/rss.xml', '_website/runtime-config.js']) {
  requireFile(filename);
}
assert.ok(!existsSync(path.join(root, 'console/index.html')), 'Application console leaked into website');
console.log(JSON.stringify({ qualified: 'development-website-bundle-smoke', chunks: chunks.length,
  revision: release.revision, imageAndLocaleChecks: 8 }));
