import assert from 'node:assert/strict';
import test from 'node:test';
import { pagesLoginRedirect } from '../../scripts/lib/pages-login-redirect.mjs';

test('Pages hands application entry and documentation routes to the configured separate origin', () => {
  assert.equal(pagesLoginRedirect(undefined), '');
  assert.equal(pagesLoginRedirect('https://identity.example.test'),
    '/login https://identity.example.test/login 302\n'
    + '/verify https://identity.example.test/verify 302\n'
    + '/docs https://identity.example.test/docs 302\n'
    + '/docs/* https://identity.example.test/docs/:splat 302\n');
});

test('Pages application handoff rejects untrusted origins', () => {
  for (const invalid of ['https://elevenidllc.com', 'https://www.elevenidllc.com',
    'https://abc.elevenid-public-website.pages.dev', 'https://identity.example.test/path',
    'https://user@identity.example.test', 'http://identity.example.test',
    'https://identity.example.test?next=/console', 'https://127.0.0.1']) {
    assert.throws(() => pagesLoginRedirect(invalid));
  }
});
