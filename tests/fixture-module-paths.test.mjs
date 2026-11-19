import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { educationContentBoundaryPlugin } from './fixtures/education-content-boundaries.mjs';
import { marketingContentBoundaryPlugin } from './fixtures/marketing-content-boundaries.mjs';
import { websiteRouteBoundaryPlugin } from './fixtures/website-route-boundaries.mjs';
const root = new URL('../', import.meta.url);
const backslash = String.fromCharCode(92);
const cases = [
  [educationContentBoundaryPlugin, 'ui/src/components/IdentityGuidePage.jsx', './diagrams'],
  [marketingContentBoundaryPlugin, 'ui/src/components/pages/MarketingProtocolSupportCatalog.jsx', '../../../../contracts/protocol-support-catalog.json'],
  [websiteRouteBoundaryPlugin, 'ui/src/apps/website/WebsiteRoutes.jsx', '../../components/LandingPageContent'],
];
for (const [create, path, dependency] of cases) test(`${path} preserves exact fixture bounds across native, Vite and Windows paths`, () => {
  const native = fileURLToPath(new URL(path, root));
  const forward = native.replaceAll(backslash, '/');
  const variants = [native, forward, forward.replaceAll('/', backslash), forward + '?v=fixture'];
  const plugin = create();
  for (const importer of variants) {
    assert.equal(typeof plugin.resolveId(dependency, importer), 'string', importer);
    assert.throws(() => plugin.resolveId('unreviewed-private-import', importer), /Unlisted/);
  }
  assert.equal(plugin.resolveId(dependency, forward.replace('/ui/', '/unrelated/ui/')), null);
  assert.equal(plugin.resolveId(dependency, undefined), null);
});


test('resolved public-config aliases normalize separators without widening source query admission', () => {
  const plugin = websiteRouteBoundaryPlugin();
  const importer = fileURLToPath(new URL('ui/src/apps/website/WebsiteRoutes.jsx', root));
  const target = fileURLToPath(new URL('ui/src/variants/publicConfig.website.js', root));
  for (const source of [target, target.replaceAll(backslash, '/')]) {
    assert.equal(plugin.resolveId(source, importer), null);
    assert.throws(() => plugin.resolveId(source + '?unreviewed', importer), /Unlisted/);
  }
});
