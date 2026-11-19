// Publish the already-qualified local image and bind the registry bytes before
// creating an unsigned receipt subject. The workflow signs and verifies it next.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { finalizeQualificationEvidence, qualificationWorkflowFromEnvironment } from './qualification-evidence.mjs';
import { validatePublishedManifest, verifyPublishedImage } from './published-image.mjs';
import {
  STANDALONE_IMAGE, STANDALONE_REF, STANDALONE_REPOSITORY, STANDALONE_REPOSITORY_ID,
  STANDALONE_WORKFLOW, canonicalReleaseJson, createStandaloneRelease,
  standaloneImageMetadata, standalonePlanFromQualification,
} from './standalone-release-contract.mjs';

const MAX_JSON = 1024 * 1024;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const hash = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

export function publisherContext(env = process.env) {
  for (const [key, value] of Object.entries({
    GITHUB_ACTIONS: 'true', GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_REPOSITORY: STANDALONE_REPOSITORY, GITHUB_REPOSITORY_ID: STANDALONE_REPOSITORY_ID,
    GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: STANDALONE_REF,
    GITHUB_REF_PROTECTED: 'true', RUNNER_ENVIRONMENT: 'github-hosted', RUNNER_OS: 'Linux', RUNNER_ARCH: 'X64',
    GITHUB_WORKFLOW_REF: `${STANDALONE_REPOSITORY}/${STANDALONE_WORKFLOW}@${STANDALONE_REF}`,
    MARTY_PRODUCTION_PAGES: 'public',
  })) assert.equal(env[key], value, 'Publisher requires ' + key + '=' + value);
  const sourceSha = env.WEBSITE_EXPECTED_SOURCE_SHA;
  assert.ok(typeof sourceSha === 'string' && sourceSha.length === 40 && /^[a-f0-9]{40}$/.test(sourceSha),
    'An exact expected protected-main source is required');
  for (const key of ['GITHUB_SHA', 'GITHUB_WORKFLOW_SHA', 'MARTY_WEBSITE_SOURCE_SHA']) {
    assert.equal(env[key], sourceSha, 'Publisher source differs: ' + key);
  }
  for (const key of ['GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT']) {
    assert.ok(typeof env[key] === 'string' && /^[1-9][0-9]*$/.test(env[key]) && !env[key].includes('\n'),
      'An exact original run and attempt are required');
  }
  return Object.freeze({ sourceSha, runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT,
    workflow: qualificationWorkflowFromEnvironment(env) });
}

