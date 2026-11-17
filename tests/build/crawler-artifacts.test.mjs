import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const checker = path.join(repositoryRoot, 'ui/scripts/check_crawler_artifacts.py');
const originalSuite = path.join(repositoryRoot, 'ui/scripts/test_crawler_artifacts.py');
const origin = 'https://elevenidllc.com';
const namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const url = (value) => value.startsWith('/') ? origin + value : value;
const sitemap = (...paths) => `<urlset xmlns="${namespace}">${paths.map((value) => `<url><loc>${escapeXml(url(value))}</loc></url>`).join('')}</urlset>`;
const index = (...names) => `<sitemapindex xmlns="${namespace}">${names.map((name) => `<sitemap><loc>${origin}/${name}</loc></sitemap>`).join('')}</sitemapindex>`;
const robots = `User-agent: *\nDisallow: /console\nDisallow: /auth/*\nDisallow: /api/*\nDisallow: /v1/*\nSitemap: ${origin}/sitemap.xml\n`;

function fixture(t, files = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'website-crawler-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, content] of Object.entries({ 'robots.txt': robots, 'sitemap.xml': sitemap('/', '/product'), ...files })) {
    writeFileSync(path.join(root, name), content);
  }
  return root;
}

function run(root, script = checker, args = [root, path.join(root, 'urls.txt')]) {
  const result = spawnSync('python3', [script, ...args], {
    cwd: root, encoding: 'utf8', timeout: 10000, maxBuffer: 16384,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  return result;
}

function rejects(t, files, expected) {
  const root = fixture(t, files);
  const result = run(root);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, expected);
}

test('the preserved Python crawler suite passes all five fixture cases', (t) => {
  const root = fixture(t);
  const result = run(root, originalSuite, []);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Ran 5 tests/);
  assert.match(result.stderr, /\bOK\b/);
  t.diagnostic('The one Node wrapper also executes five Python unittest cases.');
});

test('website crawler CLI accepts its required pages without application-owned docs', (t) => {
  const root = fixture(t);
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 nonempty sitemap artifact\(s\), 2 unique canonical public URL\(s\)/);
  assert.equal(readFileSync(path.join(root, 'urls.txt'), 'utf8'), '/\n/product\n');
});

test('website crawler CLI accepts owned nested routes and numeric demo releases', (t) => {
  const paths = ['/', '/product', '/developers', '/blog/identity', '/blog/release.notes', '/authors/jane.smith', '/demos/2026.07.0'];
  const root = fixture(t, { 'sitemap.xml': sitemap(...paths) });
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(path.join(root, 'urls.txt'), 'utf8'), paths.sort().join('\n') + '\n');
});

test('website crawler CLI accepts existing index references and unique page shards', (t) => {
  const root = fixture(t, {
    'sitemap.xml': index('sitemap-pages.xml', 'sitemap-blog.xml'),
    'sitemap-pages.xml': sitemap('/', '/product', '/developers'),
    'sitemap-blog.xml': sitemap('/blog/identity', '/authors/alex'),
  });
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /3 nonempty sitemap artifact\(s\), 5 unique canonical public URL\(s\)/);
});

test('website sitemap rejects application routes, unknown paths and withheld pricing', (t) => {
  for (const invalid of ['/docs', '/docs/api', '/login', '/verify', '/console/settings', '/unowned', '/pricing', '/pricing/plans']) {
    rejects(t, { 'sitemap.xml': sitemap('/', '/product', invalid) }, /exposes private URL/);
  }
});

test('website sitemap rejects resource namespaces and static resource URLs', (t) => {
  for (const invalid of ['/_website/development/assets/site.js', '/robots.txt', '/sitemap.xml', '/llms.txt', '/blog/logo.png', '/blog/logo%2Ejson', '/demos/recording.mp4']) {
    rejects(t, { 'sitemap.xml': sitemap('/', '/product', invalid) }, /exposes private URL/);
  }
});

