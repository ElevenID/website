// Full standalone output has a website source and an independent private
// producer. These closed declarations never replace original signed evidence.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { assertWebsiteSource, finalizeQualificationEvidence } from './qualification-evidence.mjs';
import { parseBunLock, verifyPackageManager } from './package-manager.mjs';
import {
  STANDALONE_BASE_IMAGE, STANDALONE_INPUT_PATHS, STANDALONE_PACKAGE_MANAGER,
  STANDALONE_REPOSITORY, canonicalReleaseJson,
} from './standalone-release-contract.mjs';

export const FULL_STANDALONE_REPOSITORY = 'ElevenID/marty-subscriptions';
export const FULL_STANDALONE_REPOSITORY_ID = '1207411806';
export const FULL_STANDALONE_WORKFLOW = '.github/workflows/production-ui-release.yml';
export const FULL_STANDALONE_REF = 'refs/heads/main';
export const FULL_STANDALONE_IMAGE = 'ghcr.io/elevenid/marty-subscriptions/website';
export const FULL_STANDALONE_INPUT_PATHS = Object.freeze([
  ...STANDALONE_INPUT_PATHS.map((name) => name === 'Dockerfile.website' ? 'Dockerfile.website.full' : name),
  'ui/scripts/production-build-contract.mjs', 'ui/scripts/web-surface-build-contract.mjs',
]);
const PLAN_FIELDS = [
  'schema', 'repository', 'source_sha', 'revision', 'production_pages', 'commerce_extension',
  'workflow', 'image', 'platform', 'dockerfile', 'build_kind', 'dependency_lock', 'package_manager',
  'input_sha256', 'output', 'base_image', 'route_contract', 'build_args',
];
const RELEASE_FIELDS = [
  'schema', 'source_sha', 'revision', 'production_pages', 'commerce_extension', 'producer',
  'image', 'build_plan', 'build_plan_sha256', 'image_metadata',
];
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const RUN = /^[1-9][0-9]*$/;
function keys(value, expected, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label + ' fields differ');
}
function sha(value, label) {
  assert.equal(typeof value, 'string', label + ' requires an exact source SHA');
  assert.equal(value.length, 40, label + ' requires an exact source SHA');
  assert.match(value, SHA, label + ' requires an exact source SHA');
  return value;
}
function digest(value, label) {
  assert.equal(typeof value, 'string', label + ' requires a SHA-256 digest');
  assert.equal(value.length, 71, label + ' requires a SHA-256 digest');
  assert.match(value, DIGEST, label + ' requires a SHA-256 digest');
  return value;
}
const hash = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

export function createFullStandaloneBuildPlan({ sourceSha, commerceSha, inputSha256, output, routeContract }) {
  sha(sourceSha, 'Website');
  sha(commerceSha, 'Private producer');
  keys(inputSha256, FULL_STANDALONE_INPUT_PATHS, 'Full standalone source inputs');
  for (const filename of FULL_STANDALONE_INPUT_PATHS) digest(inputSha256[filename], filename);
  keys(output, ['directory', 'inventory_sha256', 'file_count', 'total_bytes'], 'Full standalone output');
  assert.equal(output.directory, 'ui/dist-website');
  digest(output.inventory_sha256, 'Output inventory');
  for (const [name, maximum] of [['file_count', 10000], ['total_bytes', 512 * 1024 * 1024]]) {
    assert.ok(Number.isSafeInteger(output[name]) && output[name] > 0 && output[name] <= maximum,
      'Invalid output ' + name);
  }
  keys(routeContract, ['version', 'sha256'], 'Route identity');
  assert.equal(routeContract.version, 1, 'Unsupported route contract version');
  digest(routeContract.sha256, 'Route contract');
  const revision = `${sourceSha}-${commerceSha}`;
  return {
    schema: 'marty.website-build-plan/v4', repository: STANDALONE_REPOSITORY,
    source_sha: sourceSha, revision, production_pages: 'full',
    commerce_extension: { repository: FULL_STANDALONE_REPOSITORY, source_sha: commerceSha },
    workflow: FULL_STANDALONE_WORKFLOW, image: FULL_STANDALONE_IMAGE, platform: 'linux/amd64',
    dockerfile: 'Dockerfile.website.full', build_kind: 'prebuilt-static',
    dependency_lock: 'bun.lock', package_manager: STANDALONE_PACKAGE_MANAGER,
    input_sha256: structuredClone(inputSha256), output: structuredClone(output), base_image: STANDALONE_BASE_IMAGE,
    route_contract: structuredClone(routeContract),
    build_args: { WEBSITE_SOURCE_SHA: sourceSha, WEBSITE_REVISION: revision,
      WEBSITE_ROUTE_CONTRACT_SHA256: routeContract.sha256, COMMERCE_SOURCE_SHA: commerceSha },
  };
}

export function validateFullStandaloneBuildPlan(value) {
  keys(value, PLAN_FIELDS, 'Full standalone build plan');
  keys(value.commerce_extension, ['repository', 'source_sha'], 'Private source identity');
  assert.deepEqual(value, createFullStandaloneBuildPlan({ sourceSha: value.source_sha,
    commerceSha: value.commerce_extension.source_sha, inputSha256: value.input_sha256,
    output: value.output, routeContract: value.route_contract }), 'Full standalone build identity differs');
  return value;
}