function checkedPath(filename) {
  assert.ok(typeof filename === 'string' && path.isAbsolute(filename) && path.resolve(filename) === filename,
    'Publisher paths must be absolute and normalized');
  let current = path.parse(filename).root;
  for (const segment of filename.slice(current.length).split(path.sep)) {
    current = path.join(current, segment);
    // lstat also rejects a dangling link, unlike existsSync alone.
    let info;
    try { info = lstatSync(current); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    assert.ok(!info.isSymbolicLink(), 'Publisher paths cannot contain symlinks');
  }
  return filename;
}

function regularBytes(filename, maximum, { empty = false, privateFile = false } = {}) {
  checkedPath(filename);
  const info = lstatSync(filename);
  assert.ok(info.isFile() && (empty || info.size > 0) && info.size <= maximum, 'Invalid bounded publisher file');
  if (privateFile) assert.ok(info.uid === process.getuid() && !(info.mode & 0o077), 'Publisher file must be private');
  const bytes = readFileSync(filename);
  assert.equal(bytes.length, info.size, 'Publisher file changed while reading');
  return bytes;
}

function privateDirectory(directory) {
  checkedPath(directory);
  const info = lstatSync(directory);
  assert.ok(info.isDirectory() && info.uid === process.getuid() && !(info.mode & 0o077),
    'Publisher configuration must be a private owned directory');
}

function command(executable, args, options) {
  try {
    return execFileSync(executable, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    // Do not echo registry credentials or arbitrary child-process diagnostics.
    throw new Error('Website publication command failed: ' + path.basename(executable) + ' ' + args.slice(0, 2).join(' '));
  }
}

function json(bytes) {
  assert.ok(Buffer.isBuffer(bytes), 'Publisher commands must return unchanged stdout bytes');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

function preflight({ root, outputDirectory, oras, env }) {
  checkedPath(root);
  const temporary = checkedPath(env.RUNNER_TEMP);
  assert.ok(lstatSync(temporary).isDirectory(), 'Runner temporary directory is required');
  assert.ok(temporary !== root && !temporary.startsWith(root + path.sep)
    && !root.startsWith(temporary + path.sep), 'Publication staging must be outside the source checkout');
  assert.equal(checkedPath(outputDirectory), path.join(temporary, 'website-release'), 'Unexpected release destination');
  assert.ok(!existsSync(outputDirectory), 'Release destination already exists');
  assert.equal(checkedPath(oras), path.join(temporary, 'website-publisher-tools/oras'), 'Use the pinned publisher tool');
  privateDirectory(path.dirname(oras));
  const executable = lstatSync(oras);
  assert.ok(executable.isFile() && executable.uid === process.getuid() && (executable.mode & 0o700) === 0o700
    && !(executable.mode & 0o077), 'Pinned ORAS executable must be private');
  const authHome = path.join(temporary, 'website-publisher-home');
  privateDirectory(authHome);
  const dockerConfig = path.join(authHome, '.docker');
  assert.equal(env.DOCKER_CONFIG, dockerConfig, 'Use the isolated publisher registry configuration');
  privateDirectory(dockerConfig);
  regularBytes(path.join(dockerConfig, 'config.json'), MAX_JSON, { privateFile: true });
  return { dockerConfig, temporary };
}

/** execute is a function seam for offline tests, never selectable from the CLI
 * or environment. Every source/output/qualification check remains real. */
export function publishQualifiedWebsite({ root, outputDirectory, oras, env = process.env, execute = command }) {
  const context = publisherContext(env);
  const { dockerConfig, temporary } = preflight({ root, outputDirectory, oras, env });
  const qualification = { root, sourceSha: context.sourceSha, workflow: context.workflow };
  const buildPlan = standalonePlanFromQualification(qualification);
  const evidence = finalizeQualificationEvidence(qualification);
  const routes = regularBytes(path.join(root, 'contracts/web-surface-routes.json'), MAX_JSON);
  assert.equal(hash(routes), buildPlan.input_sha256['contracts/web-surface-routes.json']);
  const gitEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !/^GIT_/i.test(key)));
  execFileSync('git', ['-C', root, '-c', 'core.fsmonitor=false', 'merge-base', '--is-ancestor',
    context.sourceSha, 'refs/remotes/origin/main'], { env: gitEnv, timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });

  // Explicitly use the hosted runner daemon and the scoped credential file;
  // inherited Docker contexts, proxies, tokens and custom trust roots are absent.
  const commandEnv = { PATH: env.PATH || '/usr/bin:/bin', HOME: env.HOME || temporary,
    LANG: 'C.UTF-8', TMPDIR: temporary, DOCKER_CONFIG: dockerConfig,
    DOCKER_HOST: 'unix:///var/run/docker.sock' };
  const run = (binary, args, { maxBuffer = 4 * MAX_JSON, timeout = 120000 } = {}) =>
    execute(binary, args, { cwd: root, env: commandEnv, timeout, maxBuffer, encoding: 'buffer' });
  const qualifiedInspection = json(run('docker', ['image', 'inspect', evidence.local_image_id]));
  // Validate the local identity before the first registry mutation too.
  assert.ok(Array.isArray(qualifiedInspection) && qualifiedInspection.length === 1, 'One qualified image is required');
  assert.equal(qualifiedInspection[0].Id, evidence.local_image_id, 'Qualified local image changed');
  assert.equal(qualifiedInspection[0].Os, 'linux');
  assert.equal(qualifiedInspection[0].Architecture, 'amd64');

  const tag = `${STANDALONE_IMAGE}:${context.sourceSha}-${context.runId}-${context.runAttempt}`;
  run('docker', ['tag', evidence.local_image_id, tag]);
  run('docker', ['push', tag], { timeout: 600000 });
  const registry = ['--registry-config', path.join(dockerConfig, 'config.json')];
  const descriptor = json(run(oras, ['manifest', 'fetch', '--descriptor', ...registry, tag], { maxBuffer: MAX_JSON }));
  assert.ok(typeof descriptor.digest === 'string' && descriptor.digest.length === 71 && DIGEST.test(descriptor.digest),
    'Registry descriptor must identify one immutable SHA-256 manifest');
  assert.ok(Number.isSafeInteger(descriptor.size) && descriptor.size > 0 && descriptor.size <= MAX_JSON,
    'Registry manifest exceeds its size bound');
  const candidate = `${STANDALONE_IMAGE}@${descriptor.digest}`;
  // --output - emits the raw response bytes. Do not pretty-print or reserialize.
  const manifestBytes = run(oras, ['manifest', 'fetch', '--output', '-', ...registry, candidate], { maxBuffer: MAX_JSON });
  const prelim = validatePublishedManifest({ descriptor, manifestBytes, qualifiedImageId: evidence.local_image_id });
  run('docker', ['pull', '--platform', 'linux/amd64', prelim.imageReference], { timeout: 600000 });
  const pulledInspection = json(run('docker', ['image', 'inspect', prelim.imageReference]));
  const published = verifyPublishedImage({ descriptor, manifestBytes, qualifiedImageId: evidence.local_image_id,
    qualifiedInspection, pulledInspection });

  // Recheck after the network operations, before emitting any release subject.
  assert.deepEqual(standalonePlanFromQualification(qualification), buildPlan, 'Qualified build changed during publication');
  assert.deepEqual(finalizeQualificationEvidence(qualification), evidence, 'Qualification changed during publication');
  assert.deepEqual(regularBytes(path.join(root, 'contracts/web-surface-routes.json'), MAX_JSON), routes,
    'Route contract changed during publication');
  const receipt = createStandaloneRelease({ buildPlan, imageMetadata: standaloneImageMetadata(buildPlan),
    registryManifestDigest: published.registryManifestDigest, runId: context.runId, runAttempt: context.runAttempt });
  mkdirSync(outputDirectory, { mode: 0o700 });
  try {
    writeFileSync(path.join(outputDirectory, 'website-release.json'), canonicalReleaseJson(receipt), { flag: 'wx', mode: 0o600 });
    writeFileSync(path.join(outputDirectory, 'web-surface-routes.json'), routes, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    rmSync(outputDirectory, { recursive: true, force: true });
    throw error;
  }
  return Object.freeze({ ...published, receipt });
}

export function requirePublicationOutput(env = process.env) {
  const filename = checkedPath(env.GITHUB_OUTPUT);
  const temporary = checkedPath(env.RUNNER_TEMP);
  assert.ok(filename.startsWith(temporary + path.sep), 'GitHub outputs must stay in runner temporary storage');
  regularBytes(filename, MAX_JSON, { empty: true });
  return filename;
}

export function appendPublicationOutputs(published, env = process.env) {
  const filename = requirePublicationOutput(env);
  assert.ok(typeof published.registryManifestDigest === 'string' && published.registryManifestDigest.length === 71
    && DIGEST.test(published.registryManifestDigest), 'Invalid published manifest output');
  assert.equal(published.imageReference, STANDALONE_IMAGE + '@' + published.registryManifestDigest);
  appendFileSync(filename, `image_digest=${published.registryManifestDigest}\nimage_reference=${published.imageReference}\n`);
}
