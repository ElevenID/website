import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  FULL_STANDALONE_INPUT_PATHS, fullStandalonePlanDigest, fullStandalonePlanFromQualification,
  validateFullStandaloneBuildPlan, validateFullStandaloneRelease,
} from '../../scripts/lib/full-standalone-release-contract.mjs';
import { canonicalReleaseJson, validateStandaloneRelease } from '../../scripts/lib/standalone-release-contract.mjs';
import {
  finalizeQualificationEvidence, prepareQualificationEvidence, qualificationWorkflowFromEnvironment,
  writeQualificationReceipt,
} from '../../scripts/lib/qualification-evidence.mjs';
import { websiteReleaseMetadata } from '../../ui/scripts/web-surface-build-contract.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const fixture = JSON.parse(readFileSync(new URL('../../contracts/fixtures/standalone-website-release-v4.json', import.meta.url)));
const record = fixture.release;
const COMMERCE = 'b'.repeat(40);
const LOCAL_IMAGE = 'sha256:' + 'd'.repeat(64);
const hash = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

test('the shared v4 fixture binds the standalone source to the original private authority', () => {
  assert.equal(fixture.purpose, 'synthetic-contract-fixture-not-release-evidence');
  assert.deepEqual(validateFullStandaloneRelease(record), record);
  assert.equal(fullStandalonePlanDigest(record.build_plan), 'sha256:fb9a0fe427f40dc89a700e1b9ac4ac1bffe0f116bc53348465d54755f7185831');
  assert.equal(record.producer.source_sha, record.commerce_extension.source_sha);
  assert.notEqual(record.producer.source_sha, record.source_sha);
  assert.equal(record.producer.repository, 'ElevenID/marty-subscriptions');
  assert.equal(record.build_plan.repository, 'ElevenID/website');
  assert.equal(record.build_plan.package_manager, 'bun@1.4.4');
  assert.equal(record.build_plan.dependency_lock, 'bun.lock');
  assert.deepEqual(record.image_metadata, websiteReleaseMetadata({ sourceSha: record.source_sha, pages: 'full', commerceSha: COMMERCE }));
  assert.equal(hash(canonicalReleaseJson(record.build_plan)), record.build_plan_sha256);
  assert.throws(() => validateStandaloneRelease(record), /Unsupported standalone plan schema/);
  for (const version of [2, 3]) {
    const historical = JSON.parse(readFileSync(path.join(repository, `contracts/fixtures/standalone-website-release-v${version}.json`))).release;
    assert.deepEqual(validateStandaloneRelease(historical), historical);
    assert.throws(() => validateFullStandaloneRelease(historical));
  }
});

for (const [label, change] of [
  ['public audience', (r) => { r.production_pages = 'public'; }],
  ['public signing authority', (r) => { r.producer.repository = 'ElevenID/website'; }],
  ['public workflow', (r) => { r.producer.workflow = '.github/workflows/production-website-release.yml'; }],
  ['website SHA used as producer SHA', (r) => { r.producer.source_sha = r.source_sha; }],
  ['another private source', (r) => { r.commerce_extension.source_sha = 'f'.repeat(40); }],
  ['missing private identity', (r) => { r.commerce_extension = null; }],
  ['unrelated private owner', (r) => { r.build_plan.commerce_extension.repository = 'other/private'; }],
  ['public image relabeled as full', (r) => { r.image.uri = 'ghcr.io/elevenid/website'; }],
  ['legacy image marker', (r) => { r.image_metadata.schema = 'marty.website-image/v1'; }],
  ['public receipt envelope', (r) => { r.schema = 'marty.website-release/v3'; }],
  ['public plan relabeled as full', (r) => { r.build_plan.schema = 'marty.website-build-plan/v3'; }],
  ['independent revision', (r) => { r.revision = r.source_sha; }],
  ['non-main producer', (r) => { r.producer.ref = 'refs/heads/feature'; }],
  ['inexact attempt', (r) => { r.producer.run_attempt = 2; }],
  ['newline in run', (r) => { r.producer.run_id += '\r'; }],
  ['floating website source', (r) => { r.build_plan.source_sha = 'main'; }],
  ['newline in private source', (r) => { r.build_plan.commerce_extension.source_sha += '\n'; }],
  ['unrelated build argument', (r) => { r.build_plan.build_args.PRIVATE_TOKEN = 'undeclared'; }],
  ['changed commerce argument', (r) => { r.build_plan.build_args.COMMERCE_SOURCE_SHA = 'f'.repeat(40); }],
  ['public Dockerfile', (r) => { r.build_plan.dockerfile = 'Dockerfile.website'; }],
  ['missing adapter fingerprint', (r) => { delete r.build_plan.input_sha256['ui/scripts/production-build-contract.mjs']; }],
  ['private source file in public inputs', (r) => { r.build_plan.input_sha256['private/src/website.jsx'] = LOCAL_IMAGE; }],
  ['npm replacing Bun', (r) => { r.build_plan.dependency_lock = 'package-lock.json'; }],
  ['mutable Bun', (r) => { r.build_plan.package_manager = 'bun@latest'; }],
  ['mutable base image', (r) => { r.build_plan.base_image = 'nginx:latest'; }],
  ['other platform', (r) => { r.image.platform = 'linux/arm64'; }],
  ['unbounded output', (r) => { r.build_plan.output.total_bytes = 512 * 1024 * 1024 + 1; }],
  ['false file count', (r) => { r.build_plan.output.file_count = true; }],
  ['output outside website', (r) => { r.build_plan.output.directory = '../private'; }],
  ['changed route identity', (r) => { r.image_metadata.route_contract.sha256 = LOCAL_IMAGE; }],
  ['forged plan hash', (r) => { r.build_plan_sha256 = LOCAL_IMAGE; }],
  ['qualification claiming publication', (r) => { r.registry_published = true; }],
]) {
  test('full receipt rejects ' + label, () => {
    const changed = structuredClone(record); change(changed);
    assert.throws(() => validateFullStandaloneRelease(changed));
  });
}

