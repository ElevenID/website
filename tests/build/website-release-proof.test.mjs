import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('website-only Python proof verification preserves original identity, file and credential boundaries', { timeout: 90000 }, () => {
  const result = spawnSync('python3', ['-I', '-B', 'tests/fixtures/website_release_proof_test.py', process.execPath], {
    cwd: root, encoding: 'utf8', timeout: 85000, maxBuffer: 1024 * 1024,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('the verifier installer retains the exact reviewed consumer bytes and fixed releases', () => {
  const bytes = readFileSync(new URL('../../scripts/install_web_verifiers.sh', import.meta.url));
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(blob, '661fad5047e92c98f38d07e91a48c7d35f8cc12a');
  const source = bytes.toString('utf8');
  assert.match(source, /gh_2\.103\.2_linux_amd64\.tar\.gz/);
  assert.match(source, /cosign\/releases\/download\/v3\.1\.4\/cosign-linux-amd64/);
  assert.match(source, /62ccf747115ddc61237efffdde66a3c8f70ba249433dc64f70801089b59c59c8/);
  assert.match(source, /424e2c97d0b45fd7a6b608a87f090f35633f4c23ece5f092d48bba11aaf4bbfa/);
});
