import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createWebsitePrerenderPlan } from './website-prerender-plan.mjs';
import { websiteBuildRevision } from '../ui/scripts/web-surface-build-contract.mjs';
import { renderWebsiteNginx } from '../ui/scripts/render-website-nginx.mjs';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const dist = realpathSync(path.join(root, 'ui/dist-website'));
const sourceSha = process.env.MARTY_WEBSITE_SOURCE_SHA;
assert.match(sourceSha || '', /^[a-f0-9]{40}$/, 'Exact production source SHA is required');
const revision = websiteBuildRevision({ sourceSha, pages: 'public', revision: process.env.MARTY_WEBSITE_REVISION });
const image = 'nginx@sha256:785835ea65db4bba6f021acc0f3be91b0fef76a53fe41f8588c6698d2aed0606';
const configRoot = mkdtempSync(path.join(os.tmpdir(), 'website-production-nginx-'));
chmodSync(configRoot, 0o755);
const containerName = 'website-production-' + randomUUID();
let containerId;
let origin;

function docker(args, allowFailure = false) {
  const result = execFileSync('docker', args, {
    encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.trim();
}
function writeConfig(name, contents) {
  const filename = path.join(configRoot, name);
  writeFileSync(filename, contents, { encoding: 'utf8', mode: 0o644 });
  return filename;
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
      if (response.status === 200 && response.body === 'ok\\n') return;
      lastError = new Error('Nginx health returned ' + response.status);
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  let logs = '';
  try { logs = docker(['logs', containerId]); } catch {}
  throw new Error('Production Nginx did not become ready: ' + (lastError?.message || 'unknown') + '\\n' + logs.slice(-6000));
}
const plan = await createWebsitePrerenderPlan();
const routes = plan.routes;
const nginxConfig = readFileSync(new URL('../ui/nginx.website.conf', import.meta.url), 'utf8');
const headersConfig = readFileSync(new URL('../ui/nginx.website.headers.conf', import.meta.url), 'utf8');
const routeConfig = renderWebsiteNginx(revision);
const configFile = writeConfig('default.conf', nginxConfig);
const routesFile = writeConfig('routes.conf', routeConfig);
const headersFile = writeConfig('headers.conf', headersConfig);

try {
  containerId = docker([
    'run', '--detach', '--rm', '--pull', 'never', '--read-only', '--network', 'bridge',
    '--publish', '127.0.0.1::80', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m',
    '--tmpfs', '/var/run:rw,noexec,nosuid,size=8m',
    '--tmpfs', '/var/cache/nginx:rw,noexec,nosuid,size=16m',
    '--security-opt', 'no-new-privileges:true', '--name', containerName,
    '--mount', `type=bind,source=${dist},target=/usr/share/nginx/html,readonly`,
    '--mount', `type=bind,source=${configFile},target=/etc/nginx/conf.d/default.conf,readonly`,
    '--mount', `type=bind,source=${routesFile},target=/etc/nginx/marty-website-routes.conf,readonly`,
    '--mount', `type=bind,source=${headersFile},target=/etc/nginx/marty-website-headers.conf,readonly`,
    image,
  ]);
  const binding = docker(['port', containerId, '80/tcp']);
  assert.match(binding, /^127\\.0\\.0\\.1:\\d+$/, 'Nginx must bind to loopback only');
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
      assert.match(response.headers.get('content-type') || '', /text\\/html/, route);
      assert.equal(response.headers.get('x-marty-website-revision'), revision, route);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', route);
      assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN', route);
      assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', route);
      assert.match(response.headers.get('content-security-policy') || '', /default-src 'self'/, route);
      const document = new JSDOM(response.body).window.document;
      assert.ok(document.querySelector('meta[name="prerender-status-code"][content="200"]'), 'Prerender marker missing: ' + route);
      assert.ok(document.querySelector('#root h1, #root h2, #root h3, #root h4, #root h5, #root h6'), 'Rendered heading missing: ' + route);
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
      assert.ok(canonical && new URL(canonical).origin === 'https://elevenidllc.com', 'Canonical missing or invalid: ' + route);
      pageResults.push({ route, canonical });
      if (route === '/') indexHtml = response.body;
      document.defaultView.close();
    }
  });
  await Promise.all(workers);
  assert.ok(indexHtml, 'Homepage was not included in the route plan');

  const release = JSON.parse(readFileSync(path.join(dist, 'marty-website-release.json'), 'utf8'));
  const scriptMatch = indexHtml.match(/<script[^>]+src=["']([^"']+\\.js)["']/i);
  assert.ok(scriptMatch, 'Homepage has no emitted JavaScript entry');
  const immutableAsset = new URL(scriptMatch[1], 'https://elevenidllc.com').pathname;
  const resources = [
    ['/robots.txt', /User-agent: \\*/],
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
    if (pattern) assert.match(response.body, pattern, route);
  }
  const runtime = await request('/_website/runtime-config.js');
  assert.equal(runtime.status, 200);
  assert.equal(runtime.headers.get('cache-control'), 'no-store');
  const immutable = await request(immutableAsset);
  assert.match(immutable.headers.get('cache-control') || '', /max-age=31536000.*immutable/);
  assert.equal(immutable.headers.get('x-marty-website-revision'), revision);

  for (const route of ['/pricing', '/pricing/', '/verify', '/console', '/applicant', '/admin', '/vendor', '/dashboard', '/auth/callback', '/api/status', '/v1/credential', '/index.html', '/unknown.png']) {
    assert.equal((await request(route)).status, 404, 'Withheld or application-owned path ' + route);
  }
  const dottedDemo = await request('/demos/2026.08.0');
  assert.equal(dottedDemo.status, 200, 'Numeric dotted demo version must remain a page route');
  const missingAsset = await request(`/_website/${revision}/assets/missing.js`);
  assert.equal(missingAsset.status, 404, 'Missing versioned asset must not fall back to HTML');

  console.log(JSON.stringify({
    qualified: 'production-website-nginx',
    source_sha: sourceSha,
    revision,
    image,
    route_count: pageResults.length,
    resource_checks: resources.length + 2,
    denied_route_checks: 13,
    security_headers: ['X-Marty-Website-Revision', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Content-Security-Policy'],
    demo_publication: plan.demoIndex.releases.map((entry) => ({ version: entry.stack_version, state: entry.publication_state, coverage: entry.coverage_state })),
    repository: release.repository,
  }));
} finally {
  if (containerId) {
    try { docker(['rm', '--force', containerId]); } catch {}
  }
  rmSync(configRoot, { recursive: true, force: true });
}
