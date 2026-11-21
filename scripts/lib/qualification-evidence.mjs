// Unsigned, local qualification records. These are never release attestations,
// registry receipts, or authorization to admit or deploy an image.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync, linkSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync,
  rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';

const REPOSITORY = 'ElevenID/website';
const REPOSITORY_ID = '1459542519';
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const STAGES = Object.freeze(['prerender', 'output-verification', 'image-build', 'nginx']);
const QUALIFIED = Object.freeze({
  prerender: 'website-production-prerender',
  'output-verification': 'website-production-prerender-verification',
  'image-build': 'website-static-container-build',
  nginx: 'production-website-image',
});
const INPUTS = Object.freeze([
  'package.json', 'package-lock.json', 'bun.lock', 'Dockerfile.website', 'contracts/web-surface-routes.json',
  'scripts/website-prerender-plan.mjs',
]);
const KNOWN_FILES = new Set([
  'qualification-context.json', ...STAGES.map((stage) => stage + '.json'),
  'website-output-manifest.json', 'website-qualification.json',
]);
const LIMITATIONS = Object.freeze({
  registry_published: false,
  cryptographic_provenance_verified: false,
  live_application_handoff_verified: false,
  production_deployed: false,
});

function sha256(bytes) { return 'sha256:' + createHash('sha256').update(bytes).digest('hex'); }
function json(value) { return JSON.stringify(value, null, 2) + '\n'; }
function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function plainObject(value, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
}
function positive(value, label) {
  assert.ok(Number.isSafeInteger(value) && value > 0, label + ' must be a positive integer');
}
function rootDirectory(root) {
  assert.equal(typeof root, 'string', 'Website root is required');
  const resolved = path.resolve(root);
  assert.ok(lstatSync(resolved).isDirectory() && !lstatSync(resolved).isSymbolicLink(), 'Website root must be a regular directory');
  return realpathSync(resolved);
}
function git(root, args) {
  // Do not let an inherited Git override bind the receipt to another index,
  // worktree, object database, or injected configuration.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
  return execFileSync('git', ['-C', root, '-c', 'core.fsmonitor=false', ...args], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
    env, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/** Bind a production identity to the actual checkout, before executing it. */
export function assertWebsiteSource({ root, sourceSha }) {
  assert.match(sourceSha || '', SHA, 'An exact website source SHA is required');
  const directory = rootDirectory(root);
  assert.equal(realpathSync(git(directory, ['rev-parse', '--show-toplevel'])), directory,
    'Website root must be the Git checkout root');
  const actual = git(directory, ['rev-parse', '--verify', 'HEAD^{commit}']);
  assert.equal(actual, sourceSha, 'Website source SHA differs from checked-out HEAD');
  assert.equal(git(directory, ['status', '--porcelain=v1', '--untracked-files=all', '--ignore-submodules=none']), '',
    'Website source checkout must be clean, including untracked source files');
  return { source_sha: actual, source_tree_sha: git(directory, ['rev-parse', 'HEAD^{tree}']) };
}

function contained(root, filename, label) {
  const target = path.resolve(root, filename);
  const relative = path.relative(root, target);
  assert.ok(relative && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative),
    label + ' must stay within the website checkout');
  assert.ok(!relative.split(path.sep).some((segment) => segment === '.git' || segment === 'node_modules'),
    label + ' cannot use Git metadata or dependencies');
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    if (existsSync(current)) assert.ok(!lstatSync(current).isSymbolicLink(), label + ' cannot contain symlinks');
  }
  return target;
}
function regularBytes(root, filename, label, maximum = 64 * 1024 * 1024) {
  const target = contained(root, filename, label);
  const stat = lstatSync(target);
  assert.ok(stat.isFile() && !stat.isSymbolicLink(), label + ' must be a regular file');
  assert.ok(stat.size <= maximum, label + ' exceeds the bounded file size');
  assert.ok(realpathSync(target).startsWith(root + path.sep), label + ' resolves outside the website checkout');
  return readFileSync(target);
}
function receiptDirectory(root, requested) {
  const directory = contained(root, requested ?? process.env.WEBSITE_QUALIFICATION_DIR ?? '.qualification', 'Qualification directory');
  const dist = path.join(root, 'ui/dist-website');
  assert.ok(directory !== dist && !directory.startsWith(dist + path.sep) && !dist.startsWith(directory + path.sep),
    'Qualification evidence must be outside the built website');
  // Evidence must not become untracked source after the first receipt. Only a
  // checkout-configured ignored output location is eligible.
  const probe = path.relative(root, path.join(directory, 'qualification-context.json'));
  try { git(root, ['check-ignore', '--quiet', '--', probe]); }
  catch { assert.fail('Qualification directory must be ignored by the website checkout'); }
  if (existsSync(directory)) {
    assert.ok(lstatSync(directory).isDirectory(), 'Qualification destination must be a directory');
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      assert.ok(KNOWN_FILES.has(entry.name) && entry.isFile() && !entry.isSymbolicLink(),
        'Unexpected entry in qualification directory: ' + entry.name);
    }
  }
  return directory;
}
function writeOnce(root, directory, filename, value) {
  const target = contained(root, path.join(directory, filename), 'Qualification file');
  const bytes = json(value);
  if (existsSync(target)) {
    assert.equal(regularBytes(root, target, filename, 8 * 1024 * 1024).toString('utf8'), bytes,
      'Existing qualification evidence differs; prepare a fresh qualification run');
    return;
  }
  mkdirSync(directory, { recursive: true });
  const temporary = path.join(directory, '.' + filename + '.' + randomUUID() + '.tmp');
  try {
    writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o644 });
    // Atomic creation without replacing a concurrent writer's receipt.
    linkSync(temporary, target);
  } finally { rmSync(temporary, { force: true }); }
}
function readJson(root, directory, filename) {
  return JSON.parse(regularBytes(root, path.join(directory, filename), filename, 8 * 1024 * 1024).toString('utf8'));
}

