import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const provenance = JSON.parse(readFileSync(
  new URL('../contracts/extraction-provenance-batch-11.json', import.meta.url), 'utf8',
));
const expectedPaths = [
  'ui/nginx.website.conf',
  'ui/nginx.website.headers.conf',
  'ui/scripts/assert-website-dist.mjs',
  'ui/scripts/render-website-nginx.mjs',
  'ui/scripts/web-surface-build-contract.mjs',
  'ui/scripts/web-surface-build-contract.test.mjs',
  'ui/src/components/landing/DeploymentModelsSection.jsx',
  'ui/src/components/landing/EndUserExperienceSection.jsx',
  'ui/src/components/landing/ProductCapabilitiesSection.jsx',
  'ui/src/components/landing/ProofLabSection.jsx',
  'ui/src/components/pages/AiCapabilityPage.jsx',
  'ui/src/components/pages/MarketingProtocolSupportCatalog.jsx',
];

test('batch 11 keeps a bounded provenance shard with the immutable source pin', () => {
  assert.equal(provenance.schema_version, 1);
  assert.equal(provenance.purpose, 'source-extraction-record');
  assert.deepEqual(provenance.source, {
    repository: 'ElevenID/marty-ui',
    commit: 'df6ec6c4bfee803d89c54e9333297f29f378cee3',
  });
  assert.equal(provenance.extends, 'contracts/extraction-provenance.json');
  const entries = [...provenance.files, ...provenance.adapted_files];
  assert.deepEqual(entries.map((entry) => entry.target_path).sort(), expectedPaths);
  for (const entry of entries) {
    assert.equal(entry.source_path, entry.target_path);
    assert.ok(entry.bytes > 0 && entry.bytes < 16 * 1024, entry.target_path);
    assert.match(entry.git_blob_sha1 || entry.source_git_blob_sha1, /^[a-f0-9]{40}$/);
  }
});

test('batch 11 preserved and adapted files match their recorded blob identities', () => {
  for (const [entries, adapted] of [[provenance.files, false], [provenance.adapted_files, true]]) {
    for (const entry of entries) {
      const file = new URL(`../${entry.target_path}`, import.meta.url);
      assert.ok(lstatSync(file).isFile(), entry.target_path);
      const bytes = readFileSync(file);
      const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      if (adapted) {
        assert.ok(entry.changes.length > 0, entry.target_path);
        assert.equal(hash, entry.target_git_blob_sha1, entry.target_path);
      } else {
        assert.equal(entry.transfer, 'verbatim');
        assert.equal(bytes.length, entry.bytes, entry.target_path);
        assert.equal(hash, entry.git_blob_sha1, entry.target_path);
      }
    }
  }
});
