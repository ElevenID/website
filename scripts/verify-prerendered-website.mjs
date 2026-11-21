import assert from 'node:assert/strict';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { websiteBuildSelection, websiteReleaseMetadata } from '../ui/scripts/web-surface-build-contract.mjs';
import { assertWebsiteRouteCanonical, createWebsitePrerenderPlan } from './website-prerender-plan.mjs';
import { structuredDataImageUrls } from './lib/structured-data-assets.mjs';
import { assertWebsiteSource, writeQualificationReceipt } from './lib/qualification-evidence.mjs';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const dist = realpathSync(path.join(root, 'ui/dist-website'));
const SITE_ORIGIN = 'https://elevenidllc.com';
const selection = websiteBuildSelection();
const { sourceSha, revision } = selection;
assert.match(sourceSha || '', /^[a-f0-9]{40}$/, 'Exact production source SHA is required');
assertWebsiteSource({ root, sourceSha });
const metadata = JSON.parse(readFileSync(path.join(dist, 'marty-website-release.json'), 'utf8'));
assert.deepEqual(metadata, websiteReleaseMetadata(selection), 'Verified metadata differs from selected sources');

function requireRegularFile(filename, label) {
  assert.ok(filename.startsWith(dist + path.sep), label + ' escaped the website output');
  assert.ok(existsSync(filename), label + ' is missing');
  const stat = lstatSync(filename);
  assert.ok(stat.isFile() && !stat.isSymbolicLink(), label + ' must be a regular file');
  assert.ok(realpathSync(filename).startsWith(dist + path.sep), label + ' resolves outside the website output');
  return filename;
}
function outputForRoute(route) {
  return route === '/' ? path.join(dist, 'index.html') : path.resolve(dist, route.slice(1), 'index.html');
}

const plan = await createWebsitePrerenderPlan();
const canonicalUrls = new Set();
const pageTitles = new Set();
for (const route of plan.routes) {
  const filename = requireRegularFile(outputForRoute(route), 'Prerendered route ' + route);
  const html = readFileSync(filename, 'utf8');
  assert.ok(!html.includes('data-website-prerender-instrumentation'), 'Prerender instrumentation leaked into ' + route);
  assert.ok(!html.includes('data-website-rendered'), 'Temporary browser marker leaked into ' + route);
  assert.ok(!/https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\//i.test(html), 'Loopback origin leaked into ' + route);
  const document = new JSDOM(html).window.document;
  assert.ok(document.documentElement.classList.contains('app-ready'), 'Application startup was not completed in ' + route);
  assert.equal(document.querySelector('[data-app-loading], [data-website-error-boundary]'), null,
    'Loading or error fallback remained in the final document on ' + route);
  assert.ok(document.querySelector('meta[name="prerender-status-code"][content="200"]'), 'Prerender status is missing in ' + route);
  const heading = document.querySelector('#root h1, #root h2, #root h3, #root h4, #root h5, #root h6');
  assert.ok(heading && heading.textContent.trim(), 'Prerendered route has no h1: ' + route);
  const title = document.title.trim();
  const description = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim();
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
  assertWebsiteRouteCanonical(plan, route, canonical);
  const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  const twitterImage = document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
  assert.ok(title && description && canonical && ogImage && twitterImage, 'Route SEO metadata is incomplete: ' + route);
  assert.equal(ogImage, twitterImage, 'Social image tags differ: ' + route);
  const canonicalUrl = new URL(canonical);
  assert.equal(canonicalUrl.origin, 'https://elevenidllc.com', 'Canonical origin mismatch: ' + route);
  assert.ok(!/^\/(?:pricing|verify|console|applicant|admin|vendor|dashboard|auth|api|v1)(?:\/|$)/.test(canonicalUrl.pathname),
    'Private or application-owned canonical found: ' + route);
  const ogUrl = new URL(ogImage);
  assert.equal(ogUrl.protocol, 'https:', 'Social image must use HTTPS: ' + route);
  if (ogUrl.origin === 'https://elevenidllc.com') {
    requireRegularFile(path.resolve(dist, '.' + decodeURIComponent(ogUrl.pathname)), 'Social image for ' + route);
  }
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    let data;
    try { data = JSON.parse(script.textContent); } catch { assert.fail('Invalid JSON-LD in ' + route); }
    for (const imageValue of structuredDataImageUrls(data)) {
      const imageUrl = new URL(imageValue, SITE_ORIGIN);
      assert.equal(imageUrl.protocol, 'https:', 'Structured-data image must use HTTPS: ' + route);
      if (imageUrl.origin === SITE_ORIGIN) {
        requireRegularFile(path.resolve(dist, '.' + decodeURIComponent(imageUrl.pathname)),
          'Structured-data image for ' + route);
      }
    }
  }
  if (!/noindex/i.test(document.querySelector('meta[name="robots"]')?.getAttribute('content') || '')) {
    canonicalUrls.add(canonicalUrl.href);
  }
  pageTitles.add(title);
  document.defaultView.close();
}
assert.ok(pageTitles.size > Math.floor(plan.routes.length * 0.65), 'Too many routes share a generic title');

