import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNavigation } from './navigation-harness.mjs';

// Independently authored helper tests; no React/DOM or source transformations.
const site = 'https://elevenidllc.com';
const alias = 'https://192.0.2.10';
const target = '/verify?next=%2Fconsole%3Ftab%3Dkeys%23active#start';
const hosting = { canonicalOrigin: site, publicEntryOrigins: [alias] };

test('the actual contract distinguishes verification and application routes', async () => {
  const { webSurface } = await loadNavigation();
  for (const path of ['/', '/product', '/verification', '/pricing', '/blog/example']) {
    assert.equal(webSurface.getWebSurface(path), 'website', path);
  }
  for (const path of ['/verify', '/verify/', '/verify/examples', '/login', '/console', '/unknown']) {
    assert.equal(webSurface.getWebSurface(path), 'application', path);
  }
});

test('surface and console transitions require document navigation', async () => {
  for (const [currentPathname, destination, expected, surface] of [
    ['/product', '/solutions', false],
    ['/product', target, true],
    ['/verify', '/product', true],
    ['/login', '/verify', false],
    ['/verify', '/console/org', true],
    ['/console/org', '/console/applicant', false],
    ['/console/org', '/verify', true],
    ['/consolex', '/login', false],
    ['/consolex', '/console', true],
    ['/product', '#details', false],
    ['/product', '/verify', false, 'application'],
  ]) {
    const { appHandoff } = await loadNavigation({ href: site + currentPathname });
    assert.equal(
      appHandoff.shouldBrowserRedirect({ currentPathname, destination, surface }),
      expected, currentPathname + ' -> ' + destination,
    );
  }
});

test('same-origin destinations retain the exact query and fragment', async () => {
  const { safeNavigation, appHandoff, calls } = await loadNavigation();
  assert.equal(safeNavigation.safeNavigationDestination(site + target), target);
  assert.equal(safeNavigation.safeNavigationDestination(target), target);
  assert.equal(appHandoff.redirectBrowser(site + target, { replace: false }), true);
  assert.deepEqual(calls, [{ method: 'assign', destination: target }]);
});

test('unsafe and unapproved inputs cause no navigation or coercion', async () => {
  const loaded = await loadNavigation();
  const object = { toString() { throw new Error('Unexpected coercion'); } };
  for (const destination of [
    undefined, null, false, 1, object, '', ' /verify', '/verify ',
    '//other.example/verify', '/\\other.example/verify', '/verify\n',
    'javascript:alert(1)', 'data:text/plain,example', 'file:///tmp/example',
    'https://other.example/verify', 'http://elevenidllc.com/verify',
    'https://user:password@elevenidllc.com/verify',
  ]) {
    assert.equal(loaded.safeNavigation.safeNavigationDestination(destination), null);
    assert.equal(loaded.appHandoff.shouldBrowserRedirect({ currentPathname: '/product', destination }), false);
    assert.equal(loaded.appHandoff.redirectBrowser(destination), false);
  }
  assert.deepEqual(loaded.calls, []);
});

test('configured aliases send interactive paths to the canonical origin', async () => {
  const loaded = await loadNavigation({ href: alias + '/', runtimeConfig: { hosting } });
  assert.equal(loaded.publicEntry.getPublicEntryCanonicalOrigin(), site);
  assert.equal(loaded.publicEntry.publicEntryHref(target), site + target);
  assert.equal(loaded.publicEntry.publicEntryHref('#details'), '#details');
  assert.equal(loaded.safeNavigation.safeNavigationDestination(site + target), site + target);
  assert.equal(loaded.safeNavigation.safeNavigationDestination('https://other.example/verify'), null);
  assert.equal(loaded.appHandoff.shouldBrowserRedirect({ currentPathname: '/', destination: '/product' }), true);
  assert.equal(loaded.appHandoff.redirectBrowser(target, { replace: false }), true);
  assert.deepEqual(loaded.calls, [{ method: 'assign', destination: site + target }]);
});

test('only exact HTTPS IP aliases and canonical identities are accepted', async () => {
  const { publicEntry } = await loadNavigation();
  for (const origin of [alias, 'https://[2001:db8::1]']) {
    assert.equal(publicEntry.getPublicEntryCanonicalOrigin(origin, {
      canonicalOrigin: site, publicEntryOrigins: [origin],
    }), site);
  }
  for (const config of [
    null, {},
    { ...hosting, canonicalOrigin: site + '/' },
    { ...hosting, canonicalOrigin: 'http://elevenidllc.com' },
    { ...hosting, canonicalOrigin: alias },
    { ...hosting, canonicalOrigin: 'https://localhost' },
    { ...hosting, canonicalOrigin: 'https://user@elevenidllc.com' },
    { ...hosting, publicEntryOrigins: [] },
    { ...hosting, publicEntryOrigins: [alias, 'https://192.0.2.11'] },
    { ...hosting, publicEntryOrigins: ['https://entry.example'] },
    { ...hosting, publicEntryOrigins: [alias + '/path'] },
    { ...hosting, publicEntryOrigins: ['http://192.0.2.10'] },
  ]) {
    assert.equal(publicEntry.getPublicEntryCanonicalOrigin(alias, config), null);
  }
  assert.equal(publicEntry.getPublicEntryCanonicalOrigin('https://192.0.2.11', hosting), null);
});

test('an address or query alone cannot select a canonical identity', async () => {
  const loaded = await loadNavigation({ href: alias + '/product?canonicalOrigin=' + site });
  assert.equal(loaded.publicEntry.getPublicEntryCanonicalOrigin(), null);
  assert.equal(loaded.publicEntry.publicEntryHref(target), target);
  assert.equal(loaded.safeNavigation.safeNavigationDestination(site + target), null);
  assert.equal(loaded.appHandoff.shouldBrowserRedirect({ currentPathname: '/product', destination: '/solutions' }), false);
});

test('redirects honor replace, assign and href fallbacks', async () => {
  for (const [locationMethods, options, method] of [
    [['assign', 'replace'], undefined, 'replace'],
    [['assign', 'replace'], { replace: false }, 'assign'],
    [['assign'], {}, 'assign'],
    [[], {}, 'href'],
    [['replace'], { replace: false }, 'href'],
  ]) {
    const loaded = await loadNavigation({ locationMethods });
    assert.equal(loaded.appHandoff.redirectBrowser(target, options), true);
    assert.deepEqual(loaded.calls, [{ method, destination: target }]);
    assert.equal(loaded.location.href, site + target);
  }
});

test('same-location destinations cannot trigger refresh loops', async () => {
  const loaded = await loadNavigation({ href: site + target });
  for (const destination of [target, site + target, '#start', '?next=%2Fconsole%3Ftab%3Dkeys%23active#start']) {
    assert.equal(loaded.appHandoff.redirectBrowser(destination), false);
  }
  assert.deepEqual(loaded.calls, []);
  assert.equal(loaded.appHandoff.redirectBrowser('#changed'), true);
  assert.deepEqual(loaded.calls, [{ method: 'replace', destination: '#changed' }]);
  assert.equal(loaded.appHandoff.redirectBrowser('#changed'), false);
});
