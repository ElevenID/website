import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const dockerfile = readFileSync(new URL('../../Dockerfile.website', import.meta.url), 'utf8');
const builder = readFileSync(new URL('../../scripts/build-website-image.mjs', import.meta.url), 'utf8');
const qualifier = readFileSync(new URL('../../scripts/qualify-website-nginx.mjs', import.meta.url), 'utf8');

test('website container uses a digest-pinned static Nginx base and explicit OCI identity', () => {
  assert.match(dockerfile, /^FROM nginx:1\.29\.1-alpine@sha256:[a-f0-9]{64}/m);
  assert.match(dockerfile, /org\.opencontainers\.image\.source/);
  assert.match(dockerfile, /org\.opencontainers\.image\.revision/);
  assert.match(dockerfile, /com\.elevenid\.website\.route-contract-sha256/);
  assert.match(dockerfile, /COPY html\/ \/usr\/share\/nginx\/html\//);
  assert.doesNotMatch(dockerfile, /marty-ui|marty-api-core|commerce-extension/i);
});

test('image builder requires exact production identity and never publishes to a registry', () => {
  assert.match(builder, /An exact production website source SHA is required/);
  assert.match(builder, /websiteBuildRevision/);
  assert.match(builder, /copyTreeNoSymlinks/);
  assert.match(builder, /docker, \[/);
  assert.match(builder, /'build', '--pull'/);
  assert.match(builder, /'image', 'inspect'/);
  assert.match(builder, /registry_published: false/);
  assert.doesNotMatch(builder, /'push'|docker push/);
});

test('production image health probe compares the actual newline returned by Nginx', () => {
  assert.ok(qualifier.includes(String.raw`response.body === 'ok\n'`));
  assert.ok(!qualifier.includes(String.raw`response.body === 'ok\\n'`));
});

test('production HTTP qualification executes the built image with a read-only filesystem', () => {
  assert.match(qualifier, /elevenid-website:\$\{revision\}/);
  assert.match(qualifier, /docker\(\['image', 'inspect', image\]\)/);
  assert.match(qualifier, /'--read-only'/);
  assert.match(qualifier, /'--security-opt', 'no-new-privileges:true'/);
  assert.doesNotMatch(qualifier, /'--mount'/);
});
