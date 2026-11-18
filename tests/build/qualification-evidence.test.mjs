import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  assertWebsiteSource, finalizeQualificationEvidence, prepareQualificationEvidence,
  qualificationWorkflowFromEnvironment, writeQualificationReceipt,
} from '../../scripts/lib/qualification-evidence.mjs';

const LOCAL_IMAGE = 'sha256:' + 'c'.repeat(64);
const canonicalRoute = '{"schema_version":1,"website":{"exact_paths":["/","/product"]}}';
const routeDigest = 'sha256:' + createHash('sha256').update(canonicalRoute).digest('hex');
const STAGES = ['prerender', 'output-verification', 'image-build', 'nginx'];
function put(root, filename, body) {
  mkdirSync(path.dirname(path.join(root, filename)), { recursive: true });
  writeFileSync(path.join(root, filename), body);
}
function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'website-evidence-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  put(root, '.gitignore', '.qualification/\nui/dist-website/\n');
  put(root, 'package-lock.json', '{"lockfileVersion":3}\n');
  put(root, 'Dockerfile.website', 'FROM scratch\n');
  put(root, 'contracts/web-surface-routes.json', JSON.stringify(JSON.parse(canonicalRoute), null, 2) + '\n');
  put(root, 'scripts/website-prerender-plan.mjs', 'export const routes = ["/", "/product"];\n');
  git(root, 'init', '--quiet', '--initial-branch=main');
  git(root, 'add', '.');
  git(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Fixture source');
  const sourceSha = git(root, 'rev-parse', 'HEAD');
  const options = { root, sourceSha, workflow: null };
  put(root, 'ui/dist-website/marty-website-release.json', JSON.stringify({
    schema: 'marty.website-image/v1', repository: 'ElevenID/website', surface: 'website',
    audience: 'production', production_pages: 'public', source_sha: sourceSha, revision: sourceSha,
    commerce_extension: null, route_contract: { version: 1, sha256: routeDigest },
  }) + '\n');
  put(root, 'ui/dist-website/index.html', '<h1>Public website</h1>\n');
  put(root, 'ui/dist-website/product/index.html', '<h1>Product</h1>\n');
  put(root, 'ui/dist-website/assets/main.js', 'console.log("fixture");\n');
  const results = {
    prerender: {
      qualified: 'website-production-prerender', source_sha: sourceSha, revision: sourceSha,
      route_count: 2, canonical_count: 2, sitemap_count: 2, pages: 2,
      readiness: { signal: 2, 'app-ready-fallback': 0, timeout: 0 },
    },
    'output-verification': {
      qualified: 'website-production-prerender-verification', source_sha: sourceSha, revision: sourceSha,
      routes: 2, canonical_urls: 2, unique_titles: 2, public_assets: 46,
    },
    'image-build': {
      qualified: 'website-static-container-build', source_sha: sourceSha, revision: sourceSha,
      image: 'elevenid-website:' + sourceSha, image_id: LOCAL_IMAGE,
      route_contract_sha256: routeDigest, registry_published: false,
    },
    nginx: {
      qualified: 'production-website-image', source_sha: sourceSha, revision: sourceSha,
      image: 'elevenid-website:' + sourceSha, image_id: LOCAL_IMAGE,
      route_count: 2, resource_checks: 57, denied_route_checks: 19,
    },
  };
  return { ...options, options, results };
}
function recordAll(context) {
  prepareQualificationEvidence(context.options);
  for (const stage of STAGES) writeQualificationReceipt({ ...context.options, stage, result: context.results[stage] });
}
function mutateJson(root, filename, mutate) {
  const target = path.join(root, '.qualification', filename);
  const data = JSON.parse(readFileSync(target, 'utf8'));
  mutate(data);
  writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
}
function workflow(attempt = '1') {
  return qualificationWorkflowFromEnvironment({
    GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'ElevenID/website', GITHUB_REPOSITORY_ID: '1459542519',
    GITHUB_WORKFLOW_REF: 'ElevenID/website/.github/workflows/migration-qualification.yml@refs/pull/13/merge',
    GITHUB_WORKFLOW_SHA: 'b'.repeat(40), GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF: 'refs/pull/13/merge',
    GITHUB_RUN_ID: '123456', GITHUB_RUN_ATTEMPT: attempt,
  });
}

