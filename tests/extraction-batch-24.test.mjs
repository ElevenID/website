import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const receipt = JSON.parse(readFileSync(new URL('contracts/extraction-provenance-batch-24.json', root)));

test('publisher verification records its exact merged consumer lineage', () => {
  assert.equal(receipt.source_repository, 'ElevenID/marty-ui');
  assert.equal(receipt.immutable_source_commit, '983cc226ba4b11defc6f10d01404e52200e34bea');
  assert.equal(receipt.extends, 'contracts/extraction-provenance-batch-23.json');
  assert.equal(receipt.files.length, 1);
  assert.equal(receipt.adapted_files.length, 1);
  assert.equal(receipt.files[0].source_git_blob_sha1, '661fad5047e92c98f38d07e91a48c7d35f8cc12a');
  assert.equal(receipt.files[0].source_git_blob_sha1, receipt.files[0].current_blob);
  assert.deepEqual(receipt.adapted_files[0].source_files, [
    { path: 'scripts/website_provenance.py', source_original_blob: 'cd8ee0a16e2c8bc47c9856173c5bb1d8a3156e4d' },
    { path: 'scripts/web_producer_evidence.py', source_original_blob: '052a4854abaaa8d4181bf9d95b9ee3d9fa525d77' },
    { path: 'scripts/web_auth.py', source_original_blob: 'ccba3a985fbfdc0ea36f20cee0d04712cf50a59d' },
    { path: 'scripts/verify_installer_provenance.py', source_original_blob: 'd355c41d760aa7db85422637b915d5747a045758' },
    { path: 'scripts/website_release.py', source_original_blob: '5f1177b3a4fb12b7ef7e76011ef36320827b7def' },
  ]);
});

test('publisher copied and adapted bytes match their extraction receipt', () => {
  for (const item of [...receipt.files, ...receipt.adapted_files]) {
    const filename = item.target_path || item.path;
    const bytes = readFileSync(new URL(filename, root));
    assert.equal(bytes.length, item.current_bytes, filename);
    assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), item.current_blob, filename);
  }
});
