import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assertAgentWebsiteAdaptation } from './fixtures/website-agent-adaptation.mjs';

const provenance = JSON.parse(readFileSync(
  new URL('../contracts/extraction-provenance-batch-12.json', import.meta.url), 'utf8',
));
const expectedPaths = [
  "scripts/ui-production-start.sh",
  "ui/scripts/build-web-surface.mjs",
  "ui/scripts/generate-demo-manifest-module.mjs",
  "ui/src/components/IdentityGuidePage.jsx",
  "ui/src/components/ProtocolPage.jsx",
  "ui/src/components/StandardsPage.jsx",
  "ui/src/generated/demoWalletSchema.generated.json"
];

test('batch 12 keeps a bounded provenance shard with the immutable source pin', () => {
  assert.equal(provenance.schema_version, 1);
  assert.equal(provenance.purpose, 'source-extraction-record');
  assert.deepEqual(provenance.source, {
    repository: 'ElevenID/marty-ui',
    commit: 'df6ec6c4bfee803d89c54e9333297f29f378cee3',
  });
  assert.equal(provenance.extends, 'contracts/extraction-provenance-batch-11.json');
  const entries = [...provenance.files, ...provenance.adapted_files];
  assert.deepEqual(entries.map((entry) => entry.target_path).sort(), expectedPaths);
  for (const entry of entries) {
    assert.equal(entry.source_path, entry.target_path);
    assert.ok(entry.bytes > 0 && entry.bytes < 16 * 1024, entry.target_path);
    assert.match(entry.git_blob_sha1 || entry.source_git_blob_sha1, /^[a-f0-9]{40}$/);
  }
});

test('batch 12 preserved and adapted files match their recorded blob identities', () => {
  for (const [entries, adapted] of [[provenance.files, false], [provenance.adapted_files, true]]) {
    for (const entry of entries) {
      const file = new URL(`../${entry.target_path}`, import.meta.url);
      assert.ok(lstatSync(file).isFile(), entry.target_path);
      // Later adaptations keep the original checkpoint identity immutable.
      // Batch 18 owns the current TypeScript 7 CLI adaptation and tests its blob.
      if (entry.target_path === 'ui/scripts/build-web-surface.mjs') {
        assert.equal(entry.target_git_blob_sha1, '838dff8947aeece58debcdb1680a345c9f433d5f');
        continue;
      }
      const bytes = readFileSync(file);
      const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      if (adapted) {
        assert.ok(entry.changes.length > 0, entry.target_path);
        if (assertAgentWebsiteAdaptation(entry.target_path, {
          originalBlob: entry.source_git_blob_sha1, previousBlob: entry.target_git_blob_sha1,
        })) continue;
        assert.equal(bytes.length, entry.target_bytes, entry.target_path);
        assert.ok(bytes.length < 16 * 1024, entry.target_path);
        assert.equal(hash, entry.target_git_blob_sha1, entry.target_path);
      } else {
        assert.equal(entry.transfer, 'verbatim');
        if (assertAgentWebsiteAdaptation(entry.target_path, {
          originalBlob: entry.git_blob_sha1, previousBlob: entry.git_blob_sha1,
        })) continue;
        assert.equal(bytes.length, entry.bytes, entry.target_path);
        assert.equal(hash, entry.git_blob_sha1, entry.target_path);
      }
    }
  }
});
