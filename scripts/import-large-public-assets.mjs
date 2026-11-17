// One-time local migration tool, never a build dependency, push or deployment.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importPinnedAssets } from './lib/public-asset-integrity.mjs';

const manifest = JSON.parse(readFileSync(new URL('../contracts/large-public-assets.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--source' || !path.isAbsolute(args[1])) {
  throw new Error('Usage: node scripts/import-large-public-assets.mjs --source /absolute/path/to/marty-ui');
}
if (manifest.schema_version !== 1 || manifest.source_repository !== 'ElevenID/marty-ui'
  || manifest.source_commit !== 'df6ec6c4bfee803d89c54e9333297f29f378cee3'
  || manifest.assets.length !== 8) throw new Error('Unexpected source asset contract');
console.log(JSON.stringify(importPinnedAssets({
  sourceRoot: args[1],
  publicRoot: fileURLToPath(new URL('../ui/public/', import.meta.url)),
  sourceCommit: manifest.source_commit,
  assets: manifest.assets,
})));