test('website sitemap rejects canonical aliases and forbidden URL components', (t) => {
  for (const invalid of [
    'http://elevenidllc.com/product', 'https://www.elevenidllc.com/product',
    'https://elevenidllc.com:443/product', 'https://user@elevenidllc.com/product',
    '/product?preview=1', '/product#section', '/product/',
    '/blog/raw space',
  ]) rejects(t, { 'sitemap.xml': sitemap('/', '/product', invalid) }, /noncanonical|forbidden components/);
});

test('website sitemap rejects traversal and encoded path-normalization aliases', (t) => {
  for (const invalid of ['/blog/../docs', '/blog/%2e%2e/docs', '/blog//entry', '/blog/%2fentry', '/blog/%5centry', '/blog/%0aentry', '/blog/%zz']) {
    rejects(t, { 'sitemap.xml': sitemap('/', '/product', invalid) }, /noncanonical path/);
  }
});

test('website crawler rejects duplicate URLs across sitemap shards', (t) => {
  rejects(t, { 'sitemap-pages.xml': sitemap('/product') }, /duplicate sitemap location/);
});

test('website crawler rejects an index pointing to an absent artifact', (t) => {
  rejects(t, { 'sitemap-index.xml': index('sitemap-missing.xml') }, /index references missing artifact/);
});

test('website crawler rejects self-referencing and mutually cyclic sitemap indexes', (t) => {
  rejects(t, {
    'sitemap.xml': index('sitemap.xml'),
    'sitemap-pages.xml': sitemap('/', '/product'),
  }, /cyclic sitemap index reference/);
  rejects(t, {
    'sitemap.xml': index('sitemap-other.xml'),
    'sitemap-other.xml': index('sitemap.xml'),
    'sitemap-pages.xml': sitemap('/', '/product'),
  }, /cyclic sitemap index reference/);
});

test('website crawler rejects page shards that the robots sitemap cannot reach', (t) => {
  rejects(t, { 'sitemap-pages.xml': sitemap('/developers') }, /unreachable page sitemap artifact/);
});

test('website crawler permits a redundant index pointing at the root page sitemap', (t) => {
  const root = fixture(t, { 'sitemap-index.xml': index('sitemap.xml') });
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 nonempty sitemap artifact\(s\), 2 unique canonical public URL\(s\)/);
});

test('website crawler requires direct url or sitemap entries with one scalar location', (t) => {
  for (const entries of [
    `<wrong><loc>${origin}/</loc></wrong>`,
    `<url><loc>${origin}/</loc><loc>${origin}/product</loc></url>`,
    '<url><loc> </loc></url>',
    `<url><loc>${origin}/<nested>product</nested></loc></url>`,
  ]) rejects(t, { 'sitemap.xml': `<urlset xmlns="${namespace}">${entries}</urlset>` }, /unsupported sitemap entry|exactly one nonempty location/);
});

test('website crawler rejects malformed, empty and foreign-namespace sitemap documents', (t) => {
  for (const content of ['', '<urlset>', '<urlset><url><loc>https://elevenidllc.com/</loc></url></urlset>']) {
    rejects(t, { 'sitemap.xml': content }, /empty|invalid XML|unsupported root element/);
  }
});

test('website crawler requires one canonical robots sitemap declaration and private crawl rules', (t) => {
  rejects(t, { 'robots.txt': robots.replace('Disallow: /v1/*\n', '') }, /missing private crawl rules/);
  rejects(t, { 'robots.txt': robots + `Sitemap: ${origin}/sitemap.xml\n` }, /must contain exactly/);
  rejects(t, { 'robots.txt': robots.replace(origin, 'https://beta.elevenidllc.com') }, /must contain exactly/);
});

test('website crawler still requires the homepage and product page', (t) => {
  for (const paths of [['/product'], ['/']]) {
    rejects(t, { 'sitemap.xml': sitemap(...paths) }, /does not contain required public URL/);
  }
});
