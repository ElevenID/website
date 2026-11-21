import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, realpathSync, rmSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { websiteBuildSelection, websiteReleaseMetadata } from '../ui/scripts/web-surface-build-contract.mjs';
import { renderWebsiteNginx } from '../ui/scripts/render-website-nginx.mjs';
import { assertWebsiteSource, writeQualificationReceipt } from './lib/qualification-evidence.mjs';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const dist = realpathSync(path.join(root, 'ui/dist-website'));
const selection = websiteBuildSelection();
const { sourceSha, revision, pages, commerceSha } = selection;
assert.match(sourceSha || '', /^[a-f0-9]{40}$/, 'An exact production website source SHA is required');
assertWebsiteSource({ root, sourceSha });
const release = JSON.parse(readFileSync(path.join(dist, 'marty-website-release.json'), 'utf8'));
assert.deepEqual(release, websiteReleaseMetadata(selection), 'Image metadata differs from selected sources');
const routeContractSha = release.route_contract?.sha256;
assert.match(routeContractSha || '', /^sha256:[a-f0-9]{64}$/);

const image = process.env.WEBSITE_IMAGE || `elevenid-website:${revision}`;
assert.equal(image, `elevenid-website:${revision}`, 'Website image tag must be derived from its exact source revision');
const docker = process.env.DOCKER || 'docker';
const context = mkdtempSync(path.join(os.tmpdir(), 'elevenid-website-image-'));

function copyTreeNoSymlinks(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    const stat = lstatSync(from);
    assert.ok(!stat.isSymbolicLink(), 'Website image context cannot contain symlinks: ' + from);
    if (stat.isDirectory()) copyTreeNoSymlinks(from, to);
    else if (stat.isFile()) copyFileSync(from, to);
    else assert.fail('Unsupported website image input: ' + from);
  }
}

try {
  copyFileSync(path.join(root, pages === 'full' ? 'Dockerfile.website.full' : 'Dockerfile.website'), path.join(context, 'Dockerfile'));
  copyFileSync(path.join(root, 'ui/nginx.website.conf'), path.join(context, 'nginx.website.conf'));
  copyFileSync(path.join(root, 'ui/nginx.website.headers.conf'), path.join(context, 'nginx.website.headers.conf'));
  writeFileSync(path.join(context, 'nginx.website.routes.conf'), renderWebsiteNginx(revision), { mode: 0o644 });
  copyTreeNoSymlinks(dist, path.join(context, 'html'));

  execFileSync(docker, [
    'build', '--pull', '--platform', 'linux/amd64', '--file', path.join(context, 'Dockerfile'),
    '--tag', image,
    '--build-arg', 'WEBSITE_SOURCE_SHA=' + sourceSha,
    '--build-arg', 'WEBSITE_REVISION=' + revision,
    '--build-arg', 'WEBSITE_ROUTE_CONTRACT_SHA256=' + routeContractSha,
    ...(pages === 'full' ? ['--build-arg', 'COMMERCE_SOURCE_SHA=' + commerceSha] : []),
    context,
  ], { encoding: 'utf8', timeout: 600000, maxBuffer: 16 * 1024 * 1024, stdio: 'inherit' });

  const info = JSON.parse(execFileSync(docker, ['image', 'inspect', image], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
  }))[0];
  const labels = info.Config.Labels || {};
  assert.equal(info.Os, 'linux', 'Website release image must target Linux');
  assert.equal(info.Architecture, 'amd64', 'Website release image must target amd64');
  assert.equal(labels['org.opencontainers.image.source'],
    pages === 'full' ? 'https://github.com/ElevenID/marty-subscriptions' : 'https://github.com/ElevenID/website');
  assert.equal(labels['org.opencontainers.image.revision'], pages === 'full' ? commerceSha : sourceSha);
  assert.equal(labels['org.opencontainers.image.version'], revision);
  assert.equal(labels['com.elevenid.website.repository'], 'ElevenID/website');
  assert.equal(labels['com.elevenid.website.audience'], 'production');
  assert.equal(labels['com.elevenid.website.pages'], pages);
  if (pages === 'full') {
    assert.equal(labels['com.elevenid.website.source-sha'], sourceSha);
    assert.equal(labels['com.elevenid.website.commerce-source-sha'], commerceSha);
  }
  assert.equal(labels['com.elevenid.website.route-contract-sha256'], routeContractSha);
  assert.match(info.Id || '', /^sha256:[a-f0-9]{64}$/);
  assert.ok(info.Config.ExposedPorts?.['80/tcp'], 'Website image must expose port 80');
  const result = {
    qualified: 'website-static-container-build',
    image,
    image_id: info.Id,
    source_sha: sourceSha,
    revision,
    platform: 'linux/amd64',
    route_contract_sha256: routeContractSha,
    base_image: 'nginx:1.29.1-alpine@sha256:42a516af16b852e33b7682d5ef8acbd5d13fe08fecadc7ed98605ba5e3b26ab8',
    registry_published: false,
  };
  writeQualificationReceipt({ root, ...selection, stage: 'image-build', result });
  console.log(JSON.stringify(result));
} finally {
  rmSync(context, { recursive: true, force: true });
}
