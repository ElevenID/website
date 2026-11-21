import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const workflow = readFileSync(new URL('../../.github/workflows/production-website-release.yml', import.meta.url), 'utf8');

function step(name) {
  const marker = `      - name: ${name}\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `Missing required release step: ${name}`);
  const end = workflow.indexOf('\n      - ', start + marker.length);
  return workflow.slice(start, end === -1 ? undefined : end);
}

function shell(name) {
  const content = step(name);
  const start = content.indexOf('        run: |\n');
  assert.notEqual(start, -1, 'Expected a literal shell block');
  return content.slice(start + '        run: |\n'.length).split('\n')
    .map((line) => line.startsWith('          ') ? line.slice(10) : line).join('\n');
}

function sourceFixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'website-publisher-source-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '--initial-branch=main');
  git('config', 'user.name', 'Website publisher test');
  git('config', 'user.email', 'publisher-test@example.invalid');
  writeFileSync(path.join(root, 'tracked.txt'), 'qualified source\n');
  git('add', 'tracked.txt');
  git('-c', 'commit.gpgsign=false', 'commit', '-m', 'Test source');
  const sha = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', sha);
  git('checkout', '--detach', sha);
  const env = {
    ...process.env,
    GITHUB_ACTIONS: 'true',
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_REPOSITORY: 'ElevenID/website',
    GITHUB_REPOSITORY_ID: '1459542519',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_REF_PROTECTED: 'true',
    GITHUB_WORKFLOW_REF: 'ElevenID/website/.github/workflows/production-website-release.yml@refs/heads/main',
    GITHUB_WORKFLOW_SHA: sha,
    GITHUB_SHA: sha,
    GITHUB_RUN_ID: '1234567890',
    GITHUB_RUN_ATTEMPT: '2',
    RUNNER_ENVIRONMENT: 'github-hosted',
    RUNNER_OS: 'Linux',
    RUNNER_ARCH: 'X64',
    EXPECTED_SOURCE_SHA: sha,
  };
  const run = (overrides = {}) => spawnSync('bash', ['--noprofile', '--norc', '-c', shell('Require the exact protected-main producer')], {
    cwd: root, env: { ...env, ...overrides }, encoding: 'utf8', timeout: 10000,
  });
  return { root, git, sha, run };
}

test('the publisher guard accepts the selected clean protected-main hosted attempt', (t) => {
  const fixture = sourceFixture(t);
  const result = fixture.run();
  assert.equal(result.status, 0, result.stderr);
});

for (const [name, changes] of [
  ['local invocation', { GITHUB_ACTIONS: 'false' }],
  ['another GitHub server', { GITHUB_SERVER_URL: 'https://github.example.invalid' }],
  ['another repository', { GITHUB_REPOSITORY: 'ElevenID/marty-ui' }],
  ['a repository name reused with another numeric identity', { GITHUB_REPOSITORY_ID: '1140864197' }],
  ['a pull request event', { GITHUB_EVENT_NAME: 'pull_request' }],
  ['a feature branch', { GITHUB_REF: 'refs/heads/feature' }],
  ['unprotected main', { GITHUB_REF_PROTECTED: 'false' }],
  ['another signer workflow', { GITHUB_WORKFLOW_REF: 'ElevenID/website/.github/workflows/standalone-qualification.yml@refs/heads/main' }],
  ['workflow code from another source', { GITHUB_WORKFLOW_SHA: 'a'.repeat(40) }],
  ['a self-hosted runner', { RUNNER_ENVIRONMENT: 'self-hosted' }],
  ['another runner OS', { RUNNER_OS: 'Windows' }],
  ['another runner architecture', { RUNNER_ARCH: 'ARM64' }],
  ['an omitted exact source', { EXPECTED_SOURCE_SHA: '' }],
  ['an abbreviated exact source', { EXPECTED_SOURCE_SHA: '1234567' }],
  ['another selected source', { EXPECTED_SOURCE_SHA: 'b'.repeat(40) }],
  ['a zero run ID', { GITHUB_RUN_ID: '0' }],
  ['a zero run attempt', { GITHUB_RUN_ATTEMPT: '0' }],
  ['a noncanonical run attempt', { GITHUB_RUN_ATTEMPT: '01' }],
]) {
  test(`the publisher guard rejects ${name}`, (t) => {
    const result = sourceFixture(t).run(changes);
    assert.notEqual(result.status, 0, 'The protected-main guard admitted an invalid producer');
  });
}

test('the publisher guard checks actual HEAD rather than agreeing environment strings', (t) => {
  const fixture = sourceFixture(t);
  const other = 'c'.repeat(40);
  assert.notEqual(fixture.run({ GITHUB_SHA: other, GITHUB_WORKFLOW_SHA: other, EXPECTED_SOURCE_SHA: other }).status, 0);
});

test('the publisher guard rejects a selected commit outside the fetched main history', (t) => {
  const fixture = sourceFixture(t);
  const tree = fixture.git('rev-parse', 'HEAD^{tree}');
  const unrelated = fixture.git('-c', 'commit.gpgsign=false', 'commit-tree', tree, '-m', 'Unrelated main');
  fixture.git('update-ref', 'refs/remotes/origin/main', unrelated);
  assert.notEqual(fixture.run().status, 0);
});

for (const staged of [false, true]) {
  test(`the publisher guard rejects ${staged ? 'staged' : 'unstaged'} source changes`, (t) => {
    const fixture = sourceFixture(t);
    writeFileSync(path.join(fixture.root, 'tracked.txt'), 'changed source\n');
    if (staged) fixture.git('add', 'tracked.txt');
    assert.notEqual(fixture.run().status, 0);
  });
}

test('the publisher guard rejects an untracked source input', (t) => {
  const fixture = sourceFixture(t);
  writeFileSync(path.join(fixture.root, 'untracked.txt'), 'unreviewed source\n');
  assert.notEqual(fixture.run().status, 0);
});

test('the publisher uses only the fixed manual protected-main release job and permissions', () => {
  const triggers = workflow.slice(workflow.indexOf('\non:\n'), workflow.indexOf('\npermissions:\n'));
  assert.deepEqual([...triggers.matchAll(/^  ([a-z_]+):/gm)].map((match) => match[1]), ['workflow_dispatch']);
  assert.match(triggers, /expected_source_sha:\n(?: +[^\n]+\n)*? +required: true/);
  assert.match(workflow, /if: github\.repository == 'ElevenID\/website' && github\.repository_id == '1459542519' && github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && github\.ref_protected/);
  const permissions = workflow.match(/^    permissions:\n((?:      [^\n]+\n)+)/m)?.[1];
  assert.ok(permissions, 'The release job must declare its own exact permissions');
  assert.deepEqual(Object.fromEntries([...permissions.matchAll(/^      ([a-z-]+): ([a-z]+)$/gm)].map((match) => [match[1], match[2]])), {
    contents: 'read', packages: 'write', 'id-token': 'write', attestations: 'write', 'artifact-metadata': 'write',
  });
  assert.match(workflow, /cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /continue-on-error: true|secrets: inherit/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}\n          fetch-depth: 0\n          persist-credentials: false/);
  assert.match(workflow, /MARTY_WEBSITE_SOURCE_SHA: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow, /repository: ElevenID\/marty-ui|\.migration-source/);
  for (const match of workflow.matchAll(/^\s+(?:- )?uses: (.+)$/gm)) {
    assert.match(match[1], /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]+@[a-f0-9]{40}$/, 'Every action must use an immutable commit');
  }
});

test('the publisher performs all standalone qualification stages before generating its release plan', () => {
  const operations = [
    'Require the exact protected-main producer',
    'node scripts/verify-package-manager.mjs',
    'bun install --frozen-lockfile --linker=hoisted',
    'bun run test',
    'bun run test:nginx',
    'Build and verify independent development fixture',
    'node scripts/verify-standalone-bundle.mjs',
    'node scripts/qualify-rendered-website.mjs',
    'bun run build:website:production',
    'node scripts/build-website-image.mjs',
    'node scripts/qualify-website-nginx.mjs',
    'node scripts/website-qualification.mjs finalize',
    'node scripts/website-release-contract.mjs plan',
  ];
  let previous = -1;
  for (const operation of operations) {
    const position = workflow.indexOf(operation);
    assert.ok(position > previous, `Required qualification stage missing or out of order: ${operation}`);
    previous = position;
  }
  assert.doesNotMatch(workflow, /docker\/build-push-action|docker buildx build/);
});

test('publication, signing, retained-proof verification and upload remain mandatory in order', () => {
  const names = [
    'Validate the standalone release plan against qualified bytes',
    'Prepare pinned publication and consumer verification tools',
    'Authenticate the website registry publication',
    'Publish and bind the already qualified image',
    'Attest the verified registry manifest',
    'Sign the immutable image and release receipt',
    'Attest the exact website release receipt',
    'Retain and anonymously verify original producer proofs',
    'Preserve the fixed original release proof set',
    'Record original artifact and published image identity',
  ];
  let previous = -1;
  for (const name of names) {
    const position = workflow.indexOf(`      - name: ${name}\n`);
    assert.ok(position > previous, `Required publication step missing or out of order: ${name}`);
    assert.doesNotMatch(step(name), /^        (?:if|continue-on-error):/m, 'Release gates cannot be skipped or ignored');
    previous = position;
  }
  const publication = step('Publish and bind the already qualified image');
  assert.match(publication, /id: publication/);
  assert.match(publication, /WEBSITE_EXPECTED_SOURCE_SHA: \$\{\{ inputs\.expected_source_sha \}\}/);
  assert.match(publication, /node scripts\/publish-website-image\.mjs/);
  assert.match(publication, /--output-dir "\$RUNNER_TEMP\/website-release"/);
  assert.match(publication, /--oras "\$RUNNER_TEMP\/website-publisher-tools\/oras"/);
  const proof = step('Retain and anonymously verify original producer proofs');
  assert.match(proof, /python scripts\/website_release_proof\.py/);
  assert.match(proof, /--assets "\$RUNNER_TEMP\/website-release"/);
  assert.match(proof, /--source-sha "\$GITHUB_SHA" --run-id "\$GITHUB_RUN_ID" --run-attempt "\$GITHUB_RUN_ATTEMPT"/);
  assert.match(proof, /--gh "\$RUNNER_TEMP\/web-verifiers\/gh" --cosign "\$RUNNER_TEMP\/web-verifiers\/cosign"/);
  assert.match(proof, /SUBJECT_BUNDLE: \$\{\{ steps\.receipt_provenance\.outputs\.bundle-path \}\}/);
  assert.match(proof, /IMAGE_BUNDLE: \$\{\{ steps\.image_provenance\.outputs\.bundle-path \}\}/);
});

test('registry credentials stay in private publication steps and never reach proof verification', () => {
  const tools = step('Prepare pinned publication and consumer verification tools');
  assert.match(tools, /umask 077/);
  assert.match(tools, /mkdir -m 700 "\$RUNNER_TEMP\/website-publisher-home"/);
  assert.match(tools, /mkdir -m 700 "\$RUNNER_TEMP\/website-publisher-home\/\.docker"/);
  assert.match(tools, /bash scripts\/install_web_verifiers\.sh "\$RUNNER_TEMP\/web-verifiers"/);
  assert.match(tools, /bash scripts\/install_website_publisher_tools\.sh "\$RUNNER_TEMP\/website-publisher-tools"/);
  const login = step('Authenticate the website registry publication');
  assert.match(login, /uses: docker\/login-action@8aa5831fb8d48d8f76594c7ddde61ae58019f550/);
  assert.match(login, /password: \$\{\{ github\.token \}\}/);
  assert.match(login, /logout: true/);
  const authenticated = [
    'Authenticate the website registry publication', 'Publish and bind the already qualified image',
    'Attest the verified registry manifest', 'Sign the immutable image and release receipt',
  ];
  for (const name of authenticated) {
    assert.match(step(name), /DOCKER_CONFIG: \$\{\{ runner\.temp \}\}\/website-publisher-home\/\.docker/);
  }
  assert.equal([...workflow.matchAll(/DOCKER_CONFIG:/g)].length, authenticated.length);
  assert.equal([...workflow.matchAll(/^\s+HOME:/gm)].length, 1, 'Only image attestation receives the private publisher home');
  assert.match(step('Attest the verified registry manifest'), /HOME: \$\{\{ runner\.temp \}\}\/website-publisher-home/);
  assert.doesNotMatch(workflow, /GH_TOKEN:|GITHUB_TOKEN:|secrets\./);
  assert.doesNotMatch(step('Retain and anonymously verify original producer proofs'), /DOCKER_CONFIG|HOME:|github\.token/);
});

test('the attested subjects are the actual immutable publication and only its receipt', () => {
  const image = step('Attest the verified registry manifest');
  const receipt = step('Attest the exact website release receipt');
  for (const item of [image, receipt]) {
    assert.match(item, /uses: actions\/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8/);
  }
  assert.match(image, /subject-name: \$\{\{ env\.IMAGE \}\}/);
  assert.match(image, /subject-digest: \$\{\{ steps\.publication\.outputs\.image_digest \}\}/);
  assert.match(image, /push-to-registry: true/);
  assert.match(receipt, /subject-path: \$\{\{ runner\.temp \}\}\/website-release\/website-release\.json/);
  assert.doesNotMatch(receipt, /push-to-registry|subject-digest/);
});

test('the original run-attempt artifact contains exactly the fixed five proof files', () => {
  const upload = step('Preserve the fixed original release proof set');
  assert.match(upload, /name: web-website-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  const files = upload.match(/          path: \|\n((?:            [^\n]+\n)+)/)?.[1]
    .trim().split('\n').map((line) => line.trim());
  assert.deepEqual(files, [
    'website-release.json', 'website-release.json.sigstore.json', 'website-release.json.provenance.jsonl',
    'image.provenance.jsonl', 'web-surface-routes.json',
  ].map((name) => '${{ runner.temp }}/website-release/' + name));
  assert.match(upload, /if-no-files-found: error/);
  assert.match(upload, /overwrite: false/);
  assert.match(upload, /retention-days: 90/);
});

function signerFixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'website-publisher-signing-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'web-verifiers'), { mode: 0o700 });
  const calls = path.join(root, 'calls.jsonl');
  writeFileSync(calls, '');
  writeFileSync(path.join(root, 'web-verifiers/cosign'), `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
appendFileSync(process.env.SIGNER_CALLS, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.env.FAIL_IMAGE === '1' && process.argv[2] === 'sign') process.exit(1);
`, { mode: 0o700 });
  const run = (overrides = {}) => spawnSync('bash', ['--noprofile', '--norc', '-c', shell('Sign the immutable image and release receipt')], {
    cwd: root,
    env: { PATH: process.env.PATH, RUNNER_TEMP: root, IMAGE: 'ghcr.io/elevenid/website',
      DIGEST: 'sha256:' + 'd'.repeat(64), SIGNER_CALLS: calls, ...overrides },
    encoding: 'utf8', timeout: 10000,
  });
  const commands = () => readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  return { root, run, commands };
}

test('the signing shell signs only the immutable image and exact receipt/bundle paths', (t) => {
  const fixture = signerFixture(t);
  const result = fixture.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fixture.commands(), [
    ['sign', '--yes', 'ghcr.io/elevenid/website@sha256:' + 'd'.repeat(64)],
    ['sign-blob', '--yes', '--bundle', path.join(fixture.root, 'website-release/website-release.json.sigstore.json'),
      path.join(fixture.root, 'website-release/website-release.json')],
  ]);
});

test('a failed image signature stops the signing step before the receipt is signed', (t) => {
  const fixture = signerFixture(t);
  assert.notEqual(fixture.run({ FAIL_IMAGE: '1' }).status, 0);
  assert.equal(fixture.commands().length, 1);
});

test('a malformed publication digest cannot enter the signer', (t) => {
  const fixture = signerFixture(t);
  assert.notEqual(fixture.run({ DIGEST: 'latest' }).status, 0);
  assert.deepEqual(fixture.commands(), []);
});

test('the pinned OCI fixture module bodies match the independently checked action bundle bytes', () => {
  const fixture = readFileSync(new URL('../fixtures/pinned-attest-registry-credentials.cjs', import.meta.url), 'utf8');
  // Independently extracted from dist/index.js Git blob
  // de7bd536a3d24f9562db4507f84abd094ab2cf29 at actions/attest@508db95dd578ae2727ebd6217d5ba78e4fbda05d.
  const expected = [
    ['62691', ',\n96666: ', 'f6806703d4c32371a70cdda4a8d250888d4ad3e587384b38ca2ed0f3eb83a118'],
    ['96666', '\n};\n\nconst cache = new Map();', 'c558015e396ddc8583cdb6064c9f64585c6e40f294854ead9b2678aae66b0ea2'],
  ];
  for (const [identifier, endMarker, digest] of expected) {
    const marker = '\n' + identifier + ': ';
    const position = fixture.indexOf(marker);
    assert.notEqual(position, -1, 'Missing pinned module ' + identifier);
    const start = position + marker.length;
    const end = fixture.indexOf(endMarker, start);
    assert.ok(end > start, 'Missing end of pinned module ' + identifier);
    const actual = createHash('sha256').update(fixture.slice(start, end)).digest('hex');
    assert.equal(actual, digest, 'Pinned OCI module ' + identifier + ' differs from the reviewed upstream bytes');
  }
});

test('the exact pinned OCI helper requires the attestation step private home, not DOCKER_CONFIG alone', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'website-attestation-auth-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const ordinaryHome = path.join(root, 'ordinary-home');
  const publisherHome = path.join(root, 'website-publisher-home');
  for (const directory of [ordinaryHome, publisherHome]) {
    mkdirSync(directory, { mode: 0o700 });
    mkdirSync(path.join(directory, '.docker'), { mode: 0o700 });
  }
  writeFileSync(path.join(ordinaryHome, '.docker/config.json'), '{"auths":{}}\n', { mode: 0o600 });
  writeFileSync(path.join(publisherHome, '.docker/config.json'), JSON.stringify({ auths: {
    'ghcr.io': { auth: Buffer.from('synthetic-user:synthetic-token').toString('base64') },
  } }) + '\n', { mode: 0o600 });
  const reader = fileURLToPath(new URL('../fixtures/pinned-attest-registry-credentials.cjs', import.meta.url));
  const program = `
    const assert = require('node:assert/strict');
    const { getRegistryCredentials } = require(process.argv[1]);
    assert.deepEqual(getRegistryCredentials('ghcr.io/elevenid/website'), {
      headers: undefined, username: 'synthetic-user', password: 'synthetic-token',
    });
  `;
  const invoke = (home) => spawnSync(process.execPath, ['-e', program, reader], {
    cwd: root, env: { HOME: home, DOCKER_CONFIG: path.join(publisherHome, '.docker') },
    encoding: 'utf8', timeout: 10000,
  });
  const oldConfiguration = invoke(ordinaryHome);
  assert.notEqual(oldConfiguration.status, 0);
  assert.match(oldConfiguration.stderr, /No credentials found for registry ghcr\.io/);
  const compatibleConfiguration = invoke(publisherHome);
  assert.equal(compatibleConfiguration.status, 0, compatibleConfiguration.stderr);
  assert.equal(readFileSync(path.join(ordinaryHome, '.docker/config.json'), 'utf8'), '{"auths":{}}\n',
    'Compatibility must not copy credentials into the ordinary runner home');
  // The action pin is part of the fixture's documented provenance. An action
  // upgrade needs a fresh lookup-compatibility check against its shipped code.
  assert.match(step('Attest the verified registry manifest'), /attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8/);
});