function put(root, name, bytes) {
  mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
  writeFileSync(path.join(root, name), bytes);
}
function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } }).trim();
}
function qualifiedFixture(t, { omitStage, platform = 'linux/amd64' } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'full-website-contract-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  put(root, '.gitignore', '.qualification/\nui/dist-website/\n');
  for (const name of FULL_STANDALONE_INPUT_PATHS) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    copyFileSync(path.join(repository, name), path.join(root, name));
  }
  git(root, 'init', '--quiet', '--initial-branch=main');
  git(root, 'add', '.');
  git(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Synthetic full source');
  const sourceSha = git(root, 'rev-parse', 'HEAD');
  const options = { root, sourceSha, pages: 'full', commerceSha: COMMERCE, workflow: null };
  const marker = websiteReleaseMetadata(options);
  const identity = { source_sha: sourceSha, revision: marker.revision };
  put(root, 'ui/dist-website/marty-website-release.json', JSON.stringify(marker) + '\n');
  put(root, 'ui/dist-website/index.html', '<h1>Synthetic full qualification</h1>\n');
  const image = { ...identity, image: 'elevenid-website:' + marker.revision, local_image_id: LOCAL_IMAGE };
  const stages = {
    prerender: { ...identity, qualified: 'website-production-prerender', route_count: 1, pages: 1,
      canonical_count: 1, sitemap_count: 1, readiness: { signal: 1, 'app-ready-fallback': 0, timeout: 0 } },
    'output-verification': { ...identity, qualified: 'website-production-prerender-verification', routes: 1,
      canonical_urls: 1, unique_titles: 1, public_assets: 1 },
    'image-build': { ...image, qualified: 'website-static-container-build', platform,
      route_contract_sha256: marker.route_contract.sha256, registry_published: false },
    nginx: { ...image, qualified: 'production-website-image', route_count: 1, resource_checks: 1, denied_route_checks: 1 },
  };
  prepareQualificationEvidence(options);
  for (const [stage, result] of Object.entries(stages)) {
    if (stage !== omitStage) writeQualificationReceipt({ ...options, stage, result });
  }
  return options;
}

