import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  appendPublicationOutputs, publishQualifiedWebsite, requirePublicationOutput,
} from './lib/website-publisher.mjs';

const args = process.argv.slice(2);
assert.ok(args.length === 4 && args[0] === '--output-dir' && args[2] === '--oras',
  'Usage: publish-website-image.mjs --output-dir ABSOLUTE_PATH --oras ABSOLUTE_PATH');
requirePublicationOutput();
const published = publishQualifiedWebsite({
  root: fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, ''),
  outputDirectory: args[1], oras: args[3],
});
appendPublicationOutputs(published);
process.stdout.write(`Published and verified ${published.imageReference}\n`);
