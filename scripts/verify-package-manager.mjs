import { readFileSync } from 'node:fs';
import { parseBunLock, verifyPackageManager } from './lib/package-manager.mjs';

const read = (filename) => readFileSync(new URL('../' + filename, import.meta.url), 'utf8');
const result = verifyPackageManager({ manifest: JSON.parse(read('package.json')),
  npmLock: JSON.parse(read('package-lock.json')), bunLock: parseBunLock(read('bun.lock')) });
console.log(JSON.stringify(result));
