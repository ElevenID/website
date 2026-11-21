import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  STANDALONE_INPUT_PATHS, canonicalReleaseJson, createStandaloneBuildPlan, createStandaloneRelease,
  releasePlanDigest, standaloneImageMetadata, standalonePlanFromQualification,
  validateStandaloneBuildPlan, validateStandaloneRelease,
} from '../../scripts/lib/standalone-release-contract.mjs';
import { prepareQualificationEvidence, writeQualificationReceipt } from '../../scripts/lib/qualification-evidence.mjs';
import { websiteReleaseMetadata } from '../../ui/scripts/web-surface-build-contract.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const fixture = JSON.parse(readFileSync(new URL('../../contracts/fixtures/standalone-website-release-v2.json', import.meta.url), 'utf8'));
const release = fixture.release;
const bunFixture = JSON.parse(readFileSync(new URL('../../contracts/fixtures/standalone-website-release-v3.json', import.meta.url), 'utf8'));
const LOCAL_IMAGE = 'sha256:' + 'c'.repeat(64);
const hash = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

test('the shared Node/Python synthetic fixture fixes the v2 envelope and canonical plan digest', () => {
  assert.equal(fixture.purpose, 'synthetic-contract-fixture-not-release-evidence');
  assert.equal(releasePlanDigest(release.build_plan), 'sha256:651dc6a6bf9ed66ba7b2a58edfe72a6efd266924fa71f4a82aa514ddd7b8f609');
  assert.deepEqual(validateStandaloneRelease(release), release);
  const plan = createStandaloneBuildPlan({ sourceSha: release.source_sha, inputSha256: release.build_plan.input_sha256,
    output: release.build_plan.output, routeContract: release.build_plan.route_contract, version: 2 });
  assert.deepEqual(createStandaloneRelease({ buildPlan: plan, imageMetadata: standaloneImageMetadata(plan),
    registryManifestDigest: release.image.digest, runId: '1234567890', runAttempt: '2' }), release);
  assert.equal(hash(canonicalReleaseJson(plan)), release.build_plan_sha256);
});

test('the Bun v3 contract binds both locks, preserves Node/Python parity and leaves v2 evidence valid', () => {
  const record = bunFixture.release;
  assert.equal(bunFixture.purpose, 'synthetic-contract-fixture-not-release-evidence');
  assert.deepEqual(validateStandaloneRelease(record), record);
  assert.equal(record.build_plan.package_manager, 'bun@1.4.4');
  assert.equal(record.build_plan.dependency_lock, 'bun.lock');
  assert.match(record.build_plan.input_sha256['bun.lock'], /^sha256:/);
  assert.match(record.build_plan.input_sha256['package-lock.json'], /^sha256:/);
  const plan = createStandaloneBuildPlan({ sourceSha: record.source_sha, inputSha256: record.build_plan.input_sha256,
    output: record.build_plan.output, routeContract: record.build_plan.route_contract });
  assert.deepEqual(createStandaloneRelease({ buildPlan: plan, imageMetadata: standaloneImageMetadata(plan),
    registryManifestDigest: record.image.digest, runId: record.producer.run_id, runAttempt: record.producer.run_attempt }), record);
  assert.equal(releasePlanDigest(plan), record.build_plan_sha256);
  assert.deepEqual(validateStandaloneRelease(release), release);
});

for (const [label, mutate] of [
  ['floating Bun', (r) => { r.build_plan.package_manager = 'bun@latest'; }],
  ['npm replacement', (r) => { r.build_plan.dependency_lock = 'package-lock.json'; }],
  ['missing Bun input', (r) => { delete r.build_plan.input_sha256['bun.lock']; }],
  ['missing npm reference', (r) => { delete r.build_plan.input_sha256['package-lock.json']; }],
  ['v2 envelope around v3 plan', (r) => { r.schema = 'marty.website-release/v2'; }],
  ['v2 image marker', (r) => { r.image_metadata.schema = 'marty.website-image/v2'; }],
]) {
  test('Bun release rejects ' + label, () => {
    const record = structuredClone(bunFixture.release);
    mutate(record);
    assert.throws(() => validateStandaloneRelease(record));
  });
}

