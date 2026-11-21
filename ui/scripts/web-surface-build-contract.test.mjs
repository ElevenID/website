import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WEB_ROUTE_CONTRACT } from './web-surface-contract.mjs';
import { forbiddenWebSurfaceModule, websiteBuildRevision, websiteReleaseMetadata,
  webSurfaceBuildContractPlugin } from './web-surface-build-contract.mjs';

const sourceSha = 'a'.repeat(40);
const commerceSha = 'b'.repeat(40);
const commerceEntry = '/private/src/website.jsx';

test('website revisions bind exact public and optional commerce source identities', () => {
  assert.equal(websiteBuildRevision({ sourceSha }), sourceSha);
  assert.equal(websiteBuildRevision({ sourceSha, commerceSha, pages: 'full' }), `${sourceSha}-${commerceSha}`);
  assert.equal(websiteBuildRevision({ sourceSha, revision: sourceSha }), sourceSha);
});

test('website revision inputs reject coercion, missing identities and independent labels', () => {
  for (const options of [
    { sourceSha: '../unsafe' }, { sourceSha: 'unknown' }, { sourceSha: sourceSha.toUpperCase() },
    { sourceSha: [sourceSha] }, { sourceSha: { toString: () => sourceSha } },
    { sourceSha: null }, { sourceSha: 1 }, { sourceSha, revision: '' },
    { sourceSha, revision: null }, { sourceSha, revision: [sourceSha] },
    { sourceSha, revision: 'next' }, { sourceSha, pages: 'unknown' },
    { sourceSha, pages: 'full' }, { sourceSha, pages: 'full', commerceSha: [commerceSha] },
    { sourceSha: 'development', commerceSha, pages: 'full' },
    { sourceSha, commerceSha }, { sourceSha, commerceSha: '' }, { sourceSha, commerceSha: null },
  ]) assert.throws(() => websiteBuildRevision(options), undefined, JSON.stringify(options));
});

test('development metadata is explicitly labelled and cannot claim a production source', () => {
  assert.equal(websiteBuildRevision(), 'development');
  const metadata = websiteReleaseMetadata();
  assert.equal(metadata.audience, 'development');
  assert.equal(metadata.source_sha, 'development');
  assert.equal(metadata.revision, 'development');
  assert.equal(metadata.commerce_extension, null);
});

test('this extracted repository rejects application, combined and unknown surfaces', () => {
  for (const surface of ['application', 'combined', '', 'unknown', null, ['website']]) {
    assert.throws(() => webSurfaceBuildContractPlugin({ surface }), /only builds the website/);
    assert.throws(() => forbiddenWebSurfaceModule(surface, '/repo/ui/src/website.jsx'), /only builds the website/);
  }
});

test('website module checks reject application code, private checkout and withheld pricing', () => {
  for (const id of [
    '/repo/node_modules/@elevenid/marty-api-core/index.js',
    '/repo/ui/src/apps/public/PublicApp.jsx', '/repo/ui/src/apps/console/ConsoleApp.tsx',
    '/repo/ui/src/bootstrapApp.jsx', '/repo/ui/src/hooks/useAuth.js',
    '/repo/ui/src/services/api.js', '/repo/ui/src/services/api/client.ts',
    '/repo/ui/src/services/authApi.js', '/repo/ui/src/contexts/AuthContext.jsx',
    '/repo/ui/src/contexts/ConsoleContext.jsx', '/repo/ui/src/contexts/NotificationContext.jsx',
    '/private/src/contexts/PaymentContext.jsx', '/private/src/application.jsx',
    '/private/src/extension.jsx', '/private/src/index.js',
    '/private/src/components/billing/SubscriptionCheckout.jsx',
    '/private/src/components/PaymentCheckout.tsx', '/private/src/application/checkout.js',
    '/private/src/components/PricingPage.jsx', '/private/src/data/pricingPageContent.js',
    '/private/src/data/pricingContent.ts', '/private/src/data/pricingPlans.js',
    '/repo/ui/src/components/PricingPage.jsx',
  ]) {
    assert.equal(forbiddenWebSurfaceModule('website', id, commerceEntry), true, id);
    assert.equal(forbiddenWebSurfaceModule('website', `${id}?v=1`, `${commerceEntry}?v=1`), true, id);
    assert.equal(forbiddenWebSurfaceModule('website', id.replaceAll('/', '\\'), commerceEntry.replaceAll('/', '\\')), true, id);
  }
  assert.throws(() => forbiddenWebSurfaceModule('website', null), /string/);
});

test('website module checks retain public pages and shared dependencies without prefix collisions', () => {
  for (const id of [
    '/repo/ui/src/apps/website/WebsiteApp.jsx', '/repo/ui/src/components/LandingPageContent.jsx',
    '/repo/ui/src/contexts/BrandingContext.jsx', '/repo/ui/src/extensions/commerce/publicStub.jsx',
    '/repo/node_modules/@elevenid/marty-blog/index.js', '/repo/node_modules/react/index.js',
    '/private/src/website.jsx', '/private/src/components/PublicInformation.jsx',
    '/private/src-neighbor/contexts/ExampleContext.jsx',
  ]) assert.equal(forbiddenWebSurfaceModule('website', id, commerceEntry), false, id);
});

test('commerce configuration is explicit, normalized and confined to a full website build', () => {
  assert.throws(() => webSurfaceBuildContractPlugin({ sourceSha, commerceEntry }), /Public website/);
  assert.throws(() => webSurfaceBuildContractPlugin({ sourceSha, commerceSha, pages: 'full' }), /commerce entry/);
  for (const entry of [null, 1, {}, 'private/website.jsx', '/private/src/application.jsx',
    '/private/src/../src/website.jsx', '/private//src/website.jsx', '/private/with\ncontrol/website.jsx']) {
    assert.throws(() => webSurfaceBuildContractPlugin({ sourceSha, commerceSha, pages: 'full', commerceEntry: entry }));
  }
  assert.doesNotThrow(() => webSurfaceBuildContractPlugin({ sourceSha, commerceSha, pages: 'full',
    commerceEntry: 'C:\\private\\src\\website.jsx?build=1' }));
  assert.doesNotThrow(() => webSurfaceBuildContractPlugin({ sourceSha, commerceSha, pages: 'full',
    commerceEntry: '/home/test project/private/src/website.jsx' }));
  assert.equal(forbiddenWebSurfaceModule('website', 'C:\\private\\src\\data\\pricingPlans.js?raw',
    'C:\\private\\src\\website.jsx?build=1'), true);
});

test('website release metadata names this repository, source inputs and the route contract', () => {
  assert.deepEqual(websiteReleaseMetadata({ sourceSha }), {
    schema: 'marty.website-image/v3', audience: 'production', surface: 'website',
    repository: 'ElevenID/website', source_sha: sourceSha, revision: sourceSha,
    production_pages: 'public', route_contract: WEB_ROUTE_CONTRACT, commerce_extension: null,
  });
  const full = websiteReleaseMetadata({ sourceSha, commerceSha, pages: 'full' });
  assert.equal(full.schema, 'marty.website-image/v1');
  assert.equal(full.revision, `${sourceSha}-${commerceSha}`);
  assert.deepEqual(full.commerce_extension, { repository: 'ElevenID/marty-subscriptions', source_sha: commerceSha });
});
