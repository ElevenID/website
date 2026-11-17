import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { repositoryRoot, writeInput } from '../fixtures/website-input-fixture.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'website runtime '));
  t.after(() => rm(root, { recursive: true, force: true }));
  const html = '<!doctype html><html><head><title>Runtime fixture</title></head><body><h1>Fixture</h1></body></html>\n';
  await writeInput(root, 'public/index.html', html);
  await writeInput(root, 'public/article with spaces/index.html', html);
  await writeInput(root, 'public/newline\nroute/index.html', html);
  return { root, public: path.join(root, 'public'), runtime: path.join(root, 'public/_website/runtime-config.js') };
}

function startup(f, values = {}) {
  return spawnSync('sh', [path.join(repositoryRoot, 'scripts/ui-production-start.sh')], {
    cwd: f.root, encoding: 'utf8', timeout: 15_000, maxBuffer: 64 * 1024,
    env: { ...process.env, MARTY_WEBSITE_HTML_ROOT: f.public, MARTY_UI_RUNTIME_CONFIG_PATH: '',
      GOOGLE_ANALYTICS_MEASUREMENT_ID: '', GOOGLE_SITE_VERIFICATION: '', ORGANIZATION_CREATION_ENABLED: 'false',
      DATABASE_PASSWORD: 'private-fixture-value', STRIPE_SECRET_KEY: 'private-fixture-billing', ...values },
  });
}

const success = (result) => assert.equal(result.status, 0, result.stderr);
const failure = (result, pattern) => { assert.notEqual(result.status, 0); assert.match(result.stderr, pattern); };
async function settings(f) {
  const text = await readFile(f.runtime, 'utf8');
  const context = { window: { __MARTY_RUNTIME_CONFIG__: { hosting: { externalUrl: 'https://website.example.test' } } } };
  vm.runInNewContext(text, context, { timeout: 1000 });
  return { text, value: JSON.parse(JSON.stringify(context.window.__MARTY_RUNTIME_CONFIG__)) };
}
function verification(html) {
  const dom = new JSDOM(html);
  try { return [...dom.window.document.querySelectorAll('meta[name="google-site-verification"]')].map((node) => node.content); }
  finally { dom.window.close(); }
}

test('website startup writes only explicit public defaults in its owned namespace', async (t) => {
  const f = await fixture(t);
  success(startup(f));
  const result = await settings(f);
  assert.deepEqual(result.value, { hosting: { externalUrl: 'https://website.example.test' }, googleAnalyticsMeasurementId: '', organizationCreationEnabled: false });
  assert.doesNotMatch(result.text, /private-fixture|DATABASE|STRIPE/);
  await assert.rejects(readFile(path.join(f.public, 'runtime-config.js')), { code: 'ENOENT' });
  assert.deepEqual(await readdir(path.dirname(f.runtime)), ['runtime-config.js']);
});

test('website startup applies public analytics and registration settings while preserving existing hosting configuration', async (t) => {
  const f = await fixture(t);
  success(startup(f, { GOOGLE_ANALYTICS_MEASUREMENT_ID: 'G-ABC0123', ORGANIZATION_CREATION_ENABLED: 'true' }));
  assert.deepEqual((await settings(f)).value, { hosting: { externalUrl: 'https://website.example.test' }, googleAnalyticsMeasurementId: 'G-ABC0123', organizationCreationEnabled: true });
});

test('website startup escapes verification attributes in every generated head and preserves filenames', async (t) => {
  const f = await fixture(t);
  const value = `quotes: "' & <tag> | ~ backslash\\ &amp;`;
  success(startup(f, { GOOGLE_SITE_VERIFICATION: value }));
  for (const name of ['index.html', 'article with spaces/index.html', 'newline\nroute/index.html']) {
    const html = await readFile(path.join(f.public, name), 'utf8');
    assert.deepEqual(verification(html), [value]);
    assert.match(html, /<h1>Fixture<\/h1>/);
    assert.doesNotMatch(html, /<tag>/);
  }
});

test('website restart replaces mixed-case and single-quoted verification metadata without duplicates', async (t) => {
  const f = await fixture(t);
  const html = `<!doctype html><html><HEAD><META NAME='google-site-verification' CONTENT='old'>
<meta content="other" name="google-site-verification"><meta name=google-site-verification>
<meta data-name="google-site-verification" content="preserve this"><title>Keep title</title></HEAD><body>Keep body</body></html>`;
  await writeFile(path.join(f.public, 'index.html'), html);
  success(startup(f, { GOOGLE_SITE_VERIFICATION: 'first' }));
  success(startup(f, { GOOGLE_SITE_VERIFICATION: 'second' }));
  const result = await readFile(path.join(f.public, 'index.html'), 'utf8');
  assert.deepEqual(verification(result), ['second']);
  assert.match(result, /Keep title/);
  assert.match(result, /Keep body/);
  assert.match(result, /data-name="google-site-verification" content="preserve this"/);
});

