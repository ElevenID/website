import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
const receipt=JSON.parse(readFileSync(new URL('../contracts/extraction-provenance-batch-19.json',import.meta.url),'utf8'));
const sha=b=>createHash('sha1').update('blob '+b.length+String.fromCharCode(0)).update(b).digest('hex');
test('DemoPages metadata image URLs use the immutable website asset namespace',()=>{
 const item=receipt.adapted_files[0];
 const bytes=readFileSync(new URL('../'+item.path,import.meta.url));
 assert.equal(bytes.length,item.current_bytes);
 assert.equal(sha(bytes),item.current_blob);
 const source=bytes.toString('utf8');
 assert.match(source,/staticAssetHref\\(manifest\\.scenarios\\[0\\]\\.poster\\.src\\)/);
 assert.match(source,/staticAssetHref\\(scenario\\.poster\\.src\\)/);
});
