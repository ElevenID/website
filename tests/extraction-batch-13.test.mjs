import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync } from 'node:fs';
import { test } from 'node:test';
import { assertAgentWebsiteAdaptation } from './fixtures/website-agent-adaptation.mjs';
const manifest=JSON.parse(readFileSync(new URL('../contracts/extraction-provenance-batch-13.json',import.meta.url),'utf8'));
const handoff=JSON.parse(readFileSync(new URL('../contracts/website-pages-application-handoff-adaptation.json',import.meta.url),'utf8'));
const sharedHeader=JSON.parse(readFileSync(new URL('../contracts/shared-web-header-adaptation.json',import.meta.url),'utf8'));
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
  if (handoff.adapted_files.some(item=>item.path===entry.path)) continue;
  if (assertAgentWebsiteAdaptation(entry.path, {
   originalBlob: entry.original_sha, previousBlob: entry.selected_sha,
  })) continue;
  if (entry.path === 'ui/src/services/demoManifestService.js') {
   const adaptation=JSON.parse(readFileSync(new URL('../contracts/demo-retirement-adaptation.json',import.meta.url),'utf8')).adapted_files.find(item=>item.path===entry.path);
   assert.equal(adaptation.source_original_blob,entry.original_sha);
   assert.equal(adaptation.previous_extracted_blob,entry.selected_sha);
   assert.equal(content.length,adaptation.current_bytes);
   assert.equal(hash(content),adaptation.current_blob);
   continue;
  }
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
test('Pages application handoff adapts four reviewed source files without rewriting extraction history',()=>{
 assert.equal(handoff.schema_version,1);
 assert.equal(handoff.purpose,'post-extraction-adaptation-record');
 assert.equal(handoff.source_repository,'ElevenID/marty-ui');
 assert.equal(handoff.immutable_source_commit,manifest.immutable_source_commit);
 assert.equal(handoff.extends,'contracts/extraction-provenance-batch-27.json');
 assert.deepEqual(handoff.adapted_files.map(item=>item.path).sort(),[
  'ui/src/apps/website/WebsiteApp.jsx',
  'ui/src/components/LandingPageContent.jsx',
  'ui/src/components/pages/PublicIAPages.jsx',
  'ui/src/components/pages/VerifiableCredentialApiPage.jsx',
 ]);
 const previousWebsite=JSON.parse(readFileSync(new URL('../contracts/extraction-provenance-batch-21.json',import.meta.url),'utf8')).adapted_files[0];
 for(const item of handoff.adapted_files){
  const prior=manifest.source_paths.find(entry=>entry.path===item.path);
  assert.equal(item.source_original_blob,prior?.original_sha??previousWebsite.source_original_blob,item.path);
  assert.equal(item.previous_extracted_blob,prior?.selected_sha??previousWebsite.current_blob,item.path);
  assert.ok(item.change.length>0,item.path);
  const file=new URL('../'+item.path,import.meta.url);
  assert.equal(lstatSync(file).isFile(),true,item.path);
  const content=readFileSync(file);
  if (item.path === 'ui/src/apps/website/WebsiteApp.jsx') {
   assert.equal(sharedHeader.schema_version,1);
   assert.equal(sharedHeader.purpose,'shared-header-consumption-and-adaptation');
   assert.equal(sharedHeader.canonical_source.repository,handoff.source_repository);
   const matches=sharedHeader.adapted_files.filter(entry=>entry.path===item.path);
   assert.equal(matches.length,1,item.path);
   const current=matches[0];
   assert.equal(current.source_original_blob,item.source_original_blob,item.path);
   assert.equal(current.previous_blob,item.current_blob,item.path);
   assert.ok(current.change.length>0,item.path);
   assert.equal(content.length,current.bytes,item.path);
   assert.equal(hash(content),current.current_blob,item.path);
   continue;
  }
  if (assertAgentWebsiteAdaptation(item.path, {
   originalBlob: item.source_original_blob, previousBlob: item.current_blob,
  })) continue;
  assert.equal(content.length,item.current_bytes,item.path);
  assert.equal(hash(content),item.current_blob,item.path);
 }
});
