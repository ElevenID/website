import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (filename) => JSON.parse(readFileSync(new URL('../' + filename, import.meta.url), 'utf8'));
const record = read('contracts/extraction-provenance-batch-27.json');
const initial = read('contracts/extraction-provenance.json');
const previous = read('contracts/extraction-provenance-batch-26.json');
const paths = [
  'ui/scripts/production-build-contract.mjs',
  'ui/scripts/web-surface-build-contract.mjs',
  'ui/scripts/web-surface-build-contract.test.mjs',
];

test('full producer adaptation extends the immutable extraction history for exactly three reviewed files', () => {
  assert.equal(record.schema_version, 1);
  assert.equal(record.purpose, 'post-extraction-adaptation-record');
  assert.equal(record.source_repository, 'ElevenID/marty-ui');
  assert.equal(record.immutable_source_commit, 'df6ec6c4bfee803d89c54e9333297f29f378cee3');
  assert.equal(record.extends, 'contracts/extraction-provenance-batch-26.json');
  assert.equal(record.previous_website_source, '7a505074558219239850ff1681275facd42c369b');
  assert.equal(record.adapted_website_source, '78174699a0ad5e534b8f75d5db2c399d09d8b9c7');
  assert.deepEqual(record.adapted_files.map((entry) => entry.path).sort(), paths);
  for (const entry of record.adapted_files) {
    const priorAdaptation = previous.adapted_files.find((item) => item.path === entry.path);
    const original = initial.files.find((item) => item.target_path === entry.path);
    assert.equal(entry.source_original_blob, priorAdaptation?.source_original_blob ?? original.git_blob_sha1);
    assert.equal(entry.previous_extracted_blob, priorAdaptation?.current_blob ?? original.git_blob_sha1);
    assert.ok(entry.change.length > 0);
    const filename = new URL('../' + entry.path, import.meta.url);
    assert.ok(lstatSync(filename).isFile() && !lstatSync(filename).isSymbolicLink());
    const bytes = readFileSync(filename);
    assert.equal(bytes.length, entry.current_bytes);
    assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), entry.current_blob);
  }
});
