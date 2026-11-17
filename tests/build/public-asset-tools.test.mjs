import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  gitBlobHash, importPinnedAssets, selectPublicAssets, validateAssets, verifyPublicAssets,
} from '../../scripts/lib/public-asset-integrity.mjs';

const bytesFor = (name) => Buffer.from(name.endsWith('.svg') ? '<svg>fixture</svg>' : '\x00fixture\xff', 'latin1');
function fixture(t, names = ['favicon.svg', 'images/authors/example.png']) {
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'website asset test '));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const sourceRoot = path.join(temporary, 'source checkout');
  const publicRoot = path.join(temporary, 'website', 'ui', 'public');
  mkdirSync(sourceRoot, { recursive: true });
  mkdirSync(publicRoot, { recursive: true });
  const git = (...args) => execFileSync('git', ['-C', sourceRoot, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' },
  }).trim();
  git('init', '-q');
  const assets = names.map((name) => {
    const bytes = bytesFor(name);
    const full = path.join(sourceRoot, 'ui/public', name);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, bytes);
    return { path: name, sha: gitBlobHash(bytes), bytes: bytes.length };
  });
  git('add', '.');
  git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture');
  return { sourceRoot, publicRoot, sourceCommit: git('rev-parse', 'HEAD'), assets, git, temporary };
}
const options = (f, overrides = {}) => ({ sourceRoot: f.sourceRoot, publicRoot: f.publicRoot,
  sourceCommit: f.sourceCommit, assets: f.assets, ...overrides });
const noOutput = (f) => assert.deepEqual(readdirSync(f.publicRoot), []);

// This root-parent equality case failed in the original importer before it
// wrote its first file; use actual Git objects, not a substituted blob reader.
test('imports root SVG and nested binary from exact Git objects with spaces in paths', (t) => {
  const f = fixture(t);
  const result = importPinnedAssets(options(f));
  assert.equal(result.created, 2);
  assert.equal(result.already_verified, 0);
  assert.equal(result.source_commit, f.sourceCommit);
  for (const a of f.assets) {
    const filename = path.join(f.publicRoot, a.path);
    assert.equal(gitBlobHash(readFileSync(filename)), a.sha);
    assert.equal(lstatSync(filename).nlink, 1);
  }
  assert.equal(verifyPublicAssets(f.publicRoot, f.assets).failed, 0);
  assert.equal(readdirSync(f.publicRoot).some((n) => n.startsWith('.asset-import-')), false);
});

test('repeat import is a no-write verification, preserving timestamps', (t) => {
  const f = fixture(t);
  importPinnedAssets(options(f));
  const stamp = statSync(path.join(f.publicRoot, 'favicon.svg')).mtimeMs;
  assert.deepEqual(importPinnedAssets(options(f)), {
    source_commit: f.sourceCommit, planned: 2, created: 0, already_verified: 2,
  });
  assert.equal(statSync(path.join(f.publicRoot, 'favicon.svg')).mtimeMs, stamp);
});

test('late destination conflict prevents any earlier asset being published', (t) => {
  const f = fixture(t);
  const filename = path.join(f.publicRoot, f.assets[1].path);
  mkdirSync(path.dirname(filename), { recursive: true });
  writeFileSync(filename, 'keep my work');
  assert.throws(() => importPinnedAssets(options(f)), /conflict/);
  assert.equal(existsSync(path.join(f.publicRoot, 'favicon.svg')), false);
  assert.equal(readFileSync(filename, 'utf8'), 'keep my work');
});

test('late source integrity failure cannot partially import earlier assets', (t) => {
  const f = fixture(t);
  const assets = f.assets.map((a) => ({ ...a }));
  assets[1].bytes++;
  assert.throws(() => importPinnedAssets(options(f, { assets })), /integrity/);
  noOutput(f);
});

test('wrong source blob rejects the complete set before writing', (t) => {
  const f = fixture(t);
  const assets = f.assets.map((a) => ({ ...a, sha: '0'.repeat(40) }));
  assert.throws(() => importPinnedAssets(options(f, { assets })), /source entry/);
  noOutput(f);
});

test('source working-tree modifications cannot replace pinned Git objects', (t) => {
  const f = fixture(t);
  writeFileSync(path.join(f.sourceRoot, 'ui/public/favicon.svg'), 'uncommitted content');
  importPinnedAssets(options(f));
  assert.equal(gitBlobHash(readFileSync(path.join(f.publicRoot, 'favicon.svg'))), f.assets[0].sha);
});

