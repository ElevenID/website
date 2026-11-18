import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync,
  renameSync, rmSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { JSDOM } from 'jsdom';
import { websiteBuildRevision } from '../ui/scripts/web-surface-build-contract.mjs';
import { createWebsitePrerenderPlan } from './website-prerender-plan.mjs';

const execute = promisify(execFile);
const SITE_ORIGIN = 'https://elevenidllc.com';
const repositoryRoot = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const distRoot = realpathSync(path.join(repositoryRoot, 'ui/dist-website'));
const sourceSha = process.env.MARTY_WEBSITE_SOURCE_SHA;
const pages = process.env.MARTY_PRODUCTION_PAGES || 'public';
assert.match(sourceSha || '', /^[a-f0-9]{40}$/, 'Production prerender requires an exact website source SHA');
assert.equal(pages, 'public', 'This repository only publishes the public website');
const revision = websiteBuildRevision({ sourceSha, pages, revision: process.env.MARTY_WEBSITE_REVISION });
const releasePath = path.join(distRoot, 'marty-website-release.json');
assert.ok(existsSync(releasePath), 'Website release metadata is missing');
const release = JSON.parse(readFileSync(releasePath, 'utf8'));
assert.equal(release.audience, 'production');
assert.equal(release.source_sha, sourceSha);
assert.equal(release.revision, revision);
assert.equal(release.production_pages, 'public');
assert.equal(release.commerce_extension, null);

const plan = await createWebsitePrerenderPlan();
const routes = plan.routes;
const routeSet = new Set(routes);
const shellPath = path.join(distRoot, 'index.html');
const shell = readFileSync(shellPath, 'utf8');
const instrumentation = [
  '<script data-website-prerender-instrumentation>',
  'window.__ELEVENID_PRERENDER__ = { demoManifests: true };',
  "window.addEventListener('error', function (event) { if (event.target === window) document.documentElement.setAttribute('data-website-error', event.message || 'script error'); }, true);",
  "window.addEventListener('unhandledrejection', function (event) { var reason = event.reason; document.documentElement.setAttribute('data-website-error', reason && reason.message ? reason.message : 'unhandled rejection'); });",
  "document.addEventListener('app-rendered', function () { document.documentElement.setAttribute('data-website-rendered', 'true'); document.documentElement.setAttribute('data-website-final-path', window.location.pathname); });",
  '</script>',
].join('\n');
assert.ok(shell.includes('</head>'), 'Website shell has no head closing tag');
const browserShell = shell.replace('</head>', instrumentation + '\n</head>');
const misses = [];
const requests = [];
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.map': 'application/json; charset=utf-8',
};

