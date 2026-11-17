// One-time source import utility, not a production-build dependency.
// Run on the existing development instance with a local, read-only marty-ui
// Git checkout containing the pinned commit. It never pushes or deploys.
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync, lstatSync, mkdirSync, readFileSync, realpathSync,
  renameSync, rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PIN = 'df6ec6c4bfee803d89c54e9333297f29f378cee3';
const ASSETS = [
  {
    "path": "favicon.svg",
    "sha": "ddd6c72026f3e832695a8897746d705d192facc1",
    "bytes": 2882826
  },
  {
    "path": "images/authors/aiko-tanaka.png",
    "sha": "df3ae0d2d1bebc607698790b7e056e42568a55c5",
    "bytes": 1581408
  },
  {
    "path": "images/authors/daniel-ortega.png",
    "sha": "d3b8c340a6bbb0e3508b2ddc8978ff3966efcba2",
    "bytes": 2135406
  },
  {
    "path": "images/authors/elena-kovacs.png",
    "sha": "dbb406718d6fc7a358669e1a563b2d345da96c3b",
    "bytes": 1943931
  },
  {
    "path": "images/authors/marcus-vale.png",
    "sha": "d51f8bd97d0dbe2a0dc5b440d1c42784e448df7c",
    "bytes": 1943905
  },
  {
    "path": "images/authors/nora-patel.png",
    "sha": "8547e60dedebd33a715927231e9d7b71652e7646",
    "bytes": 2174146
  },
  {
    "path": "images/authors/sofia-rahman.png",
    "sha": "d5150fc8a455b9cb7666b52f54cc2b3d4f9f2347",
    "bytes": 1767306
  },
  {
    "path": "images/authors/victor-leclerc.png",
    "sha": "2572d06f6aa4eaff5b3e9e6ce929e5d29c1441c0",
    "bytes": 2145634
  }
];
const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--source') {
  throw new Error('Usage: node scripts/import-large-public-assets.mjs --source /absolute/path/to/marty-ui');
}
const source = realpathSync(args[1]);
if (source === root) throw new Error('The source and destination checkout must differ');
execFileSync('git', ['-C', source, 'cat-file', '-e', `${PIN}^{commit}`], { stdio: 'pipe' });

const destRoot = path.join(root, 'ui/public');
if (!existsSync(destRoot) || lstatSync(destRoot).isSymbolicLink()
  || realpathSync(destRoot) !== destRoot) {
  throw new Error('Destination public root must be an existing real directory');
}
const hash = (buffer) => createHash('sha1')
  .update(`blob ${buffer.length}\0`).update(buffer).digest('hex');
let created = 0;
let verified = 0;
for (const asset of ASSETS) {
  if (!/^[a-z0-9][a-z0-9._/-]*$/.test(asset.path)
    || asset.path.split('/').includes('..')) throw new Error('Unsafe asset path');
  const sourceObject = `${PIN}:ui/public/${asset.path}`;
  const bytes = execFileSync('git', ['-C', source, 'cat-file', 'blob', sourceObject],
    { maxBuffer: asset.bytes + 8192 });
  if (bytes.length !== asset.bytes || hash(bytes) !== asset.sha) {
    throw new Error(`Source blob integrity failure: ${asset.path}`);
  }
  const dest = path.join(destRoot, asset.path);
  const parent = path.dirname(dest);
  mkdirSync(parent, { recursive: true });
  const realParent = realpathSync(parent);
  if (!realParent.startsWith(destRoot + path.sep)) throw new Error('Symlinked destination parent');
  if (existsSync(dest)) {
    if (!lstatSync(dest).isFile() || lstatSync(dest).isSymbolicLink()
      || hash(readFileSync(dest)) !== asset.sha) throw new Error(`Destination conflict: ${asset.path}`);
    verified++;
    continue;
  }
  const temp = `${dest}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, bytes, { flag: 'wx', mode: 0o644 });
    renameSync(temp, dest);
  } finally {
    rmSync(temp, { force: true });
  }
  created++;
}
console.log(JSON.stringify({ source_commit: PIN, planned: ASSETS.length, created, already_verified: verified }));
