import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  appendPublicationOutputs, publisherContext, publishQualifiedWebsite, requirePublicationOutput,
} from '../../scripts/lib/website-publisher.mjs';
import { prepareQualificationEvidence, writeQualificationReceipt } from '../../scripts/lib/qualification-evidence.mjs';
import { STANDALONE_INPUT_PATHS, validateStandaloneRelease } from '../../scripts/lib/standalone-release-contract.mjs';
import { websiteReleaseMetadata } from '../../ui/scripts/web-surface-build-contract.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const ID = 'sha256:' + 'c'.repeat(64);
const hash = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
}).trim();
function put(root, filename, bytes, mode = 0o600) {
  const destination = path.join(root, filename);
  mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  writeFileSync(destination, bytes, { mode });
  return destination;
}
function fixture(t, { omitStage, beforeCommand } = {}) {
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'website-publisher-test-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, 'source');
  const runner = path.join(temporary, 'runner');
  mkdirSync(runner, { mode: 0o700 });
  put(root, '.gitignore', '.qualification/\nui/dist-website/\n');
  for (const filename of STANDALONE_INPUT_PATHS) {
    put(root, filename, readFileSync(path.join(repository, filename)));
  }
  git(root, 'init', '--quiet', '--initial-branch=main');
  git(root, 'add', '.');
  git(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Synthetic publisher source');
  const sourceSha = git(root, 'rev-parse', 'HEAD');
  git(root, 'update-ref', 'refs/remotes/origin/main', sourceSha);
  const env = {
    PATH: process.env.PATH, HOME: runner, RUNNER_TEMP: runner,
    GITHUB_ACTIONS: 'true', GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_REPOSITORY: 'ElevenID/website', GITHUB_REPOSITORY_ID: '1459542519',
    GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main', GITHUB_REF_PROTECTED: 'true',
    GITHUB_WORKFLOW_REF: 'ElevenID/website/.github/workflows/production-website-release.yml@refs/heads/main',
    GITHUB_SHA: sourceSha, GITHUB_WORKFLOW_SHA: sourceSha, MARTY_WEBSITE_SOURCE_SHA: sourceSha,
    WEBSITE_EXPECTED_SOURCE_SHA: sourceSha, MARTY_PRODUCTION_PAGES: 'public',
    GITHUB_RUN_ID: '1234567890', GITHUB_RUN_ATTEMPT: '2',
    RUNNER_ENVIRONMENT: 'github-hosted', RUNNER_OS: 'Linux', RUNNER_ARCH: 'X64',
    DOCKER_CONFIG: path.join(runner, 'website-publisher-docker'),
    GITHUB_OUTPUT: put(runner, '_runner_file_commands/output', ''),
  };
  const oras = put(runner, 'website-publisher-tools/oras', '#!/bin/sh\nexit 81\n', 0o700);
  put(runner, 'website-publisher-docker/config.json', '{}\n');
  const options = { root, sourceSha, workflow: publisherContext(env).workflow };
  const metadata = websiteReleaseMetadata({ sourceSha });
  put(root, 'ui/dist-website/marty-website-release.json', JSON.stringify(metadata) + '\n');
  put(root, 'ui/dist-website/index.html', '<h1>Synthetic qualified bytes</h1>\n');
  const identity = { source_sha: sourceSha, revision: sourceSha };
  const image = { ...identity, image: 'elevenid-website:' + sourceSha, local_image_id: ID };
  const stages = {
    prerender: { ...identity, qualified: 'website-production-prerender', route_count: 1, pages: 1,
      canonical_count: 1, sitemap_count: 1, readiness: { signal: 1, 'app-ready-fallback': 0, timeout: 0 } },
    'output-verification': { ...identity, qualified: 'website-production-prerender-verification', routes: 1,
      canonical_urls: 1, unique_titles: 1, public_assets: 1 },
    'image-build': { ...image, qualified: 'website-static-container-build', platform: 'linux/amd64',
      route_contract_sha256: metadata.route_contract.sha256, registry_published: false },
    nginx: { ...image, qualified: 'production-website-image', route_count: 1, resource_checks: 1, denied_route_checks: 1 },
  };
  prepareQualificationEvidence(options);
  for (const [stage, result] of Object.entries(stages)) {
    if (stage !== omitStage) writeQualificationReceipt({ ...options, stage, result });
  }
  const mediaType = 'application/vnd.oci.image.manifest.v1+json';
  const manifestBytes = Buffer.from(JSON.stringify({ schemaVersion: 2, mediaType,
    config: { mediaType: 'application/vnd.oci.image.config.v1+json', size: 1000, digest: ID },
    layers: [{ mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', size: 2000, digest: 'sha256:' + 'a'.repeat(64) }],
  }));
  const descriptor = { mediaType, digest: hash(manifestBytes), size: manifestBytes.length };
  const inspection = [{ Id: ID, Os: 'linux', Architecture: 'amd64',
    RootFS: { Type: 'layers', Layers: ['sha256:' + 'd'.repeat(64)] } }];
  const imageReference = 'ghcr.io/elevenid/website@' + descriptor.digest;
  const pulled = structuredClone(inspection);
  pulled[0].RepoDigests = [imageReference];
  const calls = [];
  const result = { root, runner, sourceSha, env, oras, outputDirectory: path.join(runner, 'website-release'),
    manifestBytes, descriptor, inspection, pulled, imageReference, calls };
  result.execute = (binary, args, commandOptions) => {
    calls.push({ binary, args, options: commandOptions });
    beforeCommand?.({ ...result, binary, args });
    if (binary === 'docker') {
      if (args[0] === 'image') return Buffer.from(JSON.stringify(args[2] === ID ? result.inspection : result.pulled));
      if (['tag', 'push', 'pull'].includes(args[0])) return Buffer.from('synthetic command success\n');
    } else if (binary === oras) {
      if (args.includes('--descriptor')) return Buffer.from(JSON.stringify(result.descriptor));
      if (args.includes('--output')) return result.manifestBytes;
    }
    throw new Error('Unexpected test operation: ' + binary + ' ' + args.join(' '));
  };
  return result;
}

test('publishes the already qualified image, fetches raw immutable bytes, pulls and verifies, then emits the subject', (t) => {
  const f = fixture(t);
  const result = publishQualifiedWebsite(f);
  const tag = `ghcr.io/elevenid/website:${f.sourceSha}-1234567890-2`;
  assert.deepEqual(f.calls.map(({ binary, args }) => [path.basename(binary), ...args]), [
    ['docker', 'image', 'inspect', ID], ['docker', 'tag', ID, tag], ['docker', 'push', tag],
    ['oras', 'manifest', 'fetch', '--descriptor', '--registry-config', f.env.DOCKER_CONFIG + '/config.json', tag],
    ['oras', 'manifest', 'fetch', '--output', '-', '--registry-config', f.env.DOCKER_CONFIG + '/config.json', f.imageReference],
    ['docker', 'pull', '--platform', 'linux/amd64', f.imageReference], ['docker', 'image', 'inspect', f.imageReference],
  ]);
  assert.equal(result.registryManifestDigest, f.descriptor.digest);
  assert.notEqual(result.registryManifestDigest, ID);
  assert.equal(result.imageReference, f.imageReference);
  assert.deepEqual(validateStandaloneRelease(result.receipt), result.receipt);
  assert.equal(result.receipt.source_sha, f.sourceSha);
  assert.deepEqual(readdirSync(f.outputDirectory).sort(), ['web-surface-routes.json', 'website-release.json']);
  assert.equal(lstatSync(f.outputDirectory).mode & 0o777, 0o700);
  for (const name of readdirSync(f.outputDirectory)) assert.equal(lstatSync(path.join(f.outputDirectory, name)).mode & 0o777, 0o600);
  assert.deepEqual(readFileSync(path.join(f.outputDirectory, 'web-surface-routes.json')),
    readFileSync(path.join(f.root, 'contracts/web-surface-routes.json')));
  assert.equal(JSON.parse(readFileSync(path.join(f.root, '.qualification/website-qualification.json'))).registry_published, false);
  appendPublicationOutputs(result, f.env);
  assert.equal(readFileSync(f.env.GITHUB_OUTPUT, 'utf8'), `image_digest=${f.descriptor.digest}\nimage_reference=${f.imageReference}\n`);
});

test('runtime commands receive only the fixed Docker daemon, scoped credentials and ordinary process paths', (t) => {
  const f = fixture(t);
  Object.assign(f.env, { GH_TOKEN: 'not-for-child', GITHUB_TOKEN: 'not-for-child', DOCKER_HOST: 'tcp://wrong',
    DOCKER_CONTEXT: 'wrong', HTTPS_PROXY: 'wrong', SSL_CERT_FILE: 'wrong', ORAS_CACHE: 'wrong' });
  publishQualifiedWebsite(f);
  for (const { options } of f.calls) {
    assert.deepEqual(Object.keys(options.env).sort(), ['DOCKER_CONFIG', 'DOCKER_HOST', 'HOME', 'LANG', 'PATH', 'TMPDIR']);
    assert.equal(options.env.DOCKER_HOST, 'unix:///var/run/docker.sock');
    assert.equal(options.env.DOCKER_CONFIG, f.env.DOCKER_CONFIG);
    assert.ok(options.timeout <= 600000 && options.maxBuffer <= 4 * 1024 * 1024);
  }
});

test('wrong producer identities fail before any local or registry operation', (t) => {
  const f = fixture(t);
  for (const [key, value] of [
    ['GITHUB_ACTIONS', 'false'], ['GITHUB_SERVER_URL', 'https://github.example'],
    ['GITHUB_REPOSITORY', 'ElevenID/marty-ui'], ['GITHUB_REPOSITORY_ID', '1'],
    ['GITHUB_EVENT_NAME', 'push'], ['GITHUB_REF', 'refs/heads/feature'], ['GITHUB_REF_PROTECTED', 'false'],
    ['GITHUB_WORKFLOW_REF', 'ElevenID/website/.github/workflows/standalone-qualification.yml@refs/heads/main'],
    ['GITHUB_SHA', 'b'.repeat(40)], ['GITHUB_WORKFLOW_SHA', 'b'.repeat(40)], ['MARTY_WEBSITE_SOURCE_SHA', 'b'.repeat(40)],
    ['WEBSITE_EXPECTED_SOURCE_SHA', 'main'], ['WEBSITE_EXPECTED_SOURCE_SHA', f.sourceSha + '\n'],
    ['RUNNER_ENVIRONMENT', 'self-hosted'], ['RUNNER_OS', 'Windows'], ['RUNNER_ARCH', 'ARM64'],
    ['GITHUB_RUN_ID', '0'], ['GITHUB_RUN_ATTEMPT', '2\n'], ['MARTY_PRODUCTION_PAGES', 'full'],
  ]) assert.throws(() => publishQualifiedWebsite({ ...f, env: { ...f.env, [key]: value } }), undefined, key);
  assert.equal(f.calls.length, 0);
  assert.equal(existsSync(f.outputDirectory), false);
});

for (const change of ['source', 'output', 'attempt', 'missing-stage', 'main-ref']) {
  test('rejects changed qualification before publication: ' + change, (t) => {
    const f = fixture(t, change === 'missing-stage' ? { omitStage: 'nginx' } : {});
    if (change === 'source') put(f.root, 'untracked-source.txt', 'new source');
    if (change === 'output') put(f.root, 'ui/dist-website/index.html', '<h1>Changed</h1>');
    if (change === 'attempt') f.env.GITHUB_RUN_ATTEMPT = '3';
    if (change === 'main-ref') git(f.root, 'update-ref', '-d', 'refs/remotes/origin/main');
    assert.throws(() => publishQualifiedWebsite(f));
    assert.equal(f.calls.length, 0);
    assert.equal(existsSync(f.outputDirectory), false);
  });
}

for (const change of ['wrong-local-image', 'registry-digest', 'local-id-as-manifest', 'oversized-manifest',
  'malformed-descriptor', 'different-rootfs', 'wrong-repository', 'late-output-change', 'command-failure']) {
  test('never emits a receipt after publication binding failure: ' + change, (t) => {
    const f = fixture(t, { beforeCommand: ({ args, root }) => {
      if (args[0] === 'push' && change === 'late-output-change') put(root, 'ui/dist-website/index.html', 'Changed after push');
      if (args[0] === 'push' && change === 'command-failure') throw new Error('Synthetic registry rejection');
    } });
    if (change === 'wrong-local-image') f.inspection[0].Id = 'sha256:' + 'b'.repeat(64);
    if (change === 'registry-digest') f.descriptor.digest = 'sha256:' + 'b'.repeat(64);
    if (change === 'local-id-as-manifest') f.descriptor.digest = ID;
    if (change === 'oversized-manifest') f.descriptor.size = 1024 * 1024 + 1;
    if (change === 'malformed-descriptor') f.descriptor.digest += '\n';
    if (change === 'different-rootfs') f.pulled[0].RootFS.Layers = ['sha256:' + 'e'.repeat(64)];
    if (change === 'wrong-repository') f.pulled[0].RepoDigests = ['ghcr.io/elevenid/marty-ui@' + f.descriptor.digest];
    assert.throws(() => publishQualifiedWebsite(f));
    assert.equal(existsSync(f.outputDirectory), false);
    assert.equal(readFileSync(f.env.GITHUB_OUTPUT, 'utf8'), '');
    if (change === 'wrong-local-image') assert.equal(f.calls.length, 1);
  });
}

test('refuses reused output, source-local staging, alternative tools and unsafe registry credentials before mutation', (t) => {
  const f = fixture(t);
  mkdirSync(f.outputDirectory, { mode: 0o700 });
  assert.throws(() => publishQualifiedWebsite(f), /already exists/);
  rmSync(f.outputDirectory, { recursive: true });
  assert.throws(() => publishQualifiedWebsite({ ...f, outputDirectory: path.join(f.root, 'release') }), /destination/);
  assert.throws(() => publishQualifiedWebsite({ ...f, oras: '/usr/bin/oras' }), /pinned publisher tool/);
  chmodSync(path.join(f.env.DOCKER_CONFIG, 'config.json'), 0o644);
  assert.throws(() => publishQualifiedWebsite(f), /must be private/);
  chmodSync(path.join(f.env.DOCKER_CONFIG, 'config.json'), 0o600);
  rmSync(f.oras);
  symlinkSync('/bin/true', f.oras);
  assert.throws(() => publishQualifiedWebsite(f), /symlinks/);
  assert.equal(f.calls.length, 0);
});

test('GitHub outputs reject external paths and digest line injection', (t) => {
  const f = fixture(t);
  assert.equal(requirePublicationOutput(f.env), f.env.GITHUB_OUTPUT);
  assert.throws(() => requirePublicationOutput({ ...f.env, GITHUB_OUTPUT: path.join(f.root, 'package.json') }), /temporary storage/);
  assert.throws(() => appendPublicationOutputs({ registryManifestDigest: f.descriptor.digest + '\ninjected=true',
    imageReference: f.imageReference }, f.env), /Invalid/);
  assert.equal(readFileSync(f.env.GITHUB_OUTPUT, 'utf8'), '');
});

test('read-only receipt CLI validates the real v2 contract and refuses tampering, symlinks and oversized files', (t) => {
  const f = fixture(t);
  publishQualifiedWebsite(f);
  const receipt = path.join(f.outputDirectory, 'website-release.json');
  const cli = (filename, extra = []) => spawnSync(process.execPath,
    [path.join(repository, 'scripts/website-release-contract.mjs'), 'validate', '--receipt', filename, ...extra], { encoding: 'utf8' });
  assert.equal(cli(receipt).status, 0);
  const object = JSON.parse(readFileSync(receipt));
  object.producer.repository = 'ElevenID/marty-ui';
  writeFileSync(receipt, JSON.stringify(object));
  assert.notEqual(cli(receipt).status, 0);
  writeFileSync(receipt, Buffer.alloc(1024 * 1024 + 1));
  assert.notEqual(cli(receipt).status, 0);
  const link = path.join(f.runner, 'receipt-link');
  symlinkSync(receipt, link);
  assert.notEqual(cli(link).status, 0);
  assert.notEqual(cli(receipt, ['--unsigned-bypass']).status, 0);
});

test('ORAS installer refuses bad download length and hash before extracting or executing it', (t) => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'website-oras-installer-test-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const bin = path.join(temporary, 'bin');
  put(bin, 'curl', `#!${process.execPath}\nimport{writeFileSync}from'node:fs';\nconst a=process.argv.slice(2);\nwriteFileSync(process.env.CURL_LOG,JSON.stringify(a));\nwriteFileSync(a[a.indexOf('--output')+1],Buffer.alloc(Number(process.env.DOWNLOAD_SIZE)));\n`, 0o700);
  put(bin, 'tar', '#!/bin/sh\ntouch "$EXTRACTION_MARKER"\nexit 0\n', 0o700);
  const installer = path.join(repository, 'scripts/install_website_publisher_tools.sh');
  const marker = path.join(temporary, 'extracted');
  const log = path.join(temporary, 'curl.json');
  for (const size of [100, 6030754]) {
    const destination = path.join(temporary, 'download-' + size);
    const result = spawnSync('bash', [installer, destination], { encoding: 'utf8', env: { ...process.env,
      PATH: bin + ':' + process.env.PATH, DOWNLOAD_SIZE: String(size), CURL_LOG: log, EXTRACTION_MARKER: marker } });
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(marker), false);
    const args = JSON.parse(readFileSync(log));
    assert.equal(args[args.indexOf('--proto') + 1], '=https');
    assert.equal(args[args.indexOf('--proto-redir') + 1], '=https');
    assert.equal(args[args.indexOf('--max-filesize') + 1], '6030754');
    assert.ok(args.includes('https://github.com/oras-project/oras/releases/download/v1.4.0/oras_1.4.0_linux_amd64.tar.gz'));
  }
  const source = readFileSync(installer, 'utf8');
  assert.match(source, /d8e1dce2fd8ce996f1d901845b688eb0cf505a6082897606f053825bb47935d1/);
  assert.match(source, /--no-same-owner --no-same-permissions/);
  const reused = spawnSync('bash', [installer, temporary], { encoding: 'utf8' });
  assert.notEqual(reused.status, 0);
});