const server = createServer((request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405).end();
      return;
    }
    const parsed = new URL(request.url || '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(parsed.pathname);
    if (pathname.includes('\\') || pathname.includes(String.fromCharCode(0))
      || pathname.split('/').some((part) => part === '..')) {
      response.writeHead(400).end();
      return;
    }
    const route = pathname.replace(/\/+$/, '') || '/';
    requests.push(pathname);
    if (routeSet.has(route)) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : browserShell);
      return;
    }
    const filename = path.resolve(distRoot, '.' + pathname);
    if (filename !== distRoot && !filename.startsWith(distRoot + path.sep)) {
      response.writeHead(400).end();
      return;
    }
    if (existsSync(filename)) {
      const stat = lstatSync(filename);
      if (stat.isFile() && !stat.isSymbolicLink()) {
        const real = realpathSync(filename);
        if (!real.startsWith(distRoot + path.sep)) {
          response.writeHead(403).end();
          return;
        }
        const body = readFileSync(real);
        response.writeHead(200, {
          'Content-Type': mimeTypes[path.extname(real).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        response.end(request.method === 'HEAD' ? undefined : body);
        return;
      }
    }
    misses.push(pathname);
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  } catch {
    response.writeHead(400).end();
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const origin = 'http://127.0.0.1:' + server.address().port;
const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const chromeVersion = (await execute(chrome, ['--version'], { timeout: 10000 })).stdout.trim();
const loopbackAssetOrigin = /https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?=\/(?:_website\/[^/]+\/)?assets\/)/gi;
const canonicalPages = new Map();
const pageReceipts = [];

function writeAtomic(filename, contents) {
  const parent = path.dirname(filename);
  mkdirSync(parent, { recursive: true });
  const realParent = realpathSync(parent);
  assert.ok(realParent === distRoot || realParent.startsWith(distRoot + path.sep), 'Prerender output escaped the website directory');
  if (existsSync(filename)) assert.ok(lstatSync(filename).isFile() && !lstatSync(filename).isSymbolicLink(), 'Prerender target must be a regular file');
  const temporary = filename + '.' + process.pid + '.tmp';
  try {
    writeFileSync(temporary, contents, { encoding: 'utf8', flag: 'wx', mode: 0o644 });
    renameSync(temporary, filename);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function outputForRoute(route) {
  return route === '/' ? path.join(distRoot, 'index.html')
    : path.resolve(distRoot, route.slice(1), 'index.html');
}

function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function renderRoute(route) {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'elevenid-website-prerender-'));
  const missStart = misses.length;
  const requestStart = requests.length;
  try {
    const args = [
      '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--disable-background-networking', '--disable-component-update', '--disable-extensions',
      '--no-first-run', '--disable-background-timer-throttling', '--run-all-compositor-stages-before-draw',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
      '--user-data-dir=' + profile, '--dump-dom', '--virtual-time-budget=45000', '--timeout=60000',
      origin + route,
    ];
    let stdout;
    try {
      stdout = (await execute(chrome, args, { timeout: 70000, maxBuffer: 32 * 1024 * 1024 })).stdout;
    } catch (error) {
      throw new Error('Chrome failed to prerender ' + route + ': ' + String(error.stderr || error.message).slice(-5000));
    }
    const dom = new JSDOM(stdout);
    const document = dom.window.document;
    const htmlElement = document.documentElement;
    assert.ok(htmlElement, 'Chrome returned no document for ' + route);
    assert.equal(htmlElement.getAttribute('data-website-error'), null, 'Browser JavaScript error on ' + route);
    const readiness = htmlElement.getAttribute('data-website-rendered');
    if (readiness !== 'true') {
      const loading = Boolean(document.querySelector('[data-app-loading]'));
      const rootText = document.querySelector('#root')?.textContent?.trim().slice(0, 400) || '';
      const routeMisses = misses.slice(missStart);
      assert.equal(readiness, 'true', 'app-rendered was not observed on ' + route
        + '; appLoading=' + loading + '; rootText=' + JSON.stringify(rootText)
        + '; missingResources=' + JSON.stringify(routeMisses));
    }
    assert.ok(htmlElement.classList.contains('app-ready'), 'Application startup did not finish on ' + route);
    const finalPath = htmlElement.getAttribute('data-website-final-path');
    assert.ok(finalPath && finalPath.startsWith('/'), 'Browser did not report a final route for ' + route);
    const heading = document.querySelector('#root h1, #root h2, #root h3, #root h4, #root h5, #root h6');
    assert.ok(heading && heading.textContent.trim(), 'Rendered page has no h1 on ' + route);
    if (route.startsWith('/demos')) {
      assert.ok(document.querySelector('[data-demo-render-state="settled"]'), 'Demo route did not settle: ' + route);
    }
    if (route === '/demos' || /^\/demos\/\d{4}\.\d{2}\.\d+$/.test(route)) {
      const selected = plan.demoIndex.releases.find((entry) => entry.stack_version === (route === '/demos'
        ? plan.demoIndex.latest_approved_stack_version || plan.demoIndex.latest_available_stack_version
        : route.split('/')[2]));
      if (selected && selected.publication_state === 'DRAFT') {
        assert.match(document.body.textContent.toLowerCase(), /publication preview/, 'Draft demo release lost its publication disclaimer on ' + route);
      }
    }

    const title = document.title.trim();
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim();
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
    const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim();
    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    const twitterImage = document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
    assert.ok(title && description && canonical && ogTitle && ogDescription && ogImage && twitterImage,
      'Required SEO metadata is incomplete on ' + route);
    const canonicalUrl = new URL(canonical);
    assert.equal(canonicalUrl.origin, 'https://elevenidllc.com', 'Canonical left the public site on ' + route);
    assert.ok(!/^\/(?:pricing|verify|console|applicant|admin|vendor|dashboard|auth|api|v1)(?:\/|$)/.test(canonicalUrl.pathname),
      'Canonical exposed a withheld or application-owned route on ' + route);
    assert.equal(ogImage, twitterImage, 'Open Graph and Twitter images differ on ' + route);
    const ogImageUrl = new URL(ogImage, SITE_ORIGIN);
    assert.equal(ogImageUrl.protocol, 'https:', 'Social image must use HTTPS on ' + route);
    if (ogImageUrl.origin === 'https://elevenidllc.com') {
      const imageFile = path.resolve(distRoot, '.' + decodeURIComponent(ogImageUrl.pathname));
      assert.ok(imageFile.startsWith(distRoot + path.sep) && existsSync(imageFile)
        && lstatSync(imageFile).isFile() && !lstatSync(imageFile).isSymbolicLink(),
      'Social image is not emitted by the website build on ' + route + ': ' + ogImageUrl.pathname);
    }
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { JSON.parse(script.textContent); } catch { assert.fail('Invalid JSON-LD on ' + route); }
    }
    const noindex = /noindex/i.test(document.querySelector('meta[name="robots"]')?.getAttribute('content') || '');
    if (!noindex) canonicalPages.set(canonicalUrl.href, canonicalUrl.pathname);

    document.querySelector('script[data-website-prerender-instrumentation]')?.remove();
    htmlElement.removeAttribute('data-website-rendered');
    htmlElement.removeAttribute('data-website-final-path');
    htmlElement.removeAttribute('data-website-error');
    let statusMeta = document.querySelector('meta[name="prerender-status-code"]');
    if (!statusMeta) {
      statusMeta = document.createElement('meta');
      statusMeta.setAttribute('name', 'prerender-status-code');
      statusMeta.setAttribute('content', '200');
      document.head.appendChild(statusMeta);
    }
    const renderedHtml = dom.serialize().replace(loopbackAssetOrigin, '');
    assert.ok(!renderedHtml.includes(origin), 'Prerendered HTML retained its temporary loopback origin on ' + route);
    assert.deepEqual(misses.slice(missStart), [], 'Missing same-origin resources on ' + route + ': ' + misses.slice(missStart).join(', '));
    writeAtomic(outputForRoute(route), renderedHtml);
    pageReceipts.push({
      route, final_path: finalPath, title, canonical: canonicalUrl.href,
      description_length: description.length, has_json_ld: document.querySelectorAll('script[type="application/ld+json"]').length > 0,
      same_origin_requests: requests.length - requestStart,
    });
    console.log(JSON.stringify({ prerendered: route, title, canonical: canonicalUrl.href }));
    dom.window.close();
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}

try {
  for (const route of routes) await renderRoute(route);

  const priority = {
    '/': '1.0', '/product': '0.9', '/solutions': '0.9', '/developers': '0.9',
    '/standards': '0.8', '/resources': '0.8', '/architecture': '0.8',
    '/security': '0.8', '/ai': '0.8', '/why-verifiable-identity': '0.8',
    '/what-is-credential-verification': '0.7', '/what-is-open-badge': '0.7',
    '/what-is-digital-credential': '0.7', '/what-is-marty-protocol': '0.7',
  };
  const sitemapEntries = Array.from(canonicalPages.entries()).map(([url, pathname]) => ({
    url, priority: priority[pathname] || '0.7',
  })).sort((left, right) => left.url === SITE_ORIGIN + '/' ? -1 : right.url === SITE_ORIGIN + '/' ? 1 : left.url.localeCompare(right.url));
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapEntries.map((entry) => '  <url><loc>' + xmlEscape(entry.url)
      + '</loc><changefreq>weekly</changefreq><priority>' + entry.priority + '</priority></url>'),
    '</urlset>',
    '',
  ].join('\n');
  const sitemapIndex = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <sitemap><loc>' + SITE_ORIGIN + '/sitemap.xml</loc></sitemap>',
    '</sitemapindex>',
    '',
  ].join('\n');
  const robots = [
    'User-agent: *', 'Allow: /',
    'Disallow: /pricing', 'Disallow: /console', 'Disallow: /console/',
    'Disallow: /applicant', 'Disallow: /applicant/', 'Disallow: /admin', 'Disallow: /admin/',
    'Disallow: /vendor', 'Disallow: /vendor/', 'Disallow: /dashboard',
    'Disallow: /test-harness', 'Disallow: /login', 'Disallow: /auth/',
    'Disallow: /api/', 'Disallow: /v1/', '',
    'User-agent: GPTBot', 'Allow: /', '',
    'User-agent: ChatGPT-User', 'Allow: /', '',
    'User-agent: Google-Extended', 'Allow: /', '',
    'User-agent: Anthropic-AI', 'Allow: /', '',
    'User-agent: ClaudeBot', 'Allow: /', '',
    'User-agent: PerplexityBot', 'Allow: /', '',
    'User-agent: Cohere-AI', 'Allow: /', '',
    'Sitemap: ' + SITE_ORIGIN + '/sitemap.xml', '',
  ].join('\n');
  writeAtomic(path.join(distRoot, 'sitemap.xml'), sitemap);
  writeAtomic(path.join(distRoot, 'sitemap-index.xml'), sitemapIndex);
  writeAtomic(path.join(distRoot, 'robots.txt'), robots);

  console.log(JSON.stringify({
    qualified: 'website-production-prerender',
    source_sha: sourceSha,
    revision,
    chrome: chromeVersion,
    route_count: routes.length,
    canonical_count: canonicalPages.size,
    sitemap_count: sitemapEntries.length,
    demo_latest_approved: plan.demoIndex.latest_approved_stack_version,
    demo_latest_available: plan.demoIndex.latest_available_stack_version,
    pages: pageReceipts.length,
  }));
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