test('full qualification binds both sources and the same final bytes through every stage', (t) => {
  const options = qualifiedFixture(t);
  const plan = fullStandalonePlanFromQualification(options);
  assert.deepEqual(validateFullStandaloneBuildPlan(plan), plan);
  for (const name of FULL_STANDALONE_INPUT_PATHS) assert.equal(plan.input_sha256[name], hash(readFileSync(path.join(options.root, name))));
  const evidence = finalizeQualificationEvidence(options);
  assert.equal(evidence.schema, 'marty.website-qualification/v2');
  assert.equal(evidence.revision, `${options.sourceSha}-${COMMERCE}`);
  assert.equal(evidence.commerce_extension.source_sha, COMMERCE);
  assert.equal(evidence.registry_published, false);
  assert.equal(evidence.cryptographic_provenance_verified, false);
  assert.throws(() => validateFullStandaloneRelease(evidence));
  assert.throws(() => fullStandalonePlanFromQualification({ ...options, commerceSha: 'c'.repeat(40) }), /context differs/);
  assert.throws(() => finalizeQualificationEvidence({ ...options, pages: 'public', commerceSha: undefined }));
  put(options.root, 'ui/dist-website/index.html', '<h1>Changed after qualification</h1>');
  assert.throws(() => fullStandalonePlanFromQualification(options), /receipt differs/);
});

test('full qualification requires all stages and the selected architecture', (t) => {
  assert.throws(() => fullStandalonePlanFromQualification(qualifiedFixture(t, { omitStage: 'nginx' })), /ENOENT/);
  assert.throws(() => fullStandalonePlanFromQualification(qualifiedFixture(t, { platform: 'linux/arm64' })), /platform differs/);
});

test('full evidence cannot contain raw source, maps or the staged private identity file', (t) => {
  const options = qualifiedFixture(t);
  for (const name of ['assets/private.js.map', 'src/website.jsx', 'src/terms.ts', 'commerce-source.json', '.env']) {
    put(options.root, 'ui/dist-website/' + name, 'private-source-sentinel');
    assert.throws(() => finalizeQualificationEvidence(options), /cannot contain/);
    rmSync(path.join(options.root, 'ui/dist-website', name));
  }
});

test('full qualification captures only the original private workflow and exact selected private SHA', () => {
  const env = {
    GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'ElevenID/marty-subscriptions', GITHUB_REPOSITORY_ID: '1207411806',
    GITHUB_WORKFLOW_REF: 'ElevenID/marty-subscriptions/.github/workflows/production-ui-release.yml@refs/heads/main',
    GITHUB_SHA: COMMERCE, GITHUB_WORKFLOW_SHA: COMMERCE, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main',
    GITHUB_RUN_ID: '123456', GITHUB_RUN_ATTEMPT: '1', MARTY_PRODUCTION_PAGES: 'full', MARTY_COMMERCE_SOURCE_SHA: COMMERCE,
  };
  assert.equal(qualificationWorkflowFromEnvironment(env).workflow_sha, COMMERCE);
  for (const patch of [
    { GITHUB_REPOSITORY: 'ElevenID/website' }, { GITHUB_WORKFLOW_SHA: 'a'.repeat(40) },
    { GITHUB_SHA: 'a'.repeat(40) }, { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REF: 'refs/heads/feature' },
    { MARTY_PRODUCTION_PAGES: 'public', MARTY_COMMERCE_SOURCE_SHA: undefined },
  ]) assert.throws(() => qualificationWorkflowFromEnvironment({ ...env, ...patch }));
});

test('the full receipt CLI validates only v4 and refuses local unsigned recording as a private producer', (t) => {
  const cli = path.join(repository, 'scripts/full-website-release-contract.mjs');
  const directory = mkdtempSync(path.join(os.tmpdir(), 'full-website-receipt-cli-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const receipt = path.join(directory, 'website-release.json');
  writeFileSync(receipt, canonicalReleaseJson(record));
  assert.match(execFileSync(process.execPath, [cli, 'validate', '--receipt', receipt], { encoding: 'utf8' }), /contract is valid/);
  const filename = path.join(repository, 'contracts/fixtures/standalone-website-release-v4.json');
  // The wrapper is deliberately not a receipt; factories above provide the
  // fixture contract without granting it any producer authority.
  assert.throws(() => execFileSync(process.execPath, [cli, 'validate', '--receipt', filename], { stdio: 'pipe' }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GITHUB_|^RUNNER_/.test(key)));
  Object.assign(env, { MARTY_WEBSITE_SOURCE_SHA: 'a'.repeat(40), MARTY_PRODUCTION_PAGES: 'full', MARTY_COMMERCE_SOURCE_SHA: COMMERCE });
  assert.throws(() => execFileSync(process.execPath, [cli, 'record', '--image-digest', record.image.digest,
    '--run-id', '123456', '--run-attempt', '1', '--output', path.join(directory, 'not-produced.json')], { env, stdio: 'pipe' }),
  (error) => /original private producer context/.test(error.stderr.toString()));
});
