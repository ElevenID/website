import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createWebsitePrerenderPlan } from './website-prerender-plan.mjs';
import { websiteBuildRevision } from '../ui/scripts/web-surface-build-contract.mjs';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const dist = realpathSync(path.join(root, 'ui/dist-website'));
const sourceSha = process.env.MARTY_WEBSITE_SOURCE_SHA;
assert.match(sourceSha || '', /^[a-f0-9]{40}$/, 'Exact production source SHA is required');
const revision = websiteBuildRevision({ sourceSha, pages: 'public', revision: process.env.MARTY_WEBSITE_REVISION });
const image = process.env.WEBSITE_IMAGE || `elevenid-website:${revision}`;
assert.equal(image, `elevenid-website:${revision}`, 'Only the exact source-revision image may be qualified');
const containerName = 'website-production-' + randomUUID();
let containerId;
let origin;

function docker(args) {
  const result = execFileSync(process.env.DOCKER || 'docker', args, {
    encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.trim();
}
async function request(route, method = 'GET') {
  const response = await fetch(origin + route, { method, redirect: 'manual', signal: AbortSignal.timeout(10000) });
  return { status: response.status, headers: response.headers, body: method === 'HEAD' ? '' : await response.text() };
}
async function waitForReady() {
  let lastError;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await request('/healthz');
      if (response.status === 200 && response.body === 'ok\n') return;
      lastError = new Error('Nginx health returned ' + response.status);
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  let logs = '';
  try { logs = docker(['logs', containerId]); } catch {}
  throw new Error('Production website image did not become ready: ' + (lastError?.message || 'unknown') + '\\n' + logs.slice(-6000));
}

const plan = await createWebsitePrerenderPlan();
const routes = plan.routes;
const release = JSON.parse(readFileSync(path.join(dist, 'marty-website-release.json'), 'utf8'));
assert.equal(release.audience, 'production');
assert.equal(release.source_sha, sourceSha);
assert.equal(release.revision, revision);
assert.equal(release.production_pages, 'public');
assert.equal(release.commerce_extension, null);
const imageInfo = JSON.parse(docker(['image', 'inspect', image]))[0];
const imageLabels = imageInfo.Config.Labels || {};
assert.equal(imageLabels['org.opencontainers.image.source'], 'https://github.com/ElevenID/website');
assert.equal(imageLabels['org.opencontainers.image.revision'], sourceSha);
assert.equal(imageLabels['org.opencontainers.image.version'], revision);
assert.equal(imageLabels['com.elevenid.website.repository'], 'ElevenID/website');
assert.equal(imageLabels['com.elevenid.website.audience'], 'production');
assert.equal(imageLabels['com.elevenid.website.pages'], 'public');
assert.equal(imageLabels['com.elevenid.website.route-contract-sha256'], release.route_contract.sha256);
assert.match(imageInfo.Id || '', /^sha256:[a-f0-9]{64}$/);
assert.ok(imageInfo.Config.ExposedPorts?.['80/tcp'], 'Website image must expose port 80');

try {
  containerId = docker([
    'run', '--detach', '--rm', '--pull', 'never', '--read-only', '--network', 'bridge',
    '--publish', '127.0.0.1::80', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m',
    '--tmpfs', '/var/run:rw,noexec,nosuid,size=8m',
    '--tmpfs', '/var/cache/nginx:rw,noexec,nosuid,size=16m',
    '--security-opt', 'no-new-privileges:true', '--pids-limit', '64',
    '--name', containerName, image,
  ]);
  const binding = docker(['port', containerId, '80/tcp']);
  assert.ok(binding.startsWith('127.0.0.1:') && Number(binding.slice('127.0.0.1:'.length)) > 0,
    'Website image must bind to loopback only');
  origin = 'http://' + binding;
  await waitForReady();

  let indexHtml = '';
  const pageResults = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(8, routes.length) }, async () => {
    while (cursor < routes.length) {
      const route = routes[cursor++];
      const response = await request(route);
      assert.equal(response.status, 200, 'Nginx page route ' + route);
      assert.ok((response.headers.get('content-type') || '').includes('text/html'), 'Expected HTML response: ' + route);
      assert.equal(response.headers.get('x-marty-website-revision'), revision, route);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', route);
      assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN', route);
      assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', route);
      assert.ok((response.headers.get('content-security-policy') || '').includes("default-src 'self'"),
        'Content security policy missing: ' + route);
      const document = new JSDOM(response.body).window.document;
      assert.ok(document.querySelector('meta[name="prerender-status-code"][content="200"]'), 'Prerender marker missing: ' + route);
      assert.ok(document.querySelector('#root h1, #root h2, #root h3, #root h4, #root h5, #root h6'),
        'Rendered heading missing: ' + route);
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
      assert.ok(canonical && new URL(canonical).origin === 'https://elevenidllc.com', 'Canonical missing or invalid: ' + route);
      pageResults.push({ route, canonical });
      if (route === '/') indexHtml = response.body;
      document.defaultView.close();
    }
  });
  await Promise.all(workers);
  assert.ok(indexHtml, 'Homepage was not included in the route plan');

  const indexDocument = new JSDOM(indexHtml);
  const scriptPaths = Array.from(indexDocument.window.document.querySelectorAll('script[src]'),
    (script) => script.getAttribute('src')).filter((source) => {
      try { return new URL(source, 'https://elevenidllc.com').pathname.endsWith('.js'); }
      catch { return false; }
    });
  indexDocument.window.close();
  const immutableAsset = scriptPaths
    .map((source) => new URL(source, 'https://elevenidllc.com').pathname)
    .find((pathname) => pathname.startsWith(`/_website/${revision}/assets/`));
  assert.ok(immutableAsset, 'Homepage has no immutable Vite JavaScript entry');

  const resources = [
    ['/robots.txt', 'User-agent: *'],
    ['/sitemap.xml', /<urlset/],
    ['/sitemap-index.xml', /<sitemapindex/],
    ['/llms.txt', /ElevenID/i],
    ['/blog/rss.xml', /<rss/i],
    ['/marty-website-release.json', /marty.website-image/],
    [`/_website/${revision}/logo512.png`, null],
    [`/_website/${revision}/favicon.svg`, null],
    [immutableAsset, null],
  ];
  for (const [route, pattern] of resources) {
    const response = await request(route);
    assert.equal(response.status, 200, 'Nginx resource ' + route);
    assert.equal(response.headers.get('x-marty-website-revision'), revision, route);
    if (pattern) {
      if (typeof pattern === 'string') assert.ok(response.body.includes(pattern), route);
      else assert.match(response.body, pattern, route);
    }
  }

  // Verify every source-selected public resource through the actual image,
  // not just the representative icons and crawler endpoints above.
  const inventory = JSON.parse(readFileSync(path.join(root, 'docs/input-inventory/asset-inventory.json'), 'utf8'));
  const selectedAssets = inventory.files.filter((entry) => inventory.categories[entry.category]?.disposition !== 'exclude');
  assert.equal(selectedAssets.length, 46, 'Public asset acceptance inventory changed unexpectedly');
  const expectedMime = {
    '.png': /image\\/png/,
    '.svg': /image\\/svg\\+xml/,
    '.ico': /image\\/(?:x-icon|vnd\\.microsoft\\.icon)/,
    '.json': /application\\/json/,
    '.xml': /application\\/(?:rss\\+)?xml/,
    '.txt': /text\\/plain/,
    '.js': /(?:application|text)\\/javascript/,
  };
  for (const asset of selectedAssets) {
    const route = asset.path === 'llms.txt' || asset.path === 'blog/rss.xml'
      ? '/' + asset.path
      : asset.path === 'runtime-config.js'
        ? '/_website/runtime-config.js'
        : `/_website/${revision}/${asset.path}`;
    const response = await request(route);
    assert.equal(response.status, 200, 'Nginx public asset ' + asset.path);
    assert.equal(response.headers.get('x-marty-website-revision'), revision, asset.path);
    const mime = expectedMime[path.extname(asset.path).toLowerCase()];
    assert.ok(mime, 'No expected MIME contract for ' + asset.path);
    assert.match(response.headers.get('content-type') || '', mime, asset.path);
  }
  const runtime = await request('/_website/runtime-config.js');
  assert.equal(runtime.status, 200);
  assert.equal(runtime.headers.get('cache-control'), 'no-store');
  const immutable = await request(immutableAsset);
  assert.match(immutable.headers.get('cache-control') || '', /max-age=31536000.*immutable/);
  assert.equal(immutable.headers.get('x-marty-website-revision'), revision);

  for (const route of ['/pricing', '/pricing/', '/verify', '/console', '/applicant', '/admin', '/vendor',
    '/dashboard', '/auth/callback', '/api/status', '/v1/credential', '/index.html', '/unknown.png']) {
    assert.equal((await request(route)).status, 404, 'Withheld or application-owned path ' + route);
  }
  const dottedDemo = await request('/demos/2026.08.0');
  assert.equal(dottedDemo.status, 200, 'Numeric dotted demo version must remain a page route');
  const missingAsset = await request(`/_website/${revision}/assets/missing.js`);
  assert.equal(missingAsset.status, 404, 'Missing versioned asset must not fall back to HTML');

  console.log(JSON.stringify({
    qualified: 'production-website-image',
    source_sha: sourceSha,
    revision,
    image,
    image_id: imageInfo.Id,
    route_count: pageResults.length,
    resource_checks: resources.length + selectedAssets.length + 2,
    denied_route_checks: 13,
    security_headers: ['X-Marty-Website-Revision', 'X-Frame-Options', 'X-Content-Type-Options',
      'Referrer-Policy', 'Content-Security-Policy'],
    demo_publication: plan.demoIndex.releases.map((entry) => ({
      version: entry.stack_version, state: entry.publication_state, coverage: entry.coverage_state,
    })),
    repository: release.repository,
  }));
} finally {
  if (containerId) {
    try { docker(['rm', '--force', containerId]); } catch {}
  }
}