export function fullStandalonePlanDigest(value) {
  return hash(canonicalReleaseJson(validateFullStandaloneBuildPlan(value)));
}

export function fullStandaloneImageMetadata(buildPlan) {
  const plan = validateFullStandaloneBuildPlan(buildPlan);
  return {
    schema: 'marty.website-image/v4', audience: 'production', surface: 'website',
    repository: STANDALONE_REPOSITORY, source_sha: plan.source_sha, revision: plan.revision,
    production_pages: 'full', route_contract: structuredClone(plan.route_contract),
    commerce_extension: structuredClone(plan.commerce_extension),
  };
}

export function fullStandaloneProducer({ commerceSha, runId, runAttempt }) {
  sha(commerceSha, 'Private producer');
  for (const value of [runId, runAttempt]) {
    assert.equal(typeof value, 'string', 'An exact original private run and attempt are required');
    assert.match(value, RUN, 'An exact original private run and attempt are required');
    assert.ok(!/[\r\n]/.test(value), 'An exact original private run and attempt are required');
  }
  return { repository: FULL_STANDALONE_REPOSITORY, workflow: FULL_STANDALONE_WORKFLOW,
    source_sha: commerceSha, ref: FULL_STANDALONE_REF, run_id: runId, run_attempt: runAttempt };
}

/** Unsigned subject only. The private original producer must scan the final
 * image, publish that exact image, sign/attest it and retain verified proofs. */
export function createFullStandaloneRelease({ buildPlan, imageMetadata, registryManifestDigest, runId, runAttempt }) {
  validateFullStandaloneBuildPlan(buildPlan);
  assert.deepEqual(imageMetadata, fullStandaloneImageMetadata(buildPlan), 'Full standalone image metadata differs');
  return {
    schema: 'marty.website-release/v4', source_sha: buildPlan.source_sha, revision: buildPlan.revision,
    production_pages: 'full', commerce_extension: structuredClone(buildPlan.commerce_extension),
    producer: fullStandaloneProducer({ commerceSha: buildPlan.commerce_extension.source_sha, runId, runAttempt }),
    image: { uri: FULL_STANDALONE_IMAGE, digest: digest(registryManifestDigest, 'Registry manifest'), platform: 'linux/amd64' },
    build_plan: structuredClone(buildPlan), build_plan_sha256: fullStandalonePlanDigest(buildPlan),
    image_metadata: structuredClone(imageMetadata),
  };
}

export function validateFullStandaloneRelease(value) {
  keys(value, RELEASE_FIELDS, 'Full standalone release');
  keys(value.producer, ['repository', 'workflow', 'source_sha', 'ref', 'run_id', 'run_attempt'], 'Private producer');
  keys(value.image, ['uri', 'digest', 'platform'], 'Full standalone image');
  assert.deepEqual(value, createFullStandaloneRelease({ buildPlan: value.build_plan, imageMetadata: value.image_metadata,
    registryManifestDigest: value.image.digest, runId: value.producer.run_id, runAttempt: value.producer.run_attempt }),
  'Full standalone release differs from its build and original private producer');
  return value;
}

function sourceBytes(root, filename) {
  let current = root;
  for (const segment of filename.split('/')) {
    current = path.join(current, segment);
    assert.ok(!lstatSync(current).isSymbolicLink(), 'Release input cannot contain symlinks: ' + filename);
  }
  const stat = lstatSync(current);
  assert.ok(stat.isFile() && stat.size <= 64 * 1024 * 1024, 'Invalid release input: ' + filename);
  return readFileSync(current);
}

export function fullStandalonePlanFromQualification(options) {
  const root = realpathSync(options.root);
  assertWebsiteSource(options);
  assert.equal(options.pages, 'full', 'Full qualification must explicitly select its audience');
  sha(options.commerceSha, 'Private producer');
  verifyPackageManager({ manifest: JSON.parse(sourceBytes(root, 'package.json')),
    npmLock: JSON.parse(sourceBytes(root, 'package-lock.json')),
    bunLock: parseBunLock(sourceBytes(root, 'bun.lock').toString('utf8')) });
  const evidence = finalizeQualificationEvidence(options);
  assert.equal(evidence.production_pages, 'full');
  assert.deepEqual(evidence.commerce_extension,
    { repository: FULL_STANDALONE_REPOSITORY, source_sha: options.commerceSha });
  assert.equal(evidence.results['image-build'].platform, 'linux/amd64', 'Qualified image platform differs');
  const inputSha256 = Object.fromEntries(FULL_STANDALONE_INPUT_PATHS.map((filename) => [filename, hash(sourceBytes(root, filename))]));
  assert.equal(sourceBytes(root, 'Dockerfile.website.full').toString('utf8').split(/\r?\n/)[0],
    'FROM ' + STANDALONE_BASE_IMAGE, 'Pinned full website base differs');
  const metadata = JSON.parse(sourceBytes(root, 'ui/dist-website/marty-website-release.json'));
  const plan = createFullStandaloneBuildPlan({ sourceSha: options.sourceSha, commerceSha: options.commerceSha, inputSha256,
    output: { directory: 'ui/dist-website', inventory_sha256: evidence.output.sha256,
      file_count: evidence.output.file_count, total_bytes: evidence.output.total_bytes }, routeContract: metadata.route_contract });
  assert.deepEqual(metadata, fullStandaloneImageMetadata(plan), 'Qualified full image metadata differs from release plan');
  assertWebsiteSource(options);
  return plan;
}