const inventory = JSON.parse(readFileSync(path.join(root, 'docs/input-inventory/asset-inventory.json'), 'utf8'));
const selectedAssets = inventory.files.filter((entry) => inventory.categories[entry.category]?.disposition !== 'exclude');
assert.equal(selectedAssets.length, 46, 'Selected website asset inventory changed unexpectedly');
for (const entry of selectedAssets) {
  const relative = entry.path === 'llms.txt' ? 'llms.txt'
    : entry.path === 'blog/rss.xml' ? 'blog/rss.xml'
      : entry.path === 'runtime-config.js' ? '_website/runtime-config.js'
        : '_website/' + revision + '/' + entry.path;
  requireRegularFile(path.resolve(dist, relative), 'Emitted public asset ' + entry.path);
}

const demoIndexPath = path.join(dist, '_website', revision, 'demos/manifests/index.json');
const emittedDemoIndex = JSON.parse(readFileSync(requireRegularFile(demoIndexPath, 'Versioned demo index'), 'utf8'));
assert.deepEqual(emittedDemoIndex, plan.demoIndex, 'Public demo publication states changed during prerender');
for (const release of plan.demoIndex.releases) {
  const routeFile = outputForRoute('/demos/' + release.stack_version);
  requireRegularFile(routeFile, 'Demo release page ' + release.stack_version);
  if (release.publication_state === 'DRAFT') {
    const html = readFileSync(routeFile, 'utf8').toLowerCase();
    assert.ok(html.includes('publication preview'), 'Draft demo release lost its publication disclaimer');
  }
}
assert.ok(!existsSync(path.join(dist, 'pricing/index.html')), 'Withheld pricing page was generated');
assert.ok(!existsSync(path.join(dist, 'console/index.html')), 'Application console leaked into the website');
assert.ok(!existsSync(path.join(dist, 'applicant/index.html')), 'Applicant application leaked into the website');

const sitemapPath = requireRegularFile(path.join(dist, 'sitemap.xml'), 'Sitemap');
const sitemapDoc = new JSDOM(readFileSync(sitemapPath, 'utf8'), { contentType: 'application/xml' }).window.document;
const sitemapUrls = Array.from(sitemapDoc.querySelectorAll('urlset > url > loc')).map((node) => node.textContent.trim());
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, 'Sitemap contains duplicate canonical URLs');
assert.deepEqual(new Set(sitemapUrls), canonicalUrls, 'Sitemap does not match rendered canonical pages');
assert.ok(!sitemapUrls.some((url) => /\/(?:pricing|verify|console|applicant|admin|vendor|dashboard|auth|api|v1)(?:\/|$)/.test(new URL(url).pathname)),
  'Sitemap contains a withheld or application-owned route');
const indexPath = requireRegularFile(path.join(dist, 'sitemap-index.xml'), 'Sitemap index');
const indexDoc = new JSDOM(readFileSync(indexPath, 'utf8'), { contentType: 'application/xml' }).window.document;
assert.deepEqual(Array.from(indexDoc.querySelectorAll('sitemapindex > sitemap > loc')).map((node) => node.textContent.trim()),
  ['https://elevenidllc.com/sitemap.xml']);
const robots = readFileSync(requireRegularFile(path.join(dist, 'robots.txt'), 'robots.txt'), 'utf8');
assert.match(robots, /User-agent: \*/);
assert.match(robots, /Disallow: \/pricing/);
assert.match(robots, /User-agent: GPTBot[\s\S]*Allow: \//);
assert.match(robots, /User-agent: ChatGPT-User[\s\S]*Allow: \//);
assert.match(robots, /Sitemap: https:\/\/elevenidllc\.com\/sitemap\.xml/);
assert.ok(existsSync(path.join(dist, 'llms.txt')), 'LLMs discovery file is missing');

const result = {
  qualified: 'website-production-prerender-verification',
  source_sha: sourceSha,
  revision,
  routes: plan.routes.length,
  canonical_urls: canonicalUrls.size,
  unique_titles: pageTitles.size,
  public_assets: selectedAssets.length,
  demo_releases: plan.demoIndex.releases.map((release) => ({
    version: release.stack_version, publication: release.publication_state, coverage: release.coverage_state,
  })),
};
writeQualificationReceipt({ root, ...selection, stage: 'output-verification', result });
console.log(JSON.stringify(result));