test('complete evidence identifies exact bytes and local image without claiming publication or signed provenance', (t) => {
  const context = fixture(t);
  recordAll(context);
  const evidence = finalizeQualificationEvidence(context.options);
  assert.equal(evidence.schema, 'marty.website-qualification/v1');
  assert.equal(evidence.source_sha, context.sourceSha);
  assert.equal(evidence.local_image_id, LOCAL_IMAGE);
  for (const name of ['registry_published', 'cryptographic_provenance_verified', 'live_application_handoff_verified', 'production_deployed']) {
    assert.equal(evidence[name], false);
  }
  assert.equal(evidence.output.file_count, 4);
  assert.equal(evidence.output.route_contract_sha256, routeDigest);
  const manifest = JSON.parse(readFileSync(path.join(context.root, '.qualification/website-output-manifest.json'), 'utf8'));
  assert.deepEqual(manifest.files.map((entry) => entry.path), [
    'assets/main.js', 'index.html', 'marty-website-release.json', 'product/index.html',
  ]);
  assert.equal(evidence.output_manifest.sha256,
    'sha256:' + createHash('sha256').update(readFileSync(path.join(context.root, '.qualification/website-output-manifest.json'))).digest('hex'));
  assert.equal(Object.keys(evidence.inputs).length, 4);
  assert.ok(!JSON.stringify(evidence).includes('"image_id"'));
  assert.deepEqual(finalizeQualificationEvidence(context.options), evidence, 'same finalization is idempotent');
});

test('source guard rejects a mismatched SHA and both tracked and untracked local changes', (t) => {
  const context = fixture(t);
  assert.equal(assertWebsiteSource(context.options).source_sha, context.sourceSha);
  assert.throws(() => assertWebsiteSource({ ...context.options, sourceSha: 'a'.repeat(40) }), /differs from checked-out HEAD/);
  put(context.root, 'scripts/new-source.mjs', 'export const changed = true;\n');
  assert.throws(() => assertWebsiteSource(context.options), /must be clean/);
  rmSync(path.join(context.root, 'scripts/new-source.mjs'));
  put(context.root, 'package-lock.json', '{"changed":true}\n');
  assert.throws(() => assertWebsiteSource(context.options), /must be clean/);
  git(context.root, 'add', 'package-lock.json');
  assert.throws(() => assertWebsiteSource(context.options), /must be clean/);
});

test('stages require explicit initialization and the complete four-stage sequence', (t) => {
  const context = fixture(t);
  assert.throws(() => writeQualificationReceipt({ ...context.options, stage: 'prerender', result: context.results.prerender }), /ENOENT/);
  prepareQualificationEvidence(context.options);
  writeQualificationReceipt({ ...context.options, stage: 'prerender', result: context.results.prerender });
  assert.throws(() => finalizeQualificationEvidence(context.options), /ENOENT/);
});

test('a modified built asset immediately invalidates later stages and finalization', (t) => {
  const context = fixture(t);
  recordAll(context);
  put(context.root, 'ui/dist-website/assets/main.js', 'console.log("different bytes");\n');
  assert.throws(() => writeQualificationReceipt({ ...context.options, stage: 'nginx', result: context.results.nginx }), /output changed between/);
  assert.throws(() => finalizeQualificationEvidence(context.options), /receipt differs/);
});

test('stage result identity cannot substitute another source, success kind, image, or registry claim', (t) => {
  const context = fixture(t);
  prepareQualificationEvidence(context.options);
  for (const patch of [
    { source_sha: 'a'.repeat(40) }, { revision: 'a'.repeat(40) }, { qualified: 'made-up-success' },
    { image: 'elevenid-website:latest' }, { registry_published: true }, { image_digest: LOCAL_IMAGE },
  ]) {
    assert.throws(() => writeQualificationReceipt({ ...context.options, stage: 'image-build', result: { ...context.results['image-build'], ...patch } }));
  }
});

test('same source with a different local image or route count cannot finalize', (t) => {
  const context = fixture(t);
  context.results.nginx.image_id = 'sha256:' + 'd'.repeat(64);
  recordAll(context);
  assert.throws(() => finalizeQualificationEvidence(context.options), /different local image/);
  prepareQualificationEvidence(context.options);
  context.results.nginx.image_id = LOCAL_IMAGE;
  context.results.nginx.route_count = 1;
  for (const stage of STAGES) writeQualificationReceipt({ ...context.options, stage, result: context.results[stage] });
  assert.throws(() => finalizeQualificationEvidence(context.options), /HTTP route counts differ/);
});

test('receipt tampering is rejected even when the current output is unchanged', (t) => {
  const context = fixture(t);
  recordAll(context);
  mutateJson(context.root, 'prerender.json', (receipt) => { receipt.production_deployed = true; });
  assert.throws(() => finalizeQualificationEvidence(context.options), /receipt differs/);
});

