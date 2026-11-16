import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearLandingAuthError,
  getLandingAuthError,
  getLandingEntryDecision,
} from '../ui/src/application/routing/landingEntry.js';

// Behavioral cases adapted from ElevenID/marty-ui@df6ec6c4bfee803d89c54e9333297f29f378cee3,
// ui/src/application/routing/landingEntry.test.ts, blob 6b2b93a8f6b853138fb4df0f31f0486f1a9d389b.
// Decoding regressions and native Node assertions are additions for this extraction.
test('missing and empty authentication errors remain absent', () => {
  for (const params of [undefined, null, {}, new URLSearchParams(), new URLSearchParams('auth_error=')]) {
    assert.equal(getLandingAuthError(params), null);
  }
});

test('ordinary authentication errors use URLSearchParams decoding', () => {
  const params = new URLSearchParams('auth_error=Login+failed%3A+access_denied');
  assert.equal(getLandingAuthError(params), 'Login failed: access_denied');
});

test('literal percent signs do not trigger a second URI decode', () => {
  const params = new URLSearchParams('auth_error=Rate+limit%3A+50%25');
  assert.equal(getLandingAuthError(params), 'Rate limit: 50%');
});

test('encoded plus signs remain literal while query spaces are decoded', () => {
  const params = new URLSearchParams('auth_error=C%2B%2B+login+failed');
  assert.equal(getLandingAuthError(params), 'C++ login failed');
});

test('percent-encoded text is decoded exactly once', () => {
  const params = new URLSearchParams('auth_error=Keep+%252F+and+%252B+literal');
  assert.equal(getLandingAuthError(params), 'Keep %2F and %2B literal');
});

test('malformed percent escapes remain displayable authentication errors', () => {
  const params = new URLSearchParams('auth_error=Malformed%3A+%ZZ%2');
  assert.equal(getLandingAuthError(params), 'Malformed: %ZZ%2');
});

test('clearing authentication errors preserves other values and the input', () => {
  const params = new URLSearchParams('auth_error=Denied&filter=one&filter=two&name=C%2B%2B&auth_error=Again');
  const before = params.toString();
  const cleared = clearLandingAuthError(params);
  assert.notEqual(cleared, params);
  assert.equal(cleared.has('auth_error'), false);
  assert.deepEqual(cleared.getAll('filter'), ['one', 'two']);
  assert.equal(cleared.get('name'), 'C++');
  assert.equal(params.toString(), before);
  assert.equal(clearLandingAuthError(undefined).toString(), '');
});

test('landing decisions preserve loading priority and authenticated navigation', () => {
  for (const isAuthenticated of [false, true]) {
    assert.deepEqual(getLandingEntryDecision({ isAuthenticated, isLoading: true }), {
      action: 'loading', redirectTo: null,
    });
  }
  assert.deepEqual(getLandingEntryDecision({ isAuthenticated: false, isLoading: false }), {
    action: 'render', redirectTo: null,
  });
  assert.deepEqual(getLandingEntryDecision({ isAuthenticated: true, isLoading: false }), {
    action: 'navigate', redirectTo: '/console/applicant',
  });
  assert.deepEqual(getLandingEntryDecision({
    isAuthenticated: true, isLoading: false, redirectTo: '/console/org?view=home',
  }), { action: 'navigate', redirectTo: '/console/org?view=home' });
});
