import assert from 'node:assert/strict';
import { copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWebsitePrerenderPlan } from './website-prerender-plan.mjs';
import { assertWebsiteSource } from './lib/qualification-evidence.mjs';
import { websiteBuildSelection, websiteReleaseMetadata } from '../ui/scripts/web-surface-build-contract.mjs';
import { RETIRED_DEMO_SLUGS } from '../ui/src/services/platformDemoScenarios.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'ui/dist-website');
const selection = websiteBuildSelection();
assert.equal(selection.pages, 'public', 'Pages accepts the public website only');
assertWebsiteSource({ root, sourceSha: selection.sourceSha });
const metadata = JSON.parse(readFileSync(path.join(dist, 'marty-website-release.json'), 'utf8'));
assert.deepEqual(metadata, websiteReleaseMetadata(selection));
assert.equal(process.argv.length, 3, 'Supply a fresh output directory outside the checkout');
const output = path.resolve(process.argv[2]);
const outputParent = realpathSync(path.dirname(output));
assert.ok(!path.resolve(outputParent, path.basename(output)).startsWith(realpathSync(root) + path.sep));
const { routes } = await createWebsitePrerenderPlan();
mkdirSync(output); // Refuse an existing upload directory, including partially assembled output.
let fileCount = 0;
function budget(size) {
  assert.ok(++fileCount <= 20000, 'Pages Free file count exceeded');
  assert.ok(size <= 25 * 1024 * 1024, 'Pages asset size exceeded');
}
function copy(source, target = source) {
  const filename = path.join(dist, source);
  const stat = lstatSync(filename);
  assert.ok(stat.isFile() && realpathSync(filename).startsWith(realpathSync(dist) + path.sep));
  budget(stat.size);
  mkdirSync(path.dirname(path.join(output, target)), { recursive: true });
  copyFileSync(filename, path.join(output, target));
}
function write(target, body) {
  budget(Buffer.byteLength(body));
  writeFileSync(path.join(output, target), body, { flag: 'wx' });
}
function assets(directory) {
  assert.ok(lstatSync(path.join(dist, directory)).isDirectory());
  for (const item of readdirSync(path.join(dist, directory), { withFileTypes: true })) {
    const name = path.join(directory, item.name);
    if (item.isDirectory()) assets(name);
    else copy(name);
  }
}
for (const route of routes) {
  if (route === '/') copy('index.html');
  else copy(route.slice(1) + '/index.html', route.slice(1) + '.html');
}
for (const name of ['robots.txt', 'sitemap.xml', 'sitemap-index.xml', 'llms.txt', 'blog/rss.xml',
  'marty-website-release.json', '_website/runtime-config.js']) copy(name);
assets('_website/' + selection.revision);
write('healthz', 'ok\n');
write('404.html', '<!doctype html><html lang="en"><meta charset="utf-8"><title>Page not found | ElevenID</title><main><h1>Page not found</h1><a href="/">ElevenID home</a></main></html>\n');

// Reuse the deployed security header policy and fail if its format changes.
const headers = {};
for (const line of readFileSync(path.join(root, 'ui/nginx.website.headers.conf'), 'utf8').trim().split(/\r?\n/)) {
  const match = /^add_header ([\w-]+) (?:"([^"]+)"|(\$marty_website_revision)) always;$/.exec(line);
  assert.ok(match, 'Unsupported website security header');
  headers[match[1]] = match[2] ?? selection.revision;
}
write('_headers', ['/*', ...Object.entries(headers).map(([name, value]) => '  ' + name + ': ' + value),
  '/_website/runtime-config.js', '  Cache-Control: no-store', '/_website/' + selection.revision + '/*',
  '  Cache-Control: public, max-age=31536000, immutable', '/healthz', '  Content-Type: text/plain; charset=utf-8', ''].join('\n'));

// Pages redirects cannot emit 410 or withhold direct access to /index.html.
const worker = readFileSync(path.join(root, 'scripts/pages-status-handler.mjs'), 'utf8');
write('_worker.js', 'const retired = ' + JSON.stringify(RETIRED_DEMO_SLUGS) + ';\nconst headers = '
  + JSON.stringify(headers) + ';\n' + worker);
write('_routes.json', JSON.stringify({ version: 1, include: ['/index.html', '/demos/*'], exclude: [] }) + '\n');
console.log(JSON.stringify({ output, revision: selection.revision, routes: routes.length, files: fileCount }));
