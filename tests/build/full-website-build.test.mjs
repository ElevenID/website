import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build, loadConfigFromFile } from 'vite';
import { websiteReleaseMetadata } from '../../ui/scripts/web-surface-build-contract.mjs';
import { demoBrowserBuildSelection } from '../../scripts/lib/demo-browser-qualification.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sourceSha = 'a'.repeat(40);
const commerceSha = 'b'.repeat(40);
const selection = { sourceSha, commerceSha, pages: 'full', revision: `${sourceSha}-${commerceSha}` };

async function put(directory, name, body) {
  const target = path.join(directory, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}
async function fixture(t, { main, adapter } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'website-full-vite-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await put(directory, 'private/src/extension.jsx', 'export const applicationOnly = "application-entry-sentinel";\n');
  // Synthetic adapter with the same disabled route interface. Its source is
  // fixture-owned; no private repository file is copied into this public test.
  await put(directory, 'private/src/website.jsx', adapter
    || 'export const commerceExtensionEnabled = false; export function renderCommerceWebsiteRoutes() { return null; }\n');
  await put(directory, 'private/commerce-source.json', JSON.stringify({ repository: 'ElevenID/marty-subscriptions', source_sha: commerceSha }));
  await put(directory, 'main.js', main
    || 'import { commerceExtensionEnabled, renderCommerceWebsiteRoutes } from "@marty/commerce-extension"; console.log("full-fixture", commerceExtensionEnabled, renderCommerceWebsiteRoutes());\n');
  return directory;
}
async function configFor(directory, patch = {}) {
  const env = { MARTY_WEBSITE_SOURCE_SHA: sourceSha, MARTY_PRODUCTION_PAGES: 'full',
    MARTY_COMMERCE_SOURCE_SHA: commerceSha, MARTY_COMMERCE_EXTENSION_PATH: path.join(directory, 'private/src/extension.jsx'),
    MARTY_WEBSITE_REVISION: undefined, ...patch };
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  try {
    for (const [name, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(root, 'ui/vite.config.mjs'), root, 'silent');
    assert.ok(loaded, 'Actual website Vite configuration must load');
    return loaded.config;
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
}
async function compile(directory, config) {
  return build({ ...config, configFile: false, root: directory, logLevel: 'silent',
    build: { ...config.build, outDir: path.join(directory, 'dist'), emptyOutDir: true, minify: false,
      reportCompressedSize: false, rolldownOptions: { input: path.join(directory, 'main.js') }, rollupOptions: undefined } });
}

test('actual full Vite configuration loads the private website adapter and emits no source maps', async (t) => {
  const directory = await fixture(t);
  const config = await configFor(directory);
  assert.equal(config.resolve.alias['@marty/commerce-extension'], path.join(directory, 'private/src/website.jsx'));
  assert.equal(config.build.sourcemap, false);
  const result = await compile(directory, config);
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
  const chunks = outputs.filter((output) => output.type === 'chunk');
  assert.ok(chunks.some((chunk) => Object.keys(chunk.modules).includes(path.join(directory, 'private/src/website.jsx'))));
  assert.ok(chunks.every((chunk) => !Object.keys(chunk.modules).some((name) => name.endsWith('/src/extension.jsx'))));
  assert.ok(outputs.every((output) => !output.fileName.endsWith('.map')));
  assert.ok(chunks.every((chunk) => !chunk.code.includes('application-entry-sentinel') && !chunk.code.includes('sourceMappingURL')));
  const marker = JSON.parse(await readFile(path.join(directory, 'dist/marty-website-release.json')));
  assert.deepEqual(marker, websiteReleaseMetadata(selection));
});

test('the complete standalone website graph builds with a source-bound disabled private adapter', { timeout: 60000 }, async (t) => {
  const directory = await fixture(t);
  const config = await configFor(directory);
  const outputDirectory = path.join(directory, 'complete-dist');
  const result = await build({ ...config, configFile: false, logLevel: 'silent',
    build: { ...config.build, outDir: outputDirectory, emptyOutDir: true, reportCompressedSize: false } });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
  const chunks = outputs.filter((output) => output.type === 'chunk');
  assert.ok(chunks.some((chunk) => Object.keys(chunk.modules).includes(path.join(directory, 'private/src/website.jsx'))));
  assert.ok(outputs.every((output) => !output.fileName.endsWith('.map')));
  assert.ok(chunks.every((chunk) => !Object.keys(chunk.modules).some((name) => /\/(?:PricingPage|PaymentCheckout)\.[jt]sx?$/.test(name))));
  const marker = JSON.parse(await readFile(path.join(outputDirectory, 'marty-website-release.json')));
  assert.deepEqual(marker, websiteReleaseMetadata(selection));
  assert.match(await readFile(path.join(outputDirectory, 'index.html'), 'utf8'), /type="module"/);
});

test('actual full configuration refuses a public-only graph despite a configured private source', async (t) => {
  const directory = await fixture(t, { main: 'console.log("public-fixture-only");\n' });
  await assert.rejects(compile(directory, await configFor(directory)), /omitted its commerce extension/);
});

for (const [name, relative] of [['pricing', 'data/pricingPlans.js'], ['checkout', 'components/PaymentCheckout.jsx']]) {
  test(`actual full configuration excludes private ${name} from a static or lazy adapter graph`, async (t) => {
    const directory = await fixture(t, { adapter: `export const commerceExtensionEnabled = false; export function renderCommerceWebsiteRoutes() { return import('./${relative}'); }\n` });
    await put(directory, 'private/src/' + relative, 'export const withheld = "private-terms-sentinel";\n');
    await assert.rejects(compile(directory, await configFor(directory)), /forbidden module/);
  });
}

test('private source selection rejects mismatched, symlinked, or absent input before bundling', async (t) => {
  const directory = await fixture(t);
  await assert.rejects(configFor(directory, { MARTY_COMMERCE_SOURCE_SHA: 'c'.repeat(40) }), /identity differs/);
  await assert.rejects(configFor(directory, { MARTY_COMMERCE_SOURCE_SHA: undefined }), /exact public and private sources/);
  await assert.rejects(configFor(directory, { MARTY_COMMERCE_EXTENSION_PATH: undefined }), /exact private commerce source/);
  await assert.rejects(configFor(directory, { MARTY_PRODUCTION_PAGES: 'public' }), /Public website cannot configure/);
  const adapter = path.join(directory, 'private/src/website.jsx');
  await rm(adapter);
  await symlink(path.join(directory, 'private/src/extension.jsx'), adapter);
  await assert.rejects(configFor(directory), /cannot contain symlinks/);
});

test('demo browser selection preserves both full sources and refuses an unbound revision suffix', () => {
  const env = { WEBSITE_DEMO_TEST_SOURCE_SHA: sourceSha, WEBSITE_DEMO_TEST_PAGES: 'full',
    WEBSITE_DEMO_TEST_COMMERCE_SHA: commerceSha, WEBSITE_DEMO_TEST_REVISION: selection.revision };
  assert.deepEqual(demoBrowserBuildSelection(env), selection);
  assert.throws(() => demoBrowserBuildSelection({ ...env, WEBSITE_DEMO_TEST_COMMERCE_SHA: undefined }));
  assert.throws(() => demoBrowserBuildSelection({ ...env, WEBSITE_DEMO_TEST_SOURCE_SHA: undefined }));
  assert.throws(() => demoBrowserBuildSelection({ ...env, WEBSITE_DEMO_TEST_COMMERCE_SHA: 'c'.repeat(40) }));
  assert.throws(() => demoBrowserBuildSelection({ ...env, WEBSITE_DEMO_TEST_PAGES: 'public' }));
  assert.equal(demoBrowserBuildSelection({ WEBSITE_DEMO_TEST_REVISION: sourceSha }).revision, sourceSha);
});
