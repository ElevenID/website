// Source-bound asset gate. No network, generation or source checkout required.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { selectPublicAssets, verifyPublicAssets } from './lib/public-asset-integrity.mjs';

if (process.argv.length !== 2) throw new Error('Usage: node scripts/verify-public-assets.mjs');
const read = (relative) => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'));
const inventory = read('../docs/input-inventory/asset-inventory.json');
const reconciliation = read('../docs/input-inventory/source-reconciliation.json');
const blogAssets = read('../contracts/blog-social-assets-v1.0.json');
const assets = selectPublicAssets(inventory, reconciliation.public_changes, blogAssets);
if (assets.length !== 46) throw new Error('Expected the audited 46-resource asset set');
const receipt = verifyPublicAssets(fileURLToPath(new URL('../ui/public/', import.meta.url)), assets);
console.log(JSON.stringify(receipt));
if (receipt.failed) process.exitCode = 1;
