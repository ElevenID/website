import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
export const agentWebsiteAdaptation = JSON.parse(readFileSync(
  new URL('contracts/website-agent-protocol-adaptation.json', root), 'utf8',
));
export const gitBlob = (bytes) => createHash('sha1')
  .update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

// Historical extraction receipts stay immutable. An intentional website edit
// must join their exact prior blob to its reviewed current bytes.
export function assertAgentWebsiteAdaptation(path, { originalBlob, previousBlob }) {
  const entry = agentWebsiteAdaptation.adapted_files.find((item) => item.path === path);
  if (!entry) return false;
  assert.equal(entry.source_original_blob, originalBlob, path);
  assert.equal(entry.previous_extracted_blob, previousBlob, path);
  assert.ok(entry.change.length > 0, path);
  const file = new URL(path, root);
  assert.ok(lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink(), path);
  const bytes = readFileSync(file);
  assert.equal(bytes.length, entry.current_bytes, path);
  assert.equal(gitBlob(bytes), entry.current_blob, path);
  return true;
}
