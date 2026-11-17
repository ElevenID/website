import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync, constants, fstatSync, linkSync, lstatSync, mkdirSync, mkdtempSync,
  openSync, readFileSync, realpathSync, rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';

const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_BATCH_BYTES = 64 * 1024 * 1024;
export const gitBlobHash = (bytes) => createHash('sha1')
  .update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

export function validateAssets(assets) {
  if (!Array.isArray(assets) || assets.length === 0) throw new Error('Asset set must be nonempty');
  const seen = new Set();
  let total = 0;
  for (const asset of assets) {
    if (!asset || typeof asset.path !== 'string'
      || !/^[a-z0-9._-]+(?:\/[a-z0-9._-]+)*$/.test(asset.path)
      || asset.path.split('/').some((part) => part === '.' || part === '..')) {
      throw new Error('Unsafe asset path');
    }
    if (seen.has(asset.path)) throw new Error(`Duplicate asset path: ${asset.path}`);
    seen.add(asset.path);
    if (typeof asset.sha !== 'string' || !/^[a-f0-9]{40}$/.test(asset.sha)) {
      throw new Error(`Invalid blob identity: ${asset.path}`);
    }
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes < 0 || asset.bytes > MAX_FILE_BYTES) {
      throw new Error(`Invalid asset size: ${asset.path}`);
    }
    total += asset.bytes;
    if (total > MAX_BATCH_BYTES) throw new Error('Asset set exceeds bounded transfer size');
  }
  for (const asset of assets) {
    const parts = asset.path.split('/');
    for (let length = 1; length < parts.length; length++) {
      if (seen.has(parts.slice(0, length).join('/'))) throw new Error('Asset file/directory collision');
    }
  }
  return assets;
}

function realDirectory(root) {
  const resolved = path.resolve(root);
  const info = lstatSync(resolved, { throwIfNoEntry: false });
  if (!info?.isDirectory() || info.isSymbolicLink() || realpathSync(resolved) !== resolved) {
    throw new Error('Asset root must be an existing non-symlink directory');
  }
  return resolved;
}

