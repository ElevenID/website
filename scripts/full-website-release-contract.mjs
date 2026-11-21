// Read-only planning/validation and unsigned recording. This command never
// publishes, signs, attests, or admits a release.
import assert from 'node:assert/strict';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { websiteBuildSelection } from '../ui/scripts/web-surface-build-contract.mjs';
import { canonicalReleaseJson } from './lib/standalone-release-contract.mjs';
import { finalizeQualificationEvidence, qualificationWorkflowFromEnvironment } from './lib/qualification-evidence.mjs';
import {
  FULL_STANDALONE_REF, FULL_STANDALONE_REPOSITORY, FULL_STANDALONE_REPOSITORY_ID, FULL_STANDALONE_WORKFLOW,
  createFullStandaloneRelease, fullStandaloneImageMetadata, fullStandalonePlanFromQualification, validateFullStandaloneRelease,
} from './lib/full-standalone-release-contract.mjs';

const usage = 'Usage: full-website-release-contract.mjs plan | validate --receipt ABSOLUTE_PATH | '
  + 'record --image-digest SHA256 --run-id RUN --run-attempt ATTEMPT --output ABSOLUTE_PATH';
const [operation, ...args] = process.argv.slice(2);
function argumentsFor(names) {
  assert.equal(args.length, names.length * 2, usage);
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    assert.ok(names.includes(args[index]) && !Object.hasOwn(result, args[index]), usage);
    result[args[index]] = args[index + 1];
  }
  return result;
}
function checkedPath(filename, { existing = true } = {}) {
  assert.ok(typeof filename === 'string' && path.isAbsolute(filename) && path.normalize(filename) === filename,
    'Receipt path must be absolute and normalized');
  let current = path.parse(filename).root;
  const segments = filename.slice(current.length).split(path.sep);
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    if (!existing && index === segments.length - 1) break;
    assert.ok(!lstatSync(current).isSymbolicLink(), 'Receipt path cannot contain symlinks');
  }
  return filename;
}
function selectedQualification() {
  const selection = websiteBuildSelection();
  assert.equal(selection.pages, 'full', 'Full standalone planning requires its explicit full audience');
  return { root: fileURLToPath(new URL('../', import.meta.url)), ...selection };
}
if (operation === 'plan') {
  assert.equal(args.length, 0, usage);
  process.stdout.write(canonicalReleaseJson(fullStandalonePlanFromQualification(selectedQualification())));
} else if (operation === 'validate') {
  const parameters = argumentsFor(['--receipt']);
  const filename = checkedPath(parameters['--receipt']);
  const stat = lstatSync(filename);
  assert.ok(stat.isFile() && stat.size > 0 && stat.size <= 1024 * 1024, 'Receipt must be a bounded regular file');
  const raw = readFileSync(filename);
  assert.equal(raw.length, stat.size, 'Receipt changed while reading');
  validateFullStandaloneRelease(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)));
  // The original proof consumer separately rejects duplicate JSON fields and
  // verifies these exact subject bytes, workflow invocation, and OCI image.
  process.stdout.write('Full standalone website release contract is valid.\n');
} else if (operation === 'record') {
  const parameters = argumentsFor(['--image-digest', '--run-id', '--run-attempt', '--output']);
  const options = selectedQualification();
  const env = process.env;
  for (const [name, value] of Object.entries({
    GITHUB_ACTIONS: 'true', GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_REPOSITORY: FULL_STANDALONE_REPOSITORY, GITHUB_REPOSITORY_ID: FULL_STANDALONE_REPOSITORY_ID,
    GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: FULL_STANDALONE_REF,
    GITHUB_WORKFLOW_REF: `${FULL_STANDALONE_REPOSITORY}/${FULL_STANDALONE_WORKFLOW}@${FULL_STANDALONE_REF}`,
    GITHUB_SHA: options.commerceSha, GITHUB_WORKFLOW_SHA: options.commerceSha,
    GITHUB_RUN_ID: parameters['--run-id'], GITHUB_RUN_ATTEMPT: parameters['--run-attempt'],
    RUNNER_ENVIRONMENT: 'github-hosted', RUNNER_OS: 'Linux', RUNNER_ARCH: 'X64',
  })) assert.equal(env[name], value, 'Unsigned recording requires original private producer context: ' + name);
  options.workflow = qualificationWorkflowFromEnvironment(env);
  const plan = fullStandalonePlanFromQualification(options);
  const evidence = finalizeQualificationEvidence(options);
  assert.notEqual(parameters['--image-digest'], evidence.local_image_id, 'A local image ID is not a registry manifest digest');
  const release = createFullStandaloneRelease({ buildPlan: plan, imageMetadata: fullStandaloneImageMetadata(plan),
    registryManifestDigest: parameters['--image-digest'], runId: parameters['--run-id'], runAttempt: parameters['--run-attempt'] });
  const filename = checkedPath(parameters['--output'], { existing: false });
  writeFileSync(filename, canonicalReleaseJson(release), { flag: 'wx', mode: 0o600 });
} else {
  assert.fail(usage);
}
