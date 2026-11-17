// Isolated migration qualification, not a production server or release publisher.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { JSDOM } from 'jsdom';

const execute = promisify(execFile);
const dist = realpathSync(fileURLToPath(new URL('../ui/dist-website/', import.meta.url)));
const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome';
assert.ok(path.isAbsolute(chrome), 'CHROME_PATH must be absolute');
const version = (await execute(chrome, ['--version'], { timeout: 10000 })).stdout.trim();
const metadata = JSON.parse(readFileSync(path.join(dist, 'marty-website-release.json'), 'utf8'));
assert.equal(metadata.audience, 'development', 'This migration fixture must not claim production provenance');
assert.equal(metadata.revision, 'development');
const routes = ['/', '/product', '/standards', '/protocol', '/demos', '/blog'];
const misses = [];
const requests = [];
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.xml': 'application/xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const instrumentation = `<script>
window.__ELEVENID_PRERENDER__ = { demoManifests: true };
document.addEventListener('app-rendered', function () {
  document.documentElement.setAttribute('data-website-rendered', 'true');
  if (new URL(location.href).searchParams.has('handoff-probe')) {
    var link = Array.from(document.querySelectorAll('a[href]')).find(function (a) {
      var u = new URL(a.href); return u.origin === location.origin && u.pathname === '/verify';
    });
    if (link) setTimeout(function () { link.click(); }, 100);
  }
});
window.addEventListener('error', function (event) {
  if (event.target === window) document.documentElement.setAttribute('data-website-error', 'true');
});
window.addEventListener('unhandledrejection', function () {
  document.documentElement.setAttribute('data-website-error', 'true');
});
</script>`;
const server = createServer((request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    const parsed = new URL(request.url, 'http://127.0.0.1');
    const route = decodeURIComponent(parsed.pathname);
    if (route.includes('\\') || route.includes('\0') || route.split('/').some((part) => part === '..')) {
      response.writeHead(400).end(); return;
    }
    requests.push(route);
    // A deliberately separate application document: this is not a live app.
    if (route === '/verify') {
      response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      response.end('<!doctype html><html data-application-handoff="true"><head><title>Application boundary fixture</title></head><body>Application boundary fixture</body></html>');
      return;
    }
    const filename = path.resolve(dist, '.' + route);
    if (filename !== dist && !filename.startsWith(dist + path.sep)) { response.writeHead(400).end(); return; }
    let body;
    let mime;
    if (routes.includes(route)) {
      body = readFileSync(path.join(dist, 'index.html'), 'utf8').replace('<head>', '<head>' + instrumentation);
      mime = types['.html'];
    } else if (existsSync(filename) && lstatSync(filename).isFile() && !lstatSync(filename).isSymbolicLink()
      && realpathSync(filename).startsWith(dist + path.sep)) {
      body = readFileSync(filename);
      mime = types[path.extname(filename)] || 'application/octet-stream';
    } else {
      misses.push(route);
      response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(400).end();
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const receipt = { scope: 'complete-assets-development-render-fixture', chrome: version, pages: [], application_handoff_fixture: false };
async function render(route) {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'website-chrome-'));
  try {
    const result = await execute(chrome, [
      '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--disable-background-networking', '--disable-component-update', '--no-first-run',
      '--disable-background-timer-throttling', '--run-all-compositor-stages-before-draw',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
      `--user-data-dir=${profile}`, '--dump-dom', '--virtual-time-budget=20000', '--timeout=30000',
      origin + route,
    ], { timeout: 45000, maxBuffer: 8 * 1024 * 1024 });
    return new JSDOM(result.stdout).window.document;
  } finally { rmSync(profile, { recursive: true, force: true }); }
}
try {
  for (const route of routes) {
    const start = misses.length;
    const document = await render(route);
    const root = document.documentElement;
    assert.equal(root.getAttribute('data-website-error'), null, `Browser exception on ${route}`);
    assert.equal(root.getAttribute('data-website-rendered'), 'true', `app-rendered was not observed on ${route}; missing resources: ${misses.slice(start).join(', ')}`);
    assert.ok(root.classList.contains('app-ready'), `Startup did not finish on ${route}`);
    const heading = document.querySelector('#root h1');
    assert.ok(heading?.textContent.trim(), `No rendered page heading on ${route}`);
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
    assert.equal(canonical, 'https://elevenidllc.com' + (route === '/' ? '/' : route), `Canonical mismatch on ${route}`);
    assert.deepEqual(misses.slice(start), [], `Missing same-origin resources on ${route}`);
    receipt.pages.push({ route, heading: heading.textContent.trim(), canonical });
    console.log(JSON.stringify({ rendered: route, heading: heading.textContent.trim() }));
    document.defaultView.close();
  }
  const before = requests.filter((route) => route === '/verify').length;
  const handoff = await render('/?handoff-probe=1');
  assert.equal(handoff.documentElement.getAttribute('data-application-handoff'), 'true', 'Verification CTA did not load the application document');
  assert.ok(requests.filter((route) => route === '/verify').length > before, 'No document request reached the application fixture');
  receipt.application_handoff_fixture = true;
  handoff.defaultView.close();
  console.log(JSON.stringify(receipt));
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