test('the historical v2 shape cannot acquire unsigned Bun identity fields', () => {
  const old = structuredClone(release);
  old.build_plan.package_manager = 'bun@1.4.4';
  assert.throws(() => validateStandaloneRelease(old));
});

for (const [label, mutate] of [
  ['legacy schema', (p) => { p.schema = 'marty.website-build-plan/v1'; }],
  ['application source', (p) => { p.repository = 'ElevenID/marty-ui'; }],
  ['another workflow', (p) => { p.workflow = '.github/workflows/standalone-qualification.yml'; }],
  ['legacy image', (p) => { p.image = 'ghcr.io/elevenid/marty-ui-oss/website'; }],
  ['private pages', (p) => { p.production_pages = 'full'; }],
  ['private source', (p) => { p.commerce_extension = { repository: 'ElevenID/marty-subscriptions', source_sha: 'b'.repeat(40) }; }],
  ['independent revision', (p) => { p.revision = 'next'; }],
  ['nonexact source', (p) => { p.source_sha = 'main'; }],
  ['wrong platform', (p) => { p.platform = 'linux/arm64'; }],
  ['old Dockerfile', (p) => { p.dockerfile = 'docker/ui.Dockerfile'; }],
  ['old build target', (p) => { p.target = 'website'; }],
  ['mutable base', (p) => { p.base_image = 'nginx:latest'; }],
  ['old dependency lock', (p) => { p.dependency_lock = 'ui/package-lock.json'; }],
  ['missing input', (p) => { delete p.input_sha256['package.json']; }],
  ['extra input', (p) => { p.input_sha256['private/extension.jsx'] = 'sha256:' + '0'.repeat(64); }],
  ['malformed input hash', (p) => { p.input_sha256['package-lock.json'] = 'development'; }],
  ['output outside source', (p) => { p.output.directory = '../dist'; }],
  ['boolean count', (p) => { p.output.file_count = true; }],
  ['unbounded output', (p) => { p.output.total_bytes = 512 * 1024 * 1024 + 1; }],
  ['malformed inventory', (p) => { p.output.inventory_sha256 = LOCAL_IMAGE.slice(7); }],
  ['boolean route version', (p) => { p.route_contract.version = true; }],
  ['wrong route build argument', (p) => { p.build_args.WEBSITE_ROUTE_CONTRACT_SHA256 = 'sha256:' + '0'.repeat(64); }],
  ['undeclared build argument', (p) => { p.build_args.MARTY_COMMERCE_SOURCE_SHA = 'b'.repeat(40); }],
]) {
  test('standalone plan rejects ' + label, () => {
    const plan = structuredClone(release.build_plan);
    mutate(plan);
    assert.throws(() => validateStandaloneBuildPlan(plan));
  });
}

for (const [label, mutate] of [
  ['v1 envelope around v2 plan', (r) => { r.schema = 'marty.website-release/v1'; }],
  ['application producer', (r) => { r.producer.repository = 'ElevenID/marty-ui'; }],
  ['another producer source', (r) => { r.producer.source_sha = 'b'.repeat(40); }],
  ['wrong producer ref', (r) => { r.producer.ref = 'refs/heads/feature'; }],
  ['nonexact attempt', (r) => { r.producer.run_attempt = 2; }],
  ['legacy image metadata', (r) => { r.image_metadata.schema = 'marty.website-image/v1'; }],
  ['wrong metadata route', (r) => { r.image_metadata.route_contract.sha256 = 'sha256:' + '0'.repeat(64); }],
  ['tampered build digest', (r) => { r.build_plan_sha256 = 'sha256:' + '0'.repeat(64); }],
  ['private registry coordinate', (r) => { r.image.uri = 'ghcr.io/elevenid/marty-subscriptions/website'; }],
  ['qualification impersonating publication', (r) => { r.local_image_id = r.image.digest; r.registry_published = false; }],
]) {
  test('standalone receipt rejects ' + label, () => {
    const record = structuredClone(release);
    mutate(record);
    assert.throws(() => validateStandaloneRelease(record));
  });
}