// Inspect every parent before reading or creating anything beneath it. The
// root itself is a valid parent (favicon.svg), not an escaping path.
function checkedParent(root, relative, create = false) {
  let directory = root;
  for (const part of relative.split('/').slice(0, -1)) {
    directory = path.join(directory, part);
    let info = lstatSync(directory, { throwIfNoEntry: false });
    if (!info) {
      if (!create) return null;
      try { mkdirSync(directory, { mode: 0o755 }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      info = lstatSync(directory);
    }
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Unsafe asset parent: ${relative}`);
  }
  return directory;
}

function readExisting(root, asset) {
  if (checkedParent(root, asset.path) === null) return false;
  const filename = path.join(root, asset.path);
  const info = lstatSync(filename, { throwIfNoEntry: false });
  if (!info) return false;
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size !== asset.bytes) {
    throw new Error(`Asset conflict or nonregular file: ${asset.path}`);
  }
  const descriptor = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.nlink !== 1 || opened.size !== asset.bytes
      || opened.dev !== info.dev || opened.ino !== info.ino) {
      throw new Error(`Asset changed during verification: ${asset.path}`);
    }
    const bytes = readFileSync(descriptor);
    if (bytes.length !== asset.bytes || gitBlobHash(bytes) !== asset.sha) {
      throw new Error(`Asset identity mismatch: ${asset.path}`);
    }
  } finally { closeSync(descriptor); }
  return true;
}

export function selectPublicAssets(inventory, reconciliation = []) {
  if (inventory?.schema_version !== 1 || !Array.isArray(inventory.files)
    || !inventory.categories || !Array.isArray(reconciliation)) throw new Error('Invalid asset inventory');
  const selected = [];
  for (const entry of inventory.files) {
    const disposition = Object.hasOwn(inventory.categories, entry.category)
      ? inventory.categories[entry.category]?.disposition : undefined;
    if (!['include', 'retain_output_parity', 'exclude'].includes(disposition)) {
      throw new Error(`Unclassified public asset: ${entry.path}`);
    }
    if (disposition !== 'exclude') selected.push({ path: entry.path, sha: entry.blob_sha, bytes: entry.size_bytes });
  }
  const reconciled = new Set();
  for (const change of reconciliation) {
    if (change.path !== 'ui/public/locales/en/marketing.json' || reconciled.has(change.path)) {
      throw new Error('Unexpected or duplicate public reconciliation');
    }
    const entry = selected.find((asset) => `ui/public/${asset.path}` === change.path);
    if (!entry || entry.sha !== change.source_blob_sha || entry.bytes !== change.source_size_bytes) {
      throw new Error('Reconciliation does not match the original asset');
    }
    entry.sha = change.current_blob_sha;
    entry.bytes = change.current_size_bytes;
    reconciled.add(change.path);
  }
  return validateAssets(selected);
}

export function verifyPublicAssets(publicRoot, assets) {
  validateAssets(assets);
  const root = realDirectory(publicRoot);
  const errors = [];
  for (const asset of assets) {
    try {
      if (!readExisting(root, asset)) errors.push(`Missing asset: ${asset.path}`);
    } catch (error) { errors.push(error.message); }
  }
  return { selected: assets.length, passed: assets.length - errors.length, failed: errors.length, errors };
}

export function importPinnedAssets({ sourceRoot, publicRoot, sourceCommit, assets }) {
  validateAssets(assets);
  if (typeof sourceCommit !== 'string' || !/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error('Exact source commit required');
  const source = realpathSync(sourceRoot);
  const root = realDirectory(publicRoot);
  if (source === root || source.startsWith(root + path.sep) || root.startsWith(source + path.sep)) {
    throw new Error('Source and destination must be separate trees');
  }
  const git = (args, maximum = 8192) => execFileSync('git', ['-C', source, '--literal-pathspecs', ...args], {
    encoding: null, maxBuffer: maximum, timeout: 30000,
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (git(['cat-file', '-t', sourceCommit]).toString().trim() !== 'commit') throw new Error('Source is not a commit');

  // Validate the entire source and destination set before any destination write.
  // Publication is atomic per file, not a multi-file filesystem transaction.
  const plan = assets.map((asset) => {
    const name = `ui/public/${asset.path}`;
    const identity = git(['ls-tree', '-z', sourceCommit, '--', name]).toString('utf8');
    if (identity !== `100644 blob ${asset.sha}\t${name}\0`) throw new Error(`Unexpected source entry: ${asset.path}`);
    const bytes = git(['cat-file', 'blob', asset.sha], asset.bytes + 8192);
    if (bytes.length !== asset.bytes || gitBlobHash(bytes) !== asset.sha) throw new Error(`Source integrity failure: ${asset.path}`);
    return { asset, bytes, present: readExisting(root, asset) };
  });
  let created = 0;
  let verified = plan.filter((entry) => entry.present).length;
  const pending = plan.filter((entry) => !entry.present);
  if (pending.length === 0) return { source_commit: sourceCommit, planned: assets.length, created, already_verified: verified };
  const staging = mkdtempSync(path.join(root, '.asset-import-'));
  try {
    for (let index = 0; index < pending.length; index++) {
      writeFileSync(path.join(staging, String(index)), pending[index].bytes, { flag: 'wx', mode: 0o644 });
    }
    for (let index = 0; index < pending.length; index++) {
      const { asset } = pending[index];
      checkedParent(root, asset.path, true);
      if (readExisting(root, asset)) { verified++; continue; }
      // linkSync refuses EEXIST: unlike rename, it never overwrites a file that
      // appeared after preflight. Temp and output reside on the same filesystem.
      linkSync(path.join(staging, String(index)), path.join(root, asset.path));
      rmSync(path.join(staging, String(index)));
      created++;
    }
  } finally { rmSync(staging, { recursive: true, force: true }); }
  return { source_commit: sourceCommit, planned: assets.length, created, already_verified: verified };
}
