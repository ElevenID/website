// The standalone public producer contract. These functions construct data only;
// signatures, original workflow attestations and OCI verification remain required.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { assertWebsiteSource, finalizeQualificationEvidence } from './qualification-evidence.mjs';
import { parseBunLock, verifyPackageManager } from './package-manager.mjs';

export const STANDALONE_REPOSITORY = 'ElevenID/website';
export const STANDALONE_REPOSITORY_ID = '1459542519';
export const STANDALONE_WORKFLOW = '.github/workflows/production-website-release.yml';
export const STANDALONE_IMAGE = 'ghcr.io/elevenid/website';
export const STANDALONE_REF = 'refs/heads/main';
export const STANDALONE_BASE_IMAGE = 'nginx:1.29.1-alpine@sha256:42a516af16b852e33b7682d5ef8acbd5d13fe08fecadc7ed98605ba5e3b26ab8';
export const LEGACY_STANDALONE_INPUT_PATHS = Object.freeze([
  'package.json', 'package-lock.json', 'Dockerfile.website', 'contracts/web-surface-routes.json',
  'scripts/build-website-image.mjs', 'scripts/prerender-website.mjs', 'scripts/website-prerender-plan.mjs',
  'ui/nginx.website.conf', 'ui/nginx.website.headers.conf', 'ui/scripts/render-website-nginx.mjs',
  'ui/vite.config.mjs',
]);
export const STANDALONE_INPUT_PATHS = Object.freeze([...LEGACY_STANDALONE_INPUT_PATHS, 'bun.lock']);
export const STANDALONE_PACKAGE_MANAGER = 'bun@1.4.4';
const PLAN_FIELDS = [
  'schema', 'repository', 'source_sha', 'revision', 'production_pages', 'commerce_extension',
  'workflow', 'image', 'platform', 'dockerfile', 'build_kind', 'dependency_lock',
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
function digest(value, label) { assert.match(value || '', DIGEST, label + ' requires a SHA-256 digest'); return value; }
function sha(value) { assert.match(value || '', SHA, 'An exact standalone source SHA is required'); return value; }
function hash(bytes) { return 'sha256:' + createHash('sha256').update(bytes).digest('hex'); }
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
  return value;
}

// The closed contract contains ASCII keys and values. This matches the existing
// Python consumer's json.dumps(sort_keys=True, indent=2) + newline byte for byte.
export function canonicalReleaseJson(value) { return JSON.stringify(sorted(value), null, 2) + '\n'; }
export function releasePlanDigest(value) { return hash(canonicalReleaseJson(validateStandaloneBuildPlan(value))); }

function routeIdentity(value) {
  keys(value, ['version', 'sha256'], 'Route identity');
  assert.equal(value.version, 1, 'Unsupported route contract version');
  digest(value.sha256, 'Route contract');
}
function contractVersion(schema) {
  assert.ok(['marty.website-build-plan/v2', 'marty.website-build-plan/v3'].includes(schema), 'Unsupported standalone plan schema');
  return schema === 'marty.website-build-plan/v3' ? 3 : 2;
}
function validateInputs(inputSha256, output, routeContract, version) {
  const inputs = version === 3 ? STANDALONE_INPUT_PATHS : LEGACY_STANDALONE_INPUT_PATHS;
  keys(inputSha256, inputs, 'Standalone source inputs');
  for (const filename of inputs) digest(inputSha256[filename], filename);
  keys(output, ['directory', 'inventory_sha256', 'file_count', 'total_bytes'], 'Standalone output');
  assert.equal(output.directory, 'ui/dist-website');
  digest(output.inventory_sha256, 'Output inventory');
  for (const [name, maximum] of [['file_count', 10000], ['total_bytes', 512 * 1024 * 1024]]) {
    assert.ok(Number.isSafeInteger(output[name]) && output[name] > 0 && output[name] <= maximum,
      'Invalid output ' + name);
  }
  routeIdentity(routeContract);
}

export function createStandaloneBuildPlan({ sourceSha, inputSha256, output, routeContract, version = 3 }) {
  sha(sourceSha);
  assert.ok(version === 2 || version === 3, 'Unsupported standalone plan version');
  validateInputs(inputSha256, output, routeContract, version);
  return {
    schema: `marty.website-build-plan/v${version}`, repository: STANDALONE_REPOSITORY,
    source_sha: sourceSha, revision: sourceSha, production_pages: 'public', commerce_extension: null,
    workflow: STANDALONE_WORKFLOW, image: STANDALONE_IMAGE, platform: 'linux/amd64',
    dockerfile: 'Dockerfile.website', build_kind: 'prebuilt-static',
    dependency_lock: version === 3 ? 'bun.lock' : 'package-lock.json',
    ...(version === 3 ? { package_manager: STANDALONE_PACKAGE_MANAGER } : {}),
    input_sha256: structuredClone(inputSha256), output: structuredClone(output), base_image: STANDALONE_BASE_IMAGE,
    route_contract: structuredClone(routeContract),
    build_args: { WEBSITE_SOURCE_SHA: sourceSha, WEBSITE_REVISION: sourceSha,
      WEBSITE_ROUTE_CONTRACT_SHA256: routeContract.sha256 },
  };
}

