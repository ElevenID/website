import assert from 'node:assert/strict';
import test from 'node:test';

// Run against the actual Pages preview or a local Wrangler Pages instance.
// Do not emulate redirect matching: the serving platform must apply _redirects.
const siteOrigin = process.env.MARTY_PAGES_TEST_ORIGIN;
const applicationOrigin = process.env.MARTY_PAGES_TEST_APPLICATION_ORIGIN;
assert.ok(siteOrigin && applicationOrigin,
  'Set MARTY_PAGES_TEST_ORIGIN and MARTY_PAGES_TEST_APPLICATION_ORIGIN');
assert.equal(new URL(siteOrigin).origin, siteOrigin);
assert.equal(new URL(applicationOrigin).origin, applicationOrigin);

for (const path of [
  '/login?next=%2Fconsole%2Forg%3Ftab%3Dmembers',
  '/verify?policy=synthetic',
  '/docs',
  '/docs/',
  '/docs/quickstart',
  '/docs?search=OAuth%20code&tag=api&tag=identity',
  '/docs/api/credentials?path=%2Fconsole&label=client%2Bserver',
]) {
  test(`Pages preserves the application path and query for ${path}`, async () => {
    const response = await fetch(siteOrigin + path, {
      redirect: 'manual', signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), applicationOrigin + path);
    await response.body?.cancel();
  });
}

for (const path of ['/does-not-exist', '/docs-extra', '/console', '/api/unowned']) {
  test(`Pages keeps ${path} outside the application handoff`, async () => {
    const response = await fetch(siteOrigin + path, {
      redirect: 'manual', signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('location'), null);
    await response.body?.cancel();
  });
}
