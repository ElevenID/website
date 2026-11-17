import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync } from 'node:fs';
import { test } from 'node:test';
const inventory=JSON.parse(readFileSync(new URL('../contracts/extraction-provenance-batch-14.json',import.meta.url),'utf8'));
const sha=(contents)=>createHash('sha1').update('blob '+contents.length+String.fromCharCode(0)).update(contents).digest('hex');
test('batch 14 preserves all eight diagram candidates',()=>{
 assert.equal(inventory.immutable_source_commit,'df6ec6c4bfee803d89c54e9333297f29f378cee3');
 assert.equal(inventory.extends,'contracts/extraction-provenance-batch-13.json');
 assert.equal(inventory.source_paths.length,8);
 assert.equal(new Set(inventory.source_paths.map(f=>f.path)).size,8);
 for(const item of inventory.source_paths){const path=new URL('../'+item.path,import.meta.url);assert.equal(lstatSync(path).isFile(),true,item.path);const bytes=readFileSync(path);assert.equal(bytes.length,item.bytes,item.path);assert.equal(sha(bytes),item.source_sha,item.path)}
});
