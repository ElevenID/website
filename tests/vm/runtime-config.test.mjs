import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNavigation } from './navigation-harness.mjs';

// Behavioral cases adapted from ElevenID/marty-ui@df6ec6c4bfee803d89c54e9333297f29f378cee3,
// ui/src/utils/runtimeConfig.test.ts, blob ff28dd09080b6d5b244367c41ab647dd25903e67.
// Native VM execution and hosting/server-context coverage are extraction additions.
test('hosting uses browser runtime configuration', async () => {
  const loaded = await loadNavigation({
    runtimeConfig: { hosting: { canonicalOrigin: 'https://canonical.example' } },
  });
  assert.equal(loaded.runtimeConfig.getHostingRuntimeConfig(), loaded.window.__MARTY_RUNTIME_CONFIG__.hosting);
  for (const value of [undefined, null, false, 42, 'invalid', {}]) {
    loaded.window.__MARTY_RUNTIME_CONFIG__ = value;
    assert.equal(loaded.runtimeConfig.getHostingRuntimeConfig(), undefined);
  }
  const server = await loadNavigation({ withWindow: false });
  assert.equal(server.runtimeConfig.getHostingRuntimeConfig(), undefined);
});

test('legacy configuration enables both sections', async () => {
  const { runtimeConfig: api, window } = await loadNavigation();
  for (const config of [undefined, {}, { hosting: {} }]) {
    window.__MARTY_RUNTIME_CONFIG__ = config;
    assert.deepEqual(Array.from(api.getEnabledWebSections()), ['public', 'console']);
    assert.equal(api.isWebSectionEnabled('public'), true);
    assert.equal(api.isWebSectionEnabled('console'), true);
  }
});

test('startup sections preserve path gates', async () => {
  const { runtimeConfig: api, window } = await loadNavigation();
  // Section gating is separate from route ownership.
  for (const sections of [['public', 'console'], ['public'], ['console'], []]) {
    window.__MARTY_RUNTIME_CONFIG__ = { web: { enabled_sections: sections } };
    const publicEnabled = sections.includes('public');
    const consoleEnabled = sections.includes('console');
    assert.deepEqual(Array.from(api.getEnabledWebSections()), sections);
    for (const path of ['/', '/organizations', '/login?next=%2Fconsole', '/console-other']) {
      assert.equal(api.isWebPathEnabled(path), publicEnabled, path);
    }
    for (const path of [
      '/console', '/console/login?next=%2Fconsole', '/console/applicant#identity',
      '/console-handoff/org', '/credentials', '/catalog', '/my-applications', '/my-documents',
    ]) assert.equal(api.isWebPathEnabled(path), consoleEnabled, path);
    for (const path of ['/apply', '/apply/badge?claim=example#start']) {
      assert.equal(api.isWebPathEnabled(path), publicEnabled && consoleEnabled, path);
    }
    assert.equal(api.isWebPathEnabled('/auth/callback?code=example#return'), publicEnabled || consoleEnabled);
  }
});

test('malformed explicit startup sections fail closed', async () => {
  const { runtimeConfig: api, window } = await loadNavigation();
  for (const web of [
    null, false, [], {}, { enabled_sections: 'public,console' },
    { enabled_sections: ['marketing'] }, { enabled_sections: ['public', 'unknown'] },
    { enabled_sections: ['console', 'console'] }, { enabled_sections: [null] },
  ]) {
    window.__MARTY_RUNTIME_CONFIG__ = { web };
    assert.deepEqual(Array.from(api.getEnabledWebSections()), []);
    for (const path of ['/', '/console', '/apply/example', '/auth/callback']) {
      assert.equal(api.isWebPathEnabled(path), false, path);
    }
  }
});

test('organization creation preserves strict runtime precedence', async () => {
  const { runtimeConfig: api, window } = await loadNavigation();
  for (const legacy of [false, true]) {
    window.__MARTY_RUNTIME_CONFIG__ = {};
    assert.equal(api.isOrganizationCreationEnabled(legacy), legacy);
    for (const value of [true, false, null, 'true', 'false', 1, [], {}, undefined]) {
      window.__MARTY_RUNTIME_CONFIG__ = { organizationCreationEnabled: value };
      assert.equal(api.isOrganizationCreationEnabled(legacy), value === true);
    }
  }
});

test('analytics presence overrides the build fallback', async () => {
  const { runtimeConfig: api, window, env } = await loadNavigation({
    env: { VITE_GA_MEASUREMENT_ID: ' G-BUILD123 ' },
  });
  assert.equal(api.getGoogleAnalyticsMeasurementId(), 'G-BUILD123');
  for (const [value, expected] of [[' G-RUNTIME123 ', 'G-RUNTIME123'], ['', ''], [null, ''], [false, ''], [1, ''], [undefined, '']]) {
    window.__MARTY_RUNTIME_CONFIG__ = { googleAnalyticsMeasurementId: value };
    assert.equal(api.getGoogleAnalyticsMeasurementId(), expected);
  }
  window.__MARTY_RUNTIME_CONFIG__ = {};
  env.VITE_GA_MEASUREMENT_ID = 123;
  assert.equal(api.getGoogleAnalyticsMeasurementId(), '');
});

test('admin runtime flags override build settings', async () => {
  const { runtimeConfig: api, window, env } = await loadNavigation({ env: { PROD: true } });
  for (const value of [false, 0, '0', ' false ', 'NO', 'off', 'disabled']) {
    window.__MARTY_RUNTIME_CONFIG__ = { adminImpersonationEnabled: value };
    env.VITE_ENABLE_ADMIN_IMPERSONATION = 'true';
    assert.equal(api.isAdminImpersonationEnabled(), false);
  }
  for (const value of [true, 1, -1, '1', ' TRUE ', 'yes', 'on', 'enabled']) {
    window.__MARTY_RUNTIME_CONFIG__ = { adminImpersonationEnabled: value };
    env.VITE_ENABLE_ADMIN_IMPERSONATION = 'false';
    assert.equal(api.isAdminImpersonationEnabled(), true);
  }
});

test('admin fallback preserves build flags and production defaults', async () => {
  const { runtimeConfig: api, window, env } = await loadNavigation();
  for (const value of [undefined, null, {}, 'unknown']) {
    window.__MARTY_RUNTIME_CONFIG__ = { adminImpersonationEnabled: value };
    for (const [prod, flag, expected] of [
      [true, undefined, false], [true, 'true', true],
      [false, 'false', false], [false, undefined, true],
    ]) {
      env.PROD = prod;
      env.VITE_ENABLE_ADMIN_IMPERSONATION = flag;
      assert.equal(api.isAdminImpersonationEnabled(), expected);
    }
  }
});