function put(root, name, bytes) {
  mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
  writeFileSync(path.join(root, name), bytes);
}
function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
  }).trim();
}
function qualifiedFixture(t, { platform = 'linux/amd64', symlink = false, omitStage } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'website-release-contract-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  put(root, '.gitignore', '.qualification/\nui/dist-website/\n');
  for (const name of STANDALONE_INPUT_PATHS) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    copyFileSync(path.join(repository, name), path.join(root, name));
  }
  if (symlink) {
    rmSync(path.join(root, 'ui/vite.config.mjs'));
    symlinkSync('../package.json', path.join(root, 'ui/vite.config.mjs'));
  }
  git(root, 'init', '--quiet', '--initial-branch=main');
  git(root, 'add', '.');
  git(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Synthetic fixture source');
  const sourceSha = git(root, 'rev-parse', 'HEAD');
  const options = { root, sourceSha, workflow: null };
  const metadata = websiteReleaseMetadata({ sourceSha });
  put(root, 'ui/dist-website/marty-website-release.json', JSON.stringify(metadata) + '\n');
  put(root, 'ui/dist-website/index.html', '<h1>Synthetic contract fixture</h1>\n');
  const identity = { source_sha: sourceSha, revision: sourceSha };
  const image = { ...identity, image: 'elevenid-website:' + sourceSha, local_image_id: LOCAL_IMAGE };
  const stages = {
    prerender: { ...identity, qualified: 'website-production-prerender', route_count: 1, pages: 1,
      canonical_count: 1, sitemap_count: 1, readiness: { signal: 1, 'app-ready-fallback': 0, timeout: 0 } },
    'output-verification': { ...identity, qualified: 'website-production-prerender-verification', routes: 1,
      canonical_urls: 1, unique_titles: 1, public_assets: 1 },
    'image-build': { ...image, qualified: 'website-static-container-build', platform,
      route_contract_sha256: metadata.route_contract.sha256, registry_published: false },
    nginx: { ...image, qualified: 'production-website-image', route_count: 1, resource_checks: 1, denied_route_checks: 1 },
  };
  prepareQualificationEvidence(options);
  for (const [stage, result] of Object.entries(stages)) {
    if (stage !== omitStage) writeQualificationReceipt({ ...options, stage, result });
  }
  return options;
}

test('the plan binds clean source inputs and current qualified output without inventing registry evidence', (t) => {
  const options = qualifiedFixture(t);
  const plan = standalonePlanFromQualification(options);
  assert.equal(plan.source_sha, options.sourceSha);
  for (const name of STANDALONE_INPUT_PATHS) assert.equal(plan.input_sha256[name], hash(readFileSync(path.join(options.root, name))));
  const evidence = JSON.parse(readFileSync(path.join(options.root, '.qualification/website-qualification.json'), 'utf8'));
  assert.equal(plan.output.inventory_sha256, evidence.output.sha256);
  assert.equal(evidence.local_image_id, LOCAL_IMAGE);
  assert.equal(evidence.registry_published, false);
  assert.equal(evidence.cryptographic_provenance_verified, false);
  assert.equal('digest' in plan, false);
  assert.equal('producer' in plan, false);
  put(options.root, 'ui/dist-website/index.html', '<h1>Changed after qualification</h1>\n');
  assert.throws(() => standalonePlanFromQualification(options), /receipt differs/);
});

test('the plan requires every qualification stage and the correct inspected image platform', (t) => {
  assert.throws(() => standalonePlanFromQualification(qualifiedFixture(t, { omitStage: 'nginx' })), /ENOENT/);
  assert.throws(() => standalonePlanFromQualification(qualifiedFixture(t, { platform: 'linux/arm64' })), /platform differs/);
});

test('a tracked source symlink cannot enter the release plan', (t) => {
  assert.throws(() => standalonePlanFromQualification(qualifiedFixture(t, { symlink: true })), /symlinks/);
});

test('unsigned qualification cannot be accepted as a v2 release receipt', (t) => {
  const options = qualifiedFixture(t);
  standalonePlanFromQualification(options);
  const evidence = JSON.parse(readFileSync(path.join(options.root, '.qualification/website-qualification.json'), 'utf8'));
  assert.throws(() => validateStandaloneRelease(evidence), /fields differ/);
});
