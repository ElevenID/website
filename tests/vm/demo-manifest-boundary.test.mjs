import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const archive = JSON.parse(readFileSync(new URL('ui/public/demos/manifests/2026.08.0.json', root), 'utf8'));
const retired = ['canvas-learning-achievement', 'external-evidence-to-credential'];
const retained = archive.scenarios.filter(s => !retired.includes(s.slug));

async function load({ prerender = false, manifest = archive } = {}) {
  const requests = [];
  const context = vm.createContext({ URL, window: { __ELEVENID_PRERENDER__: { demoManifests: prerender } },
    fetch: async url => {
      assert.equal(prerender, false, 'prerender must use the generated module');
      requests.push(url);
      return { ok: true, json: async () => structuredClone(manifest) };
    },
  });
  const modules = new Map();
  function module(url) {
    let target = url;
    if (!existsSync(target)) target = new URL(url.href + '.js');
    assert.ok(target.href.startsWith(root.href), target.href);
    if (modules.has(target.href)) return modules.get(target.href);
    const source = readFileSync(target, 'utf8');
    const value = target.pathname.endsWith('.json')
      ? new vm.SyntheticModule(['default'], function () {
        this.setExport('default', vm.runInContext('JSON.parse(' + JSON.stringify(source) + ')', context));
      }, { context, identifier: target.href })
      : new vm.SourceTextModule(source, { context, identifier: target.href,
        initializeImportMeta(meta) { meta.env = { VITE_WEBSITE_ASSET_BASE: '/_website/' + 'a'.repeat(40) + '/' }; },
      });
    modules.set(target.href, value);
    return value;
  }
  const entry = module(new URL('ui/src/services/demoManifestService.js', root));
  await entry.link((specifier, referrer) => {
    assert.ok(specifier.startsWith('.'), specifier);
    return module(new URL(specifier, referrer.identifier));
  });
  await entry.evaluate();
  return { api: entry.namespace, requests };
}

for (const prerender of [false, true]) test(`${prerender ? 'generated prerender' : 'fetched'} manifest hides retired provider demos and preserves archived evidence`, async () => {
  const before = JSON.stringify(archive);
  const { api, requests } = await load({ prerender });
  const result = await api.loadDemoManifest('2026.08.0');
  assert.deepEqual(Array.from(result.scenarios, s => s.slug), retained.map(s => s.slug));
  assert.equal(JSON.stringify(result.scenarios), JSON.stringify(retained));
  assert.equal(JSON.stringify(archive), before);
  assert.equal(requests.length, prerender ? 0 : 1);
});

test('raw archived and renamed D07/D08 entries cannot resolve through direct lookup', async () => {
  const { api } = await load();
  for (const slug of retired) assert.equal(api.findDemoScenario(archive, slug), null);
  for (const demo_id of ['D-07', 'D-08']) {
    const manifest = { scenarios: [{ ...retained[0], demo_id, slug: 'renamed-provider' }] };
    assert.equal(api.findDemoScenario(manifest, 'renamed-provider'), null);
  }
  assert.equal(api.findDemoScenario(archive, retained[0].slug), archive.scenarios.find(s => s.slug === retained[0].slug));
});

test('retirement does not suppress archive validation errors', async () => {
  const manifest = structuredClone(archive);
  manifest.scenarios.find(s => s.slug === retired[0]).protocols = ['unsupported-protocol'];
  const { api } = await load({ manifest });
  await assert.rejects(api.loadDemoManifest('2026.08.0'), { name: 'DemoManifestError' });
});


test('a release containing only retired demos fails as an unavailable active catalog', async () => {
  const manifest = structuredClone(archive);
  manifest.scenarios = manifest.scenarios.filter(s => retired.includes(s.slug));
  const { api } = await load({ manifest });
  await assert.rejects(api.loadDemoManifest('2026.08.0'), /no platform-owned demo scenarios/);
});