/** Capture workflow custody without claiming it has been authenticated. */
export function qualificationWorkflowFromEnvironment(env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true') return null;
  const workflow = {
    repository: env.GITHUB_REPOSITORY,
    repository_id: env.GITHUB_REPOSITORY_ID,
    workflow_ref: env.GITHUB_WORKFLOW_REF,
    workflow_sha: env.GITHUB_WORKFLOW_SHA,
    event_name: env.GITHUB_EVENT_NAME,
    ref: env.GITHUB_REF,
    run_id: env.GITHUB_RUN_ID,
    run_attempt: env.GITHUB_RUN_ATTEMPT,
  };
  validateWorkflow(workflow);
  return workflow;
}
function validateWorkflow(workflow) {
  if (workflow === null) return;
  plainObject(workflow, 'Workflow context');
  assert.deepEqual(Object.keys(workflow).sort(), [
    'repository', 'repository_id', 'workflow_ref', 'workflow_sha', 'event_name', 'ref', 'run_id', 'run_attempt',
  ].sort(), 'Workflow context has unexpected fields');
  assert.equal(workflow.repository, REPOSITORY);
  assert.equal(workflow.repository_id, REPOSITORY_ID);
  assert.match(workflow.workflow_ref || '', /^ElevenID\/website\/\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml@refs\/[A-Za-z0-9_./-]+$/,
    'Invalid workflow ref');
  assert.match(workflow.workflow_sha || '', SHA, 'Exact workflow SHA is required separately from checkout source');
  assert.match(workflow.event_name || '', /^[a-z][a-z0-9_]*$/, 'Invalid workflow event');
  assert.match(workflow.ref || '', /^refs\/[A-Za-z0-9_./-]+$/, 'Invalid workflow ref context');
  for (const name of ['run_id', 'run_attempt']) assert.match(workflow[name] || '', /^[1-9][0-9]*$/, 'Invalid ' + name);
}
function inputFingerprints(root) {
  return Object.fromEntries(INPUTS.map((filename) => [filename, sha256(regularBytes(root, filename, filename))]));
}
function contextFor({ root, sourceSha, workflow }) {
  const source = assertWebsiteSource({ root, sourceSha });
  validateWorkflow(workflow);
  return {
    schema: 'marty.website-qualification-context/v1', repository: REPOSITORY,
    ...source, revision: sourceSha, workflow, inputs: inputFingerprints(root),
    ...LIMITATIONS,
  };
}
function requireContext(root, sourceSha, directory, workflow) {
  const expected = contextFor({ root, sourceSha, workflow });
  assert.deepEqual(readJson(root, directory, 'qualification-context.json'), expected,
    'Qualification context differs from this checkout or workflow attempt; prepare a fresh run');
  return expected;
}

/** Clear only known evidence files after checking every directory entry. */
export function prepareQualificationEvidence({ root, sourceSha, directory, workflow = qualificationWorkflowFromEnvironment() }) {
  const repositoryRoot = rootDirectory(root);
  const destination = receiptDirectory(repositoryRoot, directory);
  const context = contextFor({ root: repositoryRoot, sourceSha, workflow });
  if (existsSync(destination)) {
    // receiptDirectory already validated all names and file types before any removal.
    for (const filename of readdirSync(destination)) rmSync(path.join(destination, filename));
  }
  writeOnce(repositoryRoot, destination, 'qualification-context.json', context);
  return context;
}