test('website restart with explicit empty settings removes old verification and analytics values', async (t) => {
  const f = await fixture(t);
  success(startup(f, { GOOGLE_SITE_VERIFICATION: 'first', GOOGLE_ANALYTICS_MEASUREMENT_ID: 'G-ABC', ORGANIZATION_CREATION_ENABLED: 'true' }));
  success(startup(f));
  assert.deepEqual(verification(await readFile(path.join(f.public, 'index.html'), 'utf8')), []);
  assert.deepEqual((await settings(f)).value, { hosting: { externalUrl: 'https://website.example.test' }, googleAnalyticsMeasurementId: '', organizationCreationEnabled: false });
});

for (const [label, values, pattern] of [
  ['analytics injection', { GOOGLE_ANALYTICS_MEASUREMENT_ID: "G-ABC';alert(1)//" }, /GA4 measurement/],
  ['analytics lowercase', { GOOGLE_ANALYTICS_MEASUREMENT_ID: 'g-abc' }, /GA4 measurement/],
  ['line feed', { GOOGLE_SITE_VERIFICATION: 'value\nother' }, /single-line/],
  ['carriage return', { GOOGLE_SITE_VERIFICATION: 'value\rother' }, /control characters/],
  ['tab', { GOOGLE_SITE_VERIFICATION: 'value\tother' }, /control characters/],
  ['oversize verification', { GOOGLE_SITE_VERIFICATION: 'a'.repeat(2049) }, /too long/],
  ['nonboolean registration', { ORGANIZATION_CREATION_ENABLED: '1' }, /true or false/],
]) {
  test(`website startup rejects ${label} before changing any artifact`, async (t) => {
    const f = await fixture(t);
    const before = await readFile(path.join(f.public, 'index.html'), 'utf8');
    await writeInput(f.root, 'public/_website/runtime-config.js', '// retained\n');
    failure(startup(f, values), pattern);
    assert.equal(await readFile(f.runtime, 'utf8'), '// retained\n');
    assert.equal(await readFile(path.join(f.public, 'index.html'), 'utf8'), before);
  });
}

test('website startup refuses a runtime destination outside its owned namespace', async (t) => {
  const f = await fixture(t);
  const outside = await writeInput(f.root, 'outside.js', '// untouched\n');
  failure(startup(f, { MARTY_UI_RUNTIME_CONFIG_PATH: outside }), /must use \/_website\/runtime-config/);
  assert.equal(await readFile(outside, 'utf8'), '// untouched\n');
});

test('website startup rejects a symlinked resource namespace before writing', async (t) => {
  const f = await fixture(t);
  await mkdir(path.join(f.root, 'outside'));
  await symlink(path.join(f.root, 'outside'), path.join(f.public, '_website'), 'dir');
  failure(startup(f), /symlinks/);
  assert.deepEqual(await readdir(path.join(f.root, 'outside')), []);
});

test('website startup rejects an existing symlinked runtime configuration', async (t) => {
  const f = await fixture(t);
  await mkdir(path.dirname(f.runtime));
  const outside = await writeInput(f.root, 'outside.js', '// untouched\n');
  await symlink(outside, f.runtime);
  failure(startup(f), /symlinks/);
  assert.equal(await readFile(outside, 'utf8'), '// untouched\n');
});

test('website startup rejects a symlinked HTML root', async (t) => {
  const f = await fixture(t);
  const link = path.join(f.root, 'linked');
  await symlink(f.public, link, 'dir');
  failure(startup(f, { MARTY_WEBSITE_HTML_ROOT: link }), /real directory without symlinks/);
  await assert.rejects(readFile(f.runtime), { code: 'ENOENT' });
});

test('website startup does not follow HTML file or directory symlinks', async (t) => {
  const f = await fixture(t);
  const html = '<head><title>Outside</title></head>';
  const outside = await writeInput(f.root, 'outside/index.html', html);
  await symlink(outside, path.join(f.public, 'linked.html'));
  await symlink(path.dirname(outside), path.join(f.public, 'linked-directory'), 'dir');
  success(startup(f, { GOOGLE_SITE_VERIFICATION: 'inside-only' }));
  assert.equal(await readFile(outside, 'utf8'), html);
  assert.deepEqual(verification(await readFile(path.join(f.public, 'index.html'), 'utf8')), ['inside-only']);
});

test('website startup rejects a directory in place of its runtime file before HTML changes', async (t) => {
  const f = await fixture(t);
  await mkdir(f.runtime, { recursive: true });
  const before = await readFile(path.join(f.public, 'index.html'), 'utf8');
  failure(startup(f, { GOOGLE_SITE_VERIFICATION: 'must-not-appear' }), /target must be a regular file/);
  assert.deepEqual(await readdir(f.runtime), []);
  assert.equal(await readFile(path.join(f.public, 'index.html'), 'utf8'), before);
});
