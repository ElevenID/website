import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertWebsiteRouteCanonical, createWebsitePrerenderPlan } from '../../scripts/website-prerender-plan.mjs';

test('production prerender covers canonical public pages and generated content routes', async () => {
  const plan = await createWebsitePrerenderPlan();
  const routes = new Set(plan.routes);
  assert.ok(routes.has('/'));
  assert.ok(routes.has('/product'));
  assert.ok(routes.has('/ai'));
  assert.ok(routes.has('/what-is-credential-verification'));
  assert.ok(routes.has('/blog'));
  assert.ok(routes.has('/blog/foundations'));
  assert.ok(routes.has('/authors'));
  assert.ok(routes.has('/demos'));
  assert.ok([...routes].some((route) => route.startsWith('/blog/') && route !== '/blog'));
  assert.ok([...routes].some((route) => route.startsWith('/authors/') && route !== '/authors'));
  assert.ok([...routes].some((route) => /^\/demos\/\d{4}\.\d{2}\.\d+$/.test(route)));
  assert.ok([...routes].some((route) => /^\/demos\/\d{4}\.\d{2}\.\d+\//.test(route)));
  assert.equal(routes.size, plan.routes.length);
  assert.ok(plan.routes.every((route) => route.startsWith('/') && (route === '/' || !route.endsWith('/'))));
});

test('prerender never claims withheld pricing or application-owned routes', async () => {
  const plan = await createWebsitePrerenderPlan();
  for (const route of ['/pricing', '/verify']) {
    assert.equal(plan.routes.includes(route), false, route);
  }
  assert.equal(plan.routes.some((route) => /^\/(console|applicant|admin|vendor|dashboard|auth|api|v1)(\/|$)/.test(route)), false);
});

test('supported aliases have prerender output and the same canonical target as their React routes', async () => {
  const plan = await createWebsitePrerenderPlan();
  const aliases = {
    '/verification': '/verifiable-credential-api',
    '/issuance': '/open-badges-issuance',
    '/privacy': '/privacy-policy',
    '/terms': '/terms-of-service',
    '/from-idv-to-verifiable-identity': '/why-verifiable-identity',
    '/what-is-verifiable-identity': '/why-verifiable-identity',
    '/blog/selective-disclosure-explained': '/blog/selective-disclosure',
  };
  for (const [route, canonicalPath] of Object.entries(aliases)) {
    assert.ok(plan.routes.includes(route), route);
    assert.equal(plan.canonicalPaths[route], canonicalPath, route);
    assert.doesNotThrow(() => assertWebsiteRouteCanonical(plan, route, 'https://elevenidllc.com' + canonicalPath));
    assert.throws(() => assertWebsiteRouteCanonical(plan, route, 'https://elevenidllc.com/'), /Canonical mismatch/);
  }
});

test('each planned page binds its own canonical identity and rejects unrelated valid metadata', async () => {
  const plan = await createWebsitePrerenderPlan();
  assert.deepEqual(Object.keys(plan.canonicalPaths), plan.routes);
  for (const route of plan.routes) {
    const canonicalPath = plan.canonicalPaths[route];
    assert.ok(plan.routes.includes(canonicalPath), route);
    const expected = new URL(canonicalPath, 'https://elevenidllc.com').href;
    assert.doesNotThrow(() => assertWebsiteRouteCanonical(plan, route, expected));
    for (const invalid of [null, expected + '?preview=1', expected + '#section', expected.replace('https:', 'http:'),
      expected.replace('elevenidllc.com', 'other.example')]) {
      assert.throws(() => assertWebsiteRouteCanonical(plan, route, invalid), /Canonical mismatch/);
    }
  }
  assert.equal(plan.canonicalPaths['/blog/foundations'], '/blog/foundations');
  assert.equal(plan.canonicalPaths['/demos'], '/demos/'
    + (plan.demoIndex.latest_approved_stack_version || plan.demoIndex.latest_available_stack_version));
  assert.throws(() => assertWebsiteRouteCanonical(plan, '/unplanned', 'https://elevenidllc.com/unplanned'), /unplanned website route/);
});

test('draft and partial demo evidence remains preview-only and never becomes latest-approved', async () => {
  const plan = await createWebsitePrerenderPlan();
  const available = plan.demoIndex.releases.find((release) => release.stack_version === plan.demoIndex.latest_available_stack_version);
  assert.ok(available);
  if (available.publication_state === 'DRAFT') assert.equal(plan.demoIndex.latest_approved_stack_version, null);
  if (available.publication_state === 'DRAFT') assert.equal(available.coverage_state, 'PARTIAL');
  if (plan.demoIndex.latest_approved_stack_version === null) {
    assert.equal(plan.routes.some((route) => route.startsWith('/demos/latest/')), false);
  }
});
