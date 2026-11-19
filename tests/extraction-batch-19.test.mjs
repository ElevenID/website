import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
const receipt=JSON.parse(readFileSync(new URL('../contracts/extraction-provenance-batch-19.json',import.meta.url),'utf8'));
const sha=b=>createHash('sha1').update('blob '+b.length+String.fromCharCode(0)).update(b).digest('hex');
test('DemoPages metadata image URLs use the immutable website asset namespace',()=>{
 const item=receipt.adapted_files[0];
 const bytes=readFileSync(new URL('../'+item.path,import.meta.url));
 const current=JSON.parse(readFileSync(new URL('../contracts/extraction-provenance-batch-24.json',import.meta.url),'utf8')).adapted_files.find(entry=>entry.path===item.path);
 assert.equal(current.source_original_blob,item.source_original_blob);
 assert.equal(current.previous_extracted_blob,item.current_blob);
 assert.equal(bytes.length,current.current_bytes);
 assert.equal(sha(bytes),current.current_blob);
 const source=bytes.toString('utf8');
 assert.ok(source.includes('ogImage={`https://elevenidllc.com${staticAssetHref(manifest.scenarios[0].poster.src)}`}'));
 assert.ok(source.includes('ogImage={`https://elevenidllc.com${staticAssetHref(scenario.poster.src)}`}'));
 assert.ok(source.includes('thumbnailUrl: [`https://elevenidllc.com${staticAssetHref(scenario.poster.src)}`]'));
});
