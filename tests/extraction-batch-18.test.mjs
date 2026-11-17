import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
const m=JSON.parse(readFileSync(new URL('../contracts/extraction-provenance-batch-18.json',import.meta.url),'utf8'));
test('newer TypeScript runner adaptation retains the prior source receipt',()=>{
 assert.equal(m.schema_version,1);
 assert.equal(m.extends,'contracts/extraction-provenance-batch-17-social.json');
 assert.equal(m.adapted_files.length,1);
 const f=m.adapted_files[0];
 assert.equal(f.previous_extracted_blob,'838dff8947aeece58debcdb1680a345c9f433d5f');
 const b=readFileSync(new URL('../'+f.path,import.meta.url));
 assert.equal(b.length,f.current_bytes);
 assert.equal(createHash('sha1').update('blob '+b.length+String.fromCharCode(0)).update(b).digest('hex'),f.current_blob);
});
