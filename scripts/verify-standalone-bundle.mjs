import assert from 'node:assert/strict';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = realpathSync(fileURLToPath(new URL('../ui/dist-website/', import.meta.url)));
function requireFile(relative) {
  const target = path.resolve(root, relative);
  assert.ok(target.startsWith(root + path.sep), `Escaping website artifact: ${relative}`);
  assert.ok(existsSync(target) && lstatSync(target).isFile() && !lstatSync(target).isSymbolicLink(), `Missing or nonregular website artifact: ${relative}`);
  assert.equal(realpathSync(target), target, `Symlinked website artifact: ${relative}`);
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
assert.ok(!html.includes('/src/index.jsx'), 'Application entry remained in website HTML');
const dom = new JSDOM(html);
const document = dom.window.document;
const resources = [...document.querySelectorAll('script[src], link[rel="modulepreload"]')];
assert.ok(document.querySelector('script[type="module"][src]'), 'Missing website module entry');
assert.ok(resources.length > 0, 'Missing executable entry resources');
for (const resource of resources) {
  const value = resource.getAttribute('src') || resource.getAttribute('href');
  assert.ok(value?.startsWith('/') && !value.startsWith('//'), 'Entry resources must be origin-relative');
  assert.ok(!value.includes('\\') && !value.includes('%') && !value.split('/').some((part) => part === '..' || part === '.'), `Noncanonical entry resource: ${value}`);
  const url = new URL(value, 'https://elevenidllc.com');
  assert.equal(url.origin, 'https://elevenidllc.com');
  assert.ok(url.pathname === '/_website/runtime-config.js' || url.pathname.startsWith('/_website/development/'), `Unowned entry resource: ${value}`);
  requireFile(url.pathname.slice(1));
}
dom.window.close();
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
  revision: release.revision, imageAndLocaleChecks: 8, executableResources: resources.length }));