test('source symlink modes are rejected even when blob content matches', (t) => {
  const f = fixture(t, ['favicon.svg']);
  const original = path.join(f.sourceRoot, 'ui/public/favicon.svg');
  rmSync(original);
  symlinkSync('outside.svg', original);
  f.git('add', '.');
  f.git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'symlink');
  const bytes = Buffer.from('outside.svg');
  assert.throws(() => importPinnedAssets(options(f, {
    sourceCommit: f.git('rev-parse', 'HEAD'),
    assets: [{ path: 'favicon.svg', sha: gitBlobHash(bytes), bytes: bytes.length }],
  })), /source entry/);
  noOutput(f);
});

test('missing source object leaves destination untouched', (t) => {
  const f = fixture(t);
  assert.throws(() => importPinnedAssets(options(f, { sourceCommit: '0'.repeat(40) })));
  noOutput(f);
});

test('symbolic destination root is rejected', (t) => {
  const f = fixture(t);
  const alias = path.join(f.temporary, 'public-alias');
  symlinkSync(f.publicRoot, alias);
  assert.throws(() => importPinnedAssets(options(f, { publicRoot: alias })), /non-symlink/);
  noOutput(f);
});

test('ancestor symlink is rejected before creating any external directory', (t) => {
  const f = fixture(t);
  const external = path.join(f.temporary, 'outside');
  mkdirSync(external);
  symlinkSync(external, path.join(f.publicRoot, 'images'));
  assert.throws(() => importPinnedAssets(options(f)), /Unsafe asset parent/);
  assert.deepEqual(readdirSync(external), []);
  assert.equal(existsSync(path.join(f.publicRoot, 'favicon.svg')), false);
});

test('dangling destination link is never replaced', (t) => {
  const f = fixture(t);
  symlinkSync('missing-target', path.join(f.publicRoot, 'favicon.svg'));
  assert.throws(() => importPinnedAssets(options(f)), /nonregular/);
  assert.equal(lstatSync(path.join(f.publicRoot, 'favicon.svg')).isSymbolicLink(), true);
});

test('hard-linked destination cannot be treated as independent custody', (t) => {
  const f = fixture(t);
  const external = path.join(f.temporary, 'outside.svg');
  writeFileSync(external, bytesFor('favicon.svg'));
  linkSync(external, path.join(f.publicRoot, 'favicon.svg'));
  assert.throws(() => importPinnedAssets(options(f)), /nonregular/);
  assert.equal(lstatSync(external).nlink, 2);
});

test('file occupying a destination parent is rejected', (t) => {
  const f = fixture(t);
  writeFileSync(path.join(f.publicRoot, 'images'), 'existing');
  assert.throws(() => importPinnedAssets(options(f)), /Unsafe asset parent/);
  assert.equal(readFileSync(path.join(f.publicRoot, 'images'), 'utf8'), 'existing');
});

test('destination nested in source checkout is forbidden', (t) => {
  const f = fixture(t);
  assert.throws(() => importPinnedAssets(options(f, { publicRoot: path.join(f.sourceRoot, 'ui/public') })), /separate trees/);
});

test('empty, coercible, noncanonical and duplicate asset identities fail closed', () => {
  const valid = { path: 'x.svg', sha: 'a'.repeat(40), bytes: 1 };
  for (const name of ['../x', '/x', 'x/../y', 'x/./y', 'x//y', 'x\\y', 'x\ny', 'https://x', '%2e/x', '.', '..', '']) {
    assert.throws(() => validateAssets([{ ...valid, path: name }]), /Unsafe/);
  }
  for (const value of [[], {}, '1', -1, NaN, Infinity, 1.5]) {
    assert.throws(() => validateAssets([{ ...valid, bytes: value }]), /size/);
  }
  assert.throws(() => validateAssets([]), /nonempty/);
  assert.throws(() => validateAssets([valid, valid]), /Duplicate/);
  assert.throws(() => validateAssets([valid, { ...valid, path: 'x.svg/y' }]), /collision/);
  assert.throws(() => validateAssets([{ ...valid, sha: ['a'.repeat(40)] }]), /identity/);
});

test('asset verifier reports missing files without fetching or creating them', (t) => {
  const f = fixture(t);
  const result = verifyPublicAssets(f.publicRoot, f.assets);
  assert.equal(result.selected, 2);
  assert.equal(result.failed, 2);
  assert.match(result.errors[0], /favicon.svg/);
  noOutput(f);
});

