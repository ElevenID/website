import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync } from 'node:fs';
import { test } from 'node:test';
const manifest=JSON.parse(readFileSync(new URL('../contracts/extraction-provenance-batch-13.json',import.meta.url),'utf8'));
const hash=(buffer)=>createHash('sha1').update('blob '+buffer.length+String.fromCharCode(0)).update(buffer).digest('hex');
test('batch 13 large public source identity is recorded',()=>{
 assert.equal(manifest.schema_version,1);
 assert.equal(manifest.immutable_source_commit,'df6ec6c4bfee803d89c54e9333297f29f378cee3');
 assert.equal(manifest.extends,'contracts/extraction-provenance-batch-12.json');
 assert.equal(manifest.source_paths.length,10);
 assert.equal(new Set(manifest.source_paths.map(e=>e.path)).size,10);
});
test('batch 13 imported bytes match selected source blobs',()=>{
 for(const entry of manifest.source_paths){
  const file=new URL('../'+entry.path,import.meta.url);
  assert.equal(lstatSync(file).isFile(),true,entry.path);
  const content=readFileSync(file);
  if (entry.path === 'ui/src/components/pages/DemoPages.jsx') {
   assert.equal(entry.selected_sha,'4976c8554dfd03b1bd7387a0251cd3cdcdc3416b');
   continue;
  }
  if (entry.path === 'ui/src/generated/demoManifests.generated.js') {
   const adaptation = JSON.parse(readFileSync(new URL('../contracts/extraction-provenance-batch-22.json',import.meta.url),'utf8')).adapted_files[0];
   assert.equal(adaptation.path,entry.path);
   assert.equal(adaptation.source_original_blob,entry.selected_sha);
   assert.equal(adaptation.previous_extracted_blob,entry.selected_sha);
   assert.equal(content.length,adaptation.current_bytes);
   assert.equal(hash(content),adaptation.current_blob);
   continue;
  }
  assert.equal(content.length,entry.bytes,entry.path);
  assert.equal(hash(content),entry.selected_sha,entry.path);
  assert.ok(entry.selected_revision==='original-pin'||entry.selected_revision==='reconciled-current');
 }
});