test('workflow custody keeps workflow and checkout SHAs separate and refuses mixed attempts', (t) => {
  const context = fixture(t);
  context.options.workflow = workflow('1');
  recordAll(context);
  const evidence = finalizeQualificationEvidence(context.options);
  assert.equal(evidence.source_sha, context.sourceSha);
  assert.equal(evidence.workflow.workflow_sha, 'b'.repeat(40));
  assert.equal(evidence.workflow.ref, 'refs/pull/13/merge');
  assert.equal(evidence.workflow.event_name, 'pull_request');
  assert.throws(() => writeQualificationReceipt({ ...context.options, workflow: workflow('2'), stage: 'nginx', result: context.results.nginx }), /context differs/);
  mutateJson(context.root, 'nginx.json', (receipt) => { receipt.workflow.run_attempt = '2'; });
  assert.throws(() => finalizeQualificationEvidence(context.options), /receipt differs/);
});

test('workflow capture rejects incorrect repositories and incomplete hosted context', () => {
  assert.equal(qualificationWorkflowFromEnvironment({}), null);
  assert.throws(() => qualificationWorkflowFromEnvironment({ GITHUB_ACTIONS: 'true' }));
  assert.throws(() => qualificationWorkflowFromEnvironment({
    GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'someone/else',
  }), /someone\/else/);
});

test('route-contract mismatch or private commerce in built metadata cannot produce evidence', (t) => {
  const context = fixture(t);
  prepareQualificationEvidence(context.options);
  const target = path.join(context.root, 'ui/dist-website/marty-website-release.json');
  const metadata = JSON.parse(readFileSync(target, 'utf8'));
  writeFileSync(target, JSON.stringify({ ...metadata, route_contract: { version: 1, sha256: 'sha256:' + 'f'.repeat(64) } }));
  assert.throws(() => writeQualificationReceipt({ ...context.options, stage: 'prerender', result: context.results.prerender }), /route contract differs/);
  writeFileSync(target, JSON.stringify({ ...metadata, commerce_extension: { repository: 'private/example' } }));
  assert.throws(() => writeQualificationReceipt({ ...context.options, stage: 'prerender', result: context.results.prerender }), /private commerce/);
});

test('output symlinks are rejected instead of hashing data outside the built website', (t) => {
  const context = fixture(t);
  prepareQualificationEvidence(context.options);
  symlinkSync(path.join(context.root, 'package-lock.json'), path.join(context.root, 'ui/dist-website/outside.json'));
  assert.throws(() => writeQualificationReceipt({ ...context.options, stage: 'prerender', result: context.results.prerender }), /symlinks/);
});

test('evidence destinations must be ignored, inside the checkout, and outside its served output', (t) => {
  const context = fixture(t);
  for (const directory of ['../outside-evidence', context.root, 'ui/dist-website/evidence', 'scripts/evidence']) {
    assert.throws(() => prepareQualificationEvidence({ ...context.options, directory }));
  }
  const outside = mkdtempSync(path.join(os.tmpdir(), 'website-evidence-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  symlinkSync(outside, path.join(context.root, '.qualification'));
  assert.throws(() => prepareQualificationEvidence(context.options), /symlinks/);
  assert.deepEqual(readdirSync(outside), []);
});

test('preparation clears only recognized regular evidence and preserves unexpected files', (t) => {
  const context = fixture(t);
  recordAll(context);
  finalizeQualificationEvidence(context.options);
  put(context.root, '.qualification/unexpected.txt', 'Do not delete');
  assert.throws(() => prepareQualificationEvidence(context.options), /Unexpected entry/);
  assert.equal(readFileSync(path.join(context.root, '.qualification/unexpected.txt'), 'utf8'), 'Do not delete');
  assert.ok(readdirSync(path.join(context.root, '.qualification')).includes('website-qualification.json'));
  rmSync(path.join(context.root, '.qualification/unexpected.txt'));
  prepareQualificationEvidence(context.options);
  assert.deepEqual(readdirSync(path.join(context.root, '.qualification')), ['qualification-context.json']);
});

test('preparation rejects symlinked receipts before deleting existing evidence', (t) => {
  const context = fixture(t);
  recordAll(context);
  rmSync(path.join(context.root, '.qualification/nginx.json'));
  symlinkSync(path.join(context.root, 'package-lock.json'), path.join(context.root, '.qualification/nginx.json'));
  assert.throws(() => prepareQualificationEvidence(context.options), /Unexpected entry/);
  assert.ok(readdirSync(path.join(context.root, '.qualification')).includes('prerender.json'));
  assert.equal(readFileSync(path.join(context.root, 'package-lock.json'), 'utf8'), '{"lockfileVersion":3}\n');
});
