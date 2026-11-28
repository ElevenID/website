import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { SHARED_HEADER_FILES, verifyHeaderSource } from '../ui/src/shared/web-layout/verify-source.mjs';

const root = new URL('../', import.meta.url);
const shared = new URL('ui/src/shared/web-layout/', root);
const record = JSON.parse(readFileSync(new URL('contracts/shared-web-header-adaptation.json', root), 'utf8'));
const gitBlob = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

test('the standalone website consumes the exact reviewed general header snapshot', () => {
  const source = verifyHeaderSource(shared);
  assert.equal(source.owner, 'ElevenID/marty-ui');
  assert.equal(record.canonical_source.repository, source.owner);
  assert.equal(record.canonical_source.directory, source.sourceDirectory);
  assert.equal(record.canonical_source.revision, source.revision);
  assert.equal(record.previous_website_source, '3dad3d57d8d3cde8eeeaabc8b893bd3cf03fb5bd');
  const previous = JSON.parse(readFileSync(new URL('contracts/website-pages-application-handoff-adaptation.json', root), 'utf8'));
  const original = previous.adapted_files.find((entry) => entry.path === 'ui/src/apps/website/WebsiteApp.jsx');
  const adapted = record.adapted_files.find((entry) => entry.path === original.path);
  assert.equal(adapted.source_original_blob, original.source_original_blob);
  assert.equal(adapted.previous_blob, original.current_blob);
  for (const entry of [...record.adapted_files, ...record.added_files]) {
    const bytes = readFileSync(new URL(entry.path, root));
    assert.equal(bytes.length, entry.bytes, entry.path);
    assert.equal(gitBlob(bytes), entry.current_blob, entry.path);
  }
  const app = readFileSync(new URL('ui/src/apps/website/WebsiteApp.jsx', root), 'utf8');
  assert.ok(app.includes('<AppHeader brandName={branding.appName}'));
  assert.ok(!app.includes('<AppBar'));
});

test('a modified vendored header is rejected before the website builds', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'elevenid-website-header-'));
  try {
    for (const name of [...SHARED_HEADER_FILES, 'source.json']) cpSync(new URL(name, shared), join(temporary, name));
    const directory = pathToFileURL(`${temporary}/`);
    verifyHeaderSource(directory);
    writeFileSync(join(temporary, 'header.mjs'), 'export const drift = true;\n');
    assert.throws(() => verifyHeaderSource(directory), /differs from its pinned snapshot/);
    const build = readFileSync(new URL('ui/vite.config.mjs', root), 'utf8');
    assert.ok(build.includes("verifyHeaderSource(new URL('./src/shared/web-layout/', import.meta.url))"));
  } finally {
    rmSync(temporary, { recursive: true });
  }
});
