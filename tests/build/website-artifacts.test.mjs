import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { assertWebsiteDist } from '../../ui/scripts/assert-website-dist.mjs';
import { fixtureSourceSha, fixtureCommerceSha, fixtureHtml, putFixtureFile,
  writeWebsiteFixture } from '../fixtures/website-release-fixture.mjs';

const script = fileURLToPath(new URL('../../ui/scripts/assert-website-dist.mjs', import.meta.url));
async function fixture(t, options) {
  const root = await mkdtemp(path.join(tmpdir(), 'website-artifacts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, ...await writeWebsiteFixture(root, options) };
}
const verify = (root, options = {}) => assertWebsiteDist(root, { sourceSha: fixtureSourceSha, ...options });

test('website artifact validation binds expected source identity and real crawler validation', async (t) => {
  const { root } = await fixture(t);
  assert.deepEqual(verify(root), { documents: 5, revision: fixtureSourceSha, sourceSha: fixtureSourceSha });
  assert.throws(() => assertWebsiteDist(root), /expected website source/);
  assert.throws(() => verify(root, { sourceSha: 'c'.repeat(40) }), /revision differs/);
});

for (const [name, change] of [
  ['repository', (value) => { value.repository = 'ElevenID/marty-ui'; }],
  ['audience', (value) => { value.audience = 'development'; }],
  ['surface', (value) => { value.surface = 'application'; }],
  ['schema', (value) => { value.schema = 'marty.website-image/v2'; }],
  ['route ownership', (value) => { value.route_contract.sha256 = `sha256:${'0'.repeat(64)}`; }],
  ['unclaimed commerce', (value) => { value.commerce_extension = { repository: 'other', source_sha: fixtureCommerceSha }; }],
  ['unknown metadata', (value) => { value.unreviewed = true; }],
]) {
  test(`website artifacts reject changed ${name}`, async (t) => {
    const { root } = await fixture(t);
    const metadata = JSON.parse(await readFile(path.join(root, 'marty-website-release.json'), 'utf8'));
    change(metadata);
    await putFixtureFile(root, 'marty-website-release.json', JSON.stringify(metadata));
    assert.throws(() => verify(root), /release metadata differs/);
  });
}

test('development artifacts require an explicit development validation mode', async (t) => {
  const { root } = await fixture(t, { sourceSha: 'development' });
  assert.throws(() => assertWebsiteDist(root, { sourceSha: 'development' }), /expected website source/);
  assert.equal(assertWebsiteDist(root, { allowDevelopment: true }).revision, 'development');
});

test('full website artifacts bind both expected source identities and commerce repository', async (t) => {
  const { root } = await fixture(t, { pages: 'full', commerceSha: fixtureCommerceSha });
  assert.equal(verify(root, { commerceSha: fixtureCommerceSha }).revision, `${fixtureSourceSha}-${fixtureCommerceSha}`);
  assert.throws(() => verify(root), /exact public and private/);
  assert.throws(() => verify(root, { commerceSha: 'c'.repeat(40) }), /revision differs/);
  const metadata = JSON.parse(await readFile(path.join(root, 'marty-website-release.json'), 'utf8'));
  metadata.commerce_extension.repository = 'other/commerce';
  await putFixtureFile(root, 'marty-website-release.json', JSON.stringify(metadata));
  assert.throws(() => verify(root, { commerceSha: fixtureCommerceSha }), /release metadata differs/);
});

test('application and fallback prerenders cannot enter the website artifact', async (t) => {
  for (const route of ['console', 'pricing', 'login', 'auth', 'api', 'v1', 'docs', 'unowned']) {
    const { root } = await fixture(t);
    await putFixtureFile(root, `${route}/index.html`, fixtureHtml('Unowned', fixtureSourceSha));
    assert.throws(() => verify(root), /application artifact|unowned prerendered route/, route);
  }
});

test('stack release identity cannot enter the website artifact', async (t) => {
  const { root } = await fixture(t);
  await putFixtureFile(root, 'marty-ui-release.json', '{}');
  assert.throws(() => verify(root), /stack identity/);
});

for (const [name, reference] of [
  ['parent path', `/_website/${fixtureSourceSha}/../../sentinel.txt`],
  ['encoded parent path', `/_website/${fixtureSourceSha}/%2e%2e/%2e%2e/sentinel.txt`],
  ['encoded separator', `/_website/${fixtureSourceSha}/assets%2fsite.js`],
  ['encoded backslash', `/_website/${fixtureSourceSha}/assets%5csite.js`],
  ['stale namespace', '/_website/cccccccccccccccccccccccccccccccccccccccc/assets/site.js'],
  ['encoded namespace', '/%5fwebsite/cccccccccccccccccccccccccccccccccccccccc/assets/site.js'],
  ['relative namespace traversal', `./_website/${fixtureSourceSha}/../../sentinel.txt`],
  ['parent-relative namespace traversal', `../_website/${fixtureSourceSha}/../../sentinel.txt`],
]) {
  test(`artifact references reject ${name}`, async (t) => {
    const { root } = await fixture(t);
    await putFixtureFile(root, 'sentinel.txt', 'not a versioned asset');
    await putFixtureFile(root, '_website/cccccccccccccccccccccccccccccccccccccccc/assets/site.js', 'stale');
    await putFixtureFile(root, 'product/index.html', `${fixtureHtml('Product', fixtureSourceSha)}<script SRC = "${reference}"></script>`);
    assert.throws(() => verify(root), /resource path|asset namespace/, reference);
  });
}

test('HTML attribute casing, whitespace, entities and unquoted URLs receive resource checks', async (t) => {
  for (const markup of [
    '<link HREF = "/assets/root.css" rel="stylesheet">',
    '<script SRC=/_website/missing/assets/site.js></script>',
    '<script src="&#47;_website/missing/assets/site.js"></script>',
    '<script title="x > y" src = "/_website/missing/assets/site.js"></script>',
  ]) {
    const { root } = await fixture(t);
    await putFixtureFile(root, 'product/index.html', `${fixtureHtml('Product', fixtureSourceSha)}${markup}`);
    assert.throws(() => verify(root), /namespace/, markup);
  }
});

test('namespaced references must resolve to existing regular files', async (t) => {
  const { root } = await fixture(t);
  await rm(path.join(root, `_website/${fixtureSourceSha}/assets/site.css`));
  assert.throws(() => verify(root), /ENOENT/);
});

test('artifact file and directory symlinks are rejected', async (t) => {
  for (const kind of ['file', 'directory']) {
    const { root } = await fixture(t);
    await symlink(kind === 'file' ? 'index.html' : 'product', path.join(root, `linked-${kind}`));
    assert.throws(() => verify(root), /symlink/);
  }
});

test('all pages reject normalized loopback URLs', async (t) => {
  for (const origin of ['http://127.1', 'http://127.0.0.2', 'http://localhost.', 'http://[::1]']) {
    const { root } = await fixture(t);
    await putFixtureFile(root, 'product/index.html', `${fixtureHtml('Product', fixtureSourceSha)}<img SRC = "${origin}/image.png">`);
    assert.throws(() => verify(root), /loopback URL/, origin);
  }
});

test('encoded and unquoted local pricing links are rejected', async (t) => {
  for (const markup of ['<a HREF = /pricing>Plans</a>', '<a href="/%70ricing/checkout">Plans</a>']) {
    const { root } = await fixture(t);
    await putFixtureFile(root, 'product/index.html', `${fixtureHtml('Product', fixtureSourceSha)}${markup}`);
    assert.throws(() => verify(root), /pricing link/);
  }
});

test('homepage markers must be real parsed elements and the product must be prerendered', async (t) => {
  const { root } = await fixture(t);
  const homepage = await readFile(path.join(root, 'index.html'), 'utf8');
  await putFixtureFile(root, 'index.html', `<!-- ${homepage} --><p>Not prerendered</p>`);
  assert.throws(() => verify(root), /homepage must be prerendered/);
  await putFixtureFile(root, 'index.html', homepage);
  await rm(path.join(root, 'product/index.html'));
  assert.throws(() => verify(root), /homepage and product/);
});

test('artifact checks reuse the qualified crawler validator and reject a bad sitemap', async (t) => {
  const { root } = await fixture(t);
  await putFixtureFile(root, 'sitemap.xml', '<urlset/>');
  assert.throws(() => verify(root), /crawler artifacts failed/);
});

test('artifact CLI validates explicit source inputs and rejects unknown arguments', async (t) => {
  const { root } = await fixture(t);
  const ok = spawnSync(process.execPath, [script, root, '--source-sha', fixtureSourceSha], { encoding: 'utf8', timeout: 30000 });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /Website artifacts verified: 5 HTML documents/);
  const bad = spawnSync(process.execPath, [script, root, '--skip-validation'], { encoding: 'utf8', timeout: 30000 });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /Unknown or repeated argument/);
});