test('asset verifier rejects parent symlinks even with correct referenced bytes', (t) => {
  const f = fixture(t);
  importPinnedAssets(options(f));
  const directory = path.join(f.publicRoot, 'images');
  rmSync(directory, { recursive: true });
  symlinkSync(path.join(f.sourceRoot, 'ui/public/images'), directory);
  const result = verifyPublicAssets(f.publicRoot, f.assets);
  assert.equal(result.passed, 1);
  assert.match(result.errors[0], /Unsafe asset parent/);
});

test('asset verifier detects same-length altered bytes and directories', (t) => {
  const f = fixture(t);
  importPinnedAssets(options(f));
  writeFileSync(path.join(f.publicRoot, 'favicon.svg'), Buffer.alloc(f.assets[0].bytes, 65));
  const second = path.join(f.publicRoot, f.assets[1].path);
  rmSync(second);
  mkdirSync(second);
  const result = verifyPublicAssets(f.publicRoot, f.assets);
  assert.equal(result.failed, 2);
  assert.match(result.errors[0], /identity mismatch/);
  assert.match(result.errors[1], /nonregular/);
});

function inventory() {
  return {
    schema_version: 1,
    categories: { public: { disposition: 'include' }, old: { disposition: 'retain_output_parity' }, app: { disposition: 'exclude' } },
    files: [
      { path: 'locales/en/marketing.json', blob_sha: 'a'.repeat(40), size_bytes: 10, category: 'public' },
      { path: '.well-known/ai-plugin.json', blob_sha: 'c'.repeat(40), size_bytes: 10, category: 'old' },
      { path: 'locales/en/console.json', blob_sha: 'd'.repeat(40), size_bytes: 10, category: 'app' },
    ],
  };
}
const change = () => ({ path: 'ui/public/locales/en/marketing.json', source_blob_sha: 'a'.repeat(40), source_size_bytes: 10,
  current_blob_sha: 'b'.repeat(40), current_size_bytes: 11 });

test('selection preserves explicit compatibility output and excludes product locales', () => {
  const input = inventory();
  const original = JSON.stringify(input);
  assert.equal(selectPublicAssets(input).length, 2);
  assert.equal(JSON.stringify(input), original);
});

test('English reconciliation enforces the new blob and the new byte count', () => {
  const selected = selectPublicAssets(inventory(), [change()]);
  assert.equal(selected[0].sha, 'b'.repeat(40));
  assert.equal(selected[0].bytes, 11);
});

test('unknown category and invalid disposition cannot silently enter the website', () => {
  const unknown = inventory();
  unknown.files[0].category = '__proto__';
  assert.throws(() => selectPublicAssets(unknown), /Unclassified/);
  const wrong = inventory();
  wrong.categories.public.disposition = 'maybe';
  assert.throws(() => selectPublicAssets(wrong), /Unclassified/);
});

test('reconciliation rejects source drift, arbitrary paths and duplicate overrides', () => {
  assert.throws(() => selectPublicAssets(inventory(), [{ ...change(), source_size_bytes: 8 }]), /original asset/);
  assert.throws(() => selectPublicAssets(inventory(), [{ ...change(), source_blob_sha: 'f'.repeat(40) }]), /original asset/);
  assert.throws(() => selectPublicAssets(inventory(), [{ ...change(), path: 'ui/public/favicon.svg' }]), /Unexpected/);
  assert.throws(() => selectPublicAssets(inventory(), [change(), change()]), /duplicate/);
});

test('large asset contract remains exactly pinned to eight original blobs', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../contracts/large-public-assets.json', import.meta.url), 'utf8'));
  assert.equal(manifest.source_commit, 'df6ec6c4bfee803d89c54e9333297f29f378cee3');
  assert.equal(manifest.source_repository, 'ElevenID/marty-ui');
  assert.equal(manifest.assets.length, 8);
  assert.equal(manifest.assets.reduce((total, a) => total + a.bytes, 0), 16574562);
  validateAssets(manifest.assets);
});

test('actual CLI rejects relative source paths before touching the checkout', () => {
  assert.throws(() => execFileSync(process.execPath, [
    new URL('../../scripts/import-large-public-assets.mjs', import.meta.url).pathname, '--source', 'relative',
  ], { stdio: 'pipe' }), /Usage/);
});