function outputSnapshot(root, sourceSha) {
  const dist = contained(root, 'ui/dist-website', 'Website output');
  assert.ok(lstatSync(dist).isDirectory(), 'Website output must be a directory');
  const files = [];
  let totalBytes = 0;
  function visit(directory) {
    for (const name of readdirSync(directory).sort()) {
      const filename = path.join(directory, name);
      const stat = lstatSync(filename);
      assert.ok(!stat.isSymbolicLink(), 'Website output cannot contain symlinks');
      if (stat.isDirectory()) { visit(filename); continue; }
      assert.ok(stat.isFile(), 'Website output must contain only regular files and directories');
      const bytes = regularBytes(root, filename, 'Website output file');
      totalBytes += bytes.length;
      assert.ok(totalBytes <= 512 * 1024 * 1024 && files.length < 10000, 'Website output exceeds qualification bounds');
      files.push({ path: path.relative(dist, filename).split(path.sep).join('/'), bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
  visit(dist);
  positive(files.length, 'Website output file count');
  const releaseBytes = regularBytes(root, path.join(dist, 'marty-website-release.json'), 'Website release metadata');
  const release = JSON.parse(releaseBytes.toString('utf8'));
  assert.equal(release.schema, 'marty.website-image/v3');
  assert.equal(release.repository, REPOSITORY);
  assert.equal(release.surface, 'website');
  assert.equal(release.audience, 'production');
  assert.equal(release.production_pages, 'public');
  assert.equal(release.source_sha, sourceSha, 'Built website source differs from checkout');
  assert.equal(release.revision, sourceSha, 'Built website revision differs from checkout');
  assert.equal(release.commerce_extension, null, 'Qualification cannot contain private commerce');
  assert.match(release.route_contract?.sha256 || '', DIGEST, 'Built website requires its route contract digest');
  assert.equal(release.route_contract.sha256,
    sha256(canonicalJson(JSON.parse(regularBytes(root, 'contracts/web-surface-routes.json', 'Source route contract').toString('utf8')))),
    'Built website route contract differs from checkout');
  return {
    summary: {
      sha256: sha256(json(files)), file_count: files.length, total_bytes: totalBytes,
      release_metadata_sha256: sha256(releaseBytes), route_contract_sha256: release.route_contract.sha256,
    },
    files,
  };
}

function normalizeResult(stage, supplied, sourceSha) {
  assert.ok(STAGES.includes(stage), 'Unknown website qualification stage');
  plainObject(supplied, 'Qualification result');
  // Round-trip rejects undefined/cyclic data and retains only ordinary JSON data.
  const result = JSON.parse(JSON.stringify(supplied));
  assert.equal(result.qualified, QUALIFIED[stage], 'Stage result does not identify the required qualification');
  assert.equal(result.source_sha, sourceSha, 'Stage result source differs from checkout');
  assert.equal(result.revision, sourceSha, 'Stage result revision differs from checkout');
  if ('repository' in result) assert.equal(result.repository, REPOSITORY);
  if (stage === 'prerender') {
    for (const name of ['route_count', 'canonical_count', 'sitemap_count', 'pages']) positive(result[name], name);
    assert.equal(result.route_count, result.pages, 'Prerender page count differs from planned routes');
    assert.equal(result.canonical_count, result.sitemap_count, 'Prerender canonical and sitemap counts differ');
    plainObject(result.readiness, 'Readiness counts');
    assert.equal(result.readiness.timeout, 0, 'Prerender readiness timed out');
    for (const name of ['signal', 'app-ready-fallback']) {
      assert.ok(Number.isSafeInteger(result.readiness[name]) && result.readiness[name] >= 0, 'Invalid readiness count');
    }
    assert.equal(result.readiness.signal + result.readiness['app-ready-fallback'], result.route_count,
      'Prerender readiness counts differ from route count');
  } else if (stage === 'output-verification') {
    for (const name of ['routes', 'canonical_urls', 'unique_titles', 'public_assets']) positive(result[name], name);
  }
  if (stage === 'image-build' || stage === 'nginx') {
    const imageId = result.local_image_id ?? result.image_id;
    assert.match(imageId || '', DIGEST, 'Exact local Docker image ID is required');
    if ('local_image_id' in result && 'image_id' in result) assert.equal(result.local_image_id, result.image_id);
    result.local_image_id = imageId;
    delete result.image_id;
    assert.equal(result.image, 'elevenid-website:' + sourceSha, 'Image tag differs from checkout');
    assert.ok(!('image_digest' in result) && !('registry_digest' in result), 'Local image ID is not a registry digest');
  }
  if (stage === 'image-build') {
    assert.equal(result.registry_published, false, 'Qualification cannot claim image publication');
    assert.match(result.route_contract_sha256 || '', DIGEST, 'Image route contract digest is required');
  }
  if (stage === 'nginx') {
    for (const name of ['route_count', 'resource_checks', 'denied_route_checks']) positive(result[name], name);
  }
  return result;
}

/** Record one successful stage against the current bytes and prepared attempt. */
export function writeQualificationReceipt({ root, stage, result, sourceSha = result?.source_sha,
  directory, workflow = qualificationWorkflowFromEnvironment() }) {
  const repositoryRoot = rootDirectory(root);
  const destination = receiptDirectory(repositoryRoot, directory);
  const context = requireContext(repositoryRoot, sourceSha, destination, workflow);
  const normalized = normalizeResult(stage, result, sourceSha);
  const output = outputSnapshot(repositoryRoot, sourceSha).summary;
  if (stage === 'image-build') assert.equal(normalized.route_contract_sha256, output.route_contract_sha256);
  const receipt = {
    schema: 'marty.website-qualification-stage/v1', stage, repository: REPOSITORY,
    source_sha: sourceSha, source_tree_sha: context.source_tree_sha, revision: sourceSha,
    workflow, inputs: context.inputs, output, result: normalized, ...LIMITATIONS,
  };
  // An output mutation is an immediate failure, even before the finalizer runs.
  for (const previous of STAGES) {
    if (!existsSync(path.join(destination, previous + '.json'))) continue;
    const prior = readJson(repositoryRoot, destination, previous + '.json');
    assert.deepEqual(prior.output, output, 'Website output changed between qualification stages');
    assert.deepEqual(prior.workflow, workflow, 'Qualification stages belong to different workflow attempts');
    assert.equal(prior.source_sha, sourceSha, 'Qualification stages belong to different sources');
  }
  writeOnce(repositoryRoot, destination, stage + '.json', receipt);
  return receipt;
}

/** Recheck all evidence and current bytes; never authenticate or admit a release. */
export function finalizeQualificationEvidence({ root, sourceSha, directory,
  workflow = qualificationWorkflowFromEnvironment() }) {
  const repositoryRoot = rootDirectory(root);
  const destination = receiptDirectory(repositoryRoot, directory);
  const context = requireContext(repositoryRoot, sourceSha, destination, workflow);
  const snapshot = outputSnapshot(repositoryRoot, sourceSha);
  const stages = {};
  const receiptHashes = {};
  for (const stage of STAGES) {
    const filename = stage + '.json';
    const receipt = readJson(repositoryRoot, destination, filename);
    const normalized = normalizeResult(stage, receipt.result, sourceSha);
    const expected = {
      schema: 'marty.website-qualification-stage/v1', stage, repository: REPOSITORY,
      source_sha: sourceSha, source_tree_sha: context.source_tree_sha, revision: sourceSha,
      workflow, inputs: context.inputs, output: snapshot.summary, result: normalized, ...LIMITATIONS,
    };
    assert.deepEqual(receipt, expected, 'Qualification receipt differs from the current source/output/attempt: ' + stage);
    stages[stage] = normalized;
    receiptHashes[filename] = sha256(regularBytes(repositoryRoot, path.join(destination, filename), filename));
  }
  assert.equal(stages.prerender.route_count, stages['output-verification'].routes, 'Rendered and verified route counts differ');
  assert.equal(stages.prerender.route_count, stages.nginx.route_count, 'Rendered and HTTP route counts differ');
  assert.equal(stages.prerender.canonical_count, stages['output-verification'].canonical_urls, 'Canonical counts differ');
  assert.equal(stages['image-build'].local_image_id, stages.nginx.local_image_id, 'HTTP qualification used a different local image');
  assert.equal(stages['image-build'].route_contract_sha256, snapshot.summary.route_contract_sha256,
    'Image route contract differs from verified website output');
  const manifest = {
    schema: 'marty.website-output-inventory/v1', repository: REPOSITORY, source_sha: sourceSha,
    ...snapshot.summary, files: snapshot.files,
  };
  writeOnce(repositoryRoot, destination, 'website-output-manifest.json', manifest);
  const evidence = {
    schema: 'marty.website-qualification/v1',
    purpose: 'unsigned-build-and-http-qualification-only',
    repository: REPOSITORY, source_sha: sourceSha, source_tree_sha: context.source_tree_sha,
    revision: sourceSha, production_pages: 'public', workflow, inputs: context.inputs,
    output: snapshot.summary,
    output_manifest: { file: 'website-output-manifest.json', sha256: sha256(json(manifest)) },
    local_image_id: stages.nginx.local_image_id,
    stage_receipts: receiptHashes,
    results: stages,
    ...LIMITATIONS,
  };
  writeOnce(repositoryRoot, destination, 'website-qualification.json', evidence);
  return evidence;
}