export function validateStandaloneBuildPlan(value) {
  const version = contractVersion(value?.schema);
  keys(value, version === 3 ? [...PLAN_FIELDS, 'package_manager'] : PLAN_FIELDS, 'Standalone build plan');
  assert.deepEqual(value, createStandaloneBuildPlan({ sourceSha: value.source_sha,
    inputSha256: value.input_sha256, output: value.output, routeContract: value.route_contract, version }),
  'Standalone build identity differs');
  return value;
}

export function standaloneImageMetadata(buildPlan) {
  const plan = validateStandaloneBuildPlan(buildPlan);
  return {
    schema: `marty.website-image/v${contractVersion(plan.schema)}`, audience: 'production', surface: 'website',
    repository: STANDALONE_REPOSITORY, source_sha: plan.source_sha, revision: plan.revision,
    production_pages: 'public', route_contract: structuredClone(plan.route_contract), commerce_extension: null,
  };
}

export function standaloneProducer({ sourceSha, runId, runAttempt }) {
  sha(sourceSha);
  assert.match(runId || '', RUN, 'An exact producer run is required');
  assert.match(runAttempt || '', RUN, 'An exact producer attempt is required');
  return { repository: STANDALONE_REPOSITORY, workflow: STANDALONE_WORKFLOW,
    source_sha: sourceSha, ref: STANDALONE_REF, run_id: runId, run_attempt: runAttempt };
}

/** Construct an unsigned receipt subject; this does not publish or authenticate it.
 * registryManifestDigest must come from the publisher's verified registry operation,
 * never docker inspect's local image/config Id. Consumers verify the actual OCI
 * manifest and both original signatures before admitting this object.
 */
export function createStandaloneRelease({ buildPlan, imageMetadata, registryManifestDigest, runId, runAttempt }) {
  validateStandaloneBuildPlan(buildPlan);
  assert.deepEqual(imageMetadata, standaloneImageMetadata(buildPlan), 'Standalone image metadata differs');
  return {
    schema: `marty.website-release/v${contractVersion(buildPlan.schema)}`, source_sha: buildPlan.source_sha, revision: buildPlan.revision,
    production_pages: 'public', commerce_extension: null,
    producer: standaloneProducer({ sourceSha: buildPlan.source_sha, runId, runAttempt }),
    image: { uri: STANDALONE_IMAGE, digest: digest(registryManifestDigest, 'Registry manifest'), platform: 'linux/amd64' },
    build_plan: structuredClone(buildPlan), build_plan_sha256: releasePlanDigest(buildPlan),
    image_metadata: structuredClone(imageMetadata),
  };
}

export function validateStandaloneRelease(value) {
  keys(value, RELEASE_FIELDS, 'Standalone release');
  keys(value.producer, ['repository', 'workflow', 'source_sha', 'ref', 'run_id', 'run_attempt'], 'Standalone producer');
  keys(value.image, ['uri', 'digest', 'platform'], 'Standalone image');
  assert.deepEqual(value, createStandaloneRelease({ buildPlan: value.build_plan, imageMetadata: value.image_metadata,
    registryManifestDigest: value.image.digest, runId: value.producer.run_id, runAttempt: value.producer.run_attempt }),
  'Standalone release differs from its build and original producer');
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

/** Bind a plan to the clean source and the still-present, fully qualified output.
 * The existing unsigned qualification remains unsigned. No release receipt is
 * emitted from it and no registry digest is inferred from its local_image_id.
 */
export function standalonePlanFromQualification(options) {
  const root = realpathSync(options.root);
  assertWebsiteSource(options);
  verifyPackageManager({ manifest: JSON.parse(sourceBytes(root, 'package.json')),
    npmLock: JSON.parse(sourceBytes(root, 'package-lock.json')),
    bunLock: parseBunLock(sourceBytes(root, 'bun.lock').toString('utf8')) });
  const evidence = finalizeQualificationEvidence(options);
  assert.equal(evidence.results['image-build'].platform, 'linux/amd64',
    'Qualified image platform differs from the standalone release contract');
  const inputSha256 = Object.fromEntries(STANDALONE_INPUT_PATHS.map((filename) => [filename, hash(sourceBytes(root, filename))]));
  assert.equal(sourceBytes(root, 'Dockerfile.website').toString('utf8').split(/\r?\n/)[0],
    'FROM ' + STANDALONE_BASE_IMAGE, 'Pinned website base differs from the release contract');
  const metadata = JSON.parse(sourceBytes(root, 'ui/dist-website/marty-website-release.json').toString('utf8'));
  const plan = createStandaloneBuildPlan({ sourceSha: options.sourceSha, inputSha256,
    output: { directory: 'ui/dist-website', inventory_sha256: evidence.output.sha256,
      file_count: evidence.output.file_count, total_bytes: evidence.output.total_bytes },
    routeContract: metadata.route_contract });
  assert.deepEqual(metadata, standaloneImageMetadata(plan), 'Qualified image metadata differs from release plan');
  assertWebsiteSource(options);
  return plan;
}
