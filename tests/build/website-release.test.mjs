import '../../ui/scripts/web-surface-build-contract.test.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { build } from 'vite';
import { webSurfaceBuildContractPlugin } from '../../ui/scripts/web-surface-build-contract.mjs';
import { productionBuildContract, productionBuildContractPlugin } from '../../ui/scripts/production-build-contract.mjs';
import { renderWebsiteNginx } from '../../ui/scripts/render-website-nginx.mjs';
import { WEB_ROUTE_CONTRACT } from '../../ui/scripts/web-surface-contract.mjs';
import { fixtureSourceSha, fixtureCommerceSha, putFixtureFile } from '../fixtures/website-release-fixture.mjs';

async function fixture(t, modules) {
  const root = await mkdtemp(path.join(tmpdir(), 'website-release-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(modules)) await putFixtureFile(root, name, content);
  return root;
}
async function compile(root, options = {}, additionalPlugins = []) {
  return build({
    configFile: false, root, publicDir: false, logLevel: 'silent',
    plugins: [webSurfaceBuildContractPlugin({ sourceSha: fixtureSourceSha, ...options }), ...additionalPlugins],
    build: { outDir: path.join(root, 'dist'), emptyOutDir: true, minify: false,
      sourcemap: false, reportCompressedSize: false, rolldownOptions: { input: path.join(root, 'main.js') } },
  });
}

test('real Vite static and lazy public output emits website release identity', async (t) => {
  const root = await fixture(t, {
    'main.js': 'import { title } from "./src/apps/website/page.js"; console.log(title); import("./src/shared/lazy.js").then(console.log);',
    'src/apps/website/page.js': 'export const title = "website-static-fixture";',
    'src/shared/lazy.js': 'export const label = "website-lazy-fixture";',
  });
  const result = await compile(root);
  const chunks = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output).filter((item) => item.type === 'chunk');
  assert.ok(chunks.some((chunk) => chunk.code.includes('website-static-fixture')));
  assert.ok(chunks.some((chunk) => chunk.code.includes('website-lazy-fixture')));
  assert.ok(chunks.some((chunk) => chunk.dynamicImports.length > 0));
  const metadata = JSON.parse(await readFile(path.join(root, 'dist/marty-website-release.json'), 'utf8'));
  assert.deepEqual(metadata, {
    schema: 'marty.website-image/v1', audience: 'production', surface: 'website', repository: 'ElevenID/website',
    source_sha: fixtureSourceSha, revision: fixtureSourceSha, production_pages: 'public',
    route_contract: WEB_ROUTE_CONTRACT, commerce_extension: null,
  });
  for (const chunk of chunks) assert.equal(await readFile(path.join(root, 'dist', chunk.fileName), 'utf8'), chunk.code);
});

for (const kind of ['static', 'lazy']) {
  test(`real Vite ${kind} application imports fail the website build contract`, async (t) => {
    const root = await fixture(t, {
      'main.js': kind === 'static' ? 'import { token } from "./src/services/api.js"; console.log(token);'
        : 'import("./src/services/api.js").then(({ token }) => console.log(token));',
      'src/services/api.js': 'export const token = "application-only-fixture";',
    });
    await assert.rejects(compile(root), /forbidden module.*services\/api\.js/s);
  });
}

test('real Vite output cannot deliver withheld pricing from an unconfigured source', async (t) => {
  const root = await fixture(t, {
    'main.js': 'import("./private/src/data/pricingPlans.js").then(console.log);',
    'private/src/data/pricingPlans.js': 'export const plans = "withheld-price-fixture";',
  });
  await assert.rejects(compile(root), /forbidden module.*pricingPlans\.js/s);
});

for (const imported of [true, false]) {
  test(`real Vite full release ${imported ? 'binds its retained adapter and both source identities' : 'rejects an omitted declared adapter'}`, async (t) => {
    const root = await fixture(t, {
      'main.js': imported ? 'import("./private/src/website.jsx").then(console.log);' : 'console.log("public-only-fixture");',
      'private/src/extension.jsx': 'export const commerceExtensionEnabled = true;',
      'private/src/website.jsx': 'export const commerceExtensionEnabled = "retained-adapter-fixture";',
      'private/commerce-source.json': JSON.stringify({ repository: 'ElevenID/marty-subscriptions', source_sha: fixtureCommerceSha }),
    });
    const entry = productionBuildContract({ pages: 'full', surface: 'website',
      extensionPath: path.join(root, 'private/src/extension.jsx'), sourceSha: fixtureCommerceSha });
    const operation = () => compile(root, { pages: 'full', commerceSha: fixtureCommerceSha, commerceEntry: entry }, [productionBuildContractPlugin(entry)]);
    if (!imported) {
      await assert.rejects(operation(), /omitted its commerce extension/);
      return;
    }
    await operation();
    const metadata = JSON.parse(await readFile(path.join(root, 'dist/marty-website-release.json'), 'utf8'));
    assert.equal(metadata.repository, 'ElevenID/website');
    assert.equal(metadata.revision, `${fixtureSourceSha}-${fixtureCommerceSha}`);
    assert.deepEqual(metadata.commerce_extension, { repository: 'ElevenID/marty-subscriptions', source_sha: fixtureCommerceSha });
  });
}

test('Nginx rendering rejects arbitrary revision text before configuration generation', () => {
  for (const revision of ['"; return 200;', '', '../source', 'unknown', null, [fixtureSourceSha]]) {
    assert.throws(() => renderWebsiteNginx(revision), /Invalid website asset revision/);
  }
  assert.ok(renderWebsiteNginx(fixtureSourceSha).includes(`set $marty_website_revision "${fixtureSourceSha}";`));
});
