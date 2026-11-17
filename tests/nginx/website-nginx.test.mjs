import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { renderWebsiteNginx } from '../../ui/scripts/render-website-nginx.mjs';
import { WEB_SURFACE_ROUTES } from '../../ui/scripts/web-surface-contract.mjs';
import { fixtureSourceSha, putFixtureFile, writeWebsiteFixture } from '../fixtures/website-release-fixture.mjs';

// The AWS qualification and CI use the same official Linux amd64 image.
const image = 'nginx@sha256:785835ea65db4bba6f021acc0f3be91b0fef76a53fe41f8588c6698d2aed0606';
let root;
let container;
let containerName;
let port;
function docker(args, allowFailure = false) {
  const result = spawnSync(process.env.DOCKER || 'docker', args, { encoding: 'utf8', timeout: 30000 });
  if (!allowFailure) {
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `docker ${args[0]} failed: ${result.stderr || result.stdout}`);
  }
  return (result.stdout || '').trim();
}
function request(route, method = 'GET') {
  return new Promise((resolve, reject) => {
    const operation = http.request({ host: '127.0.0.1', port, path: route, method, timeout: 5000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (part) => {
        body += part;
        if (body.length > 16384) operation.destroy(new Error('Unexpectedly large fixture response'));
      });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
      response.on('error', reject);
    });
    operation.on('timeout', () => operation.destroy(new Error('Fixture request timed out')));
    operation.on('error', reject);
    operation.end();
  });
}
async function expectStatus(route, status) {
  const response = await request(route);
  assert.equal(response.status, status, route);
  return response;
}

describe('isolated website Nginx HTTP policy', () => {
  before(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'website-nginx-'));
    await chmod(root, 0o755);
    const content = path.join(root, 'content');
    const config = path.join(root, 'config');
    await mkdir(config);
    await writeWebsiteFixture(content);
    // Physically present forbidden files prove that denial is policy, not absence.
    for (const relative of ['pricing/index.html', 'pricing/checkout', 'console/index.html', 'login/index.html',
      'docs/index.html', 'docs/private.json', 'auth/callback', 'api/status', 'v1/credential',
      'unowned.txt', 'assets/leak.js', 'images/leak.png', 'locales/en/common.json',
      '.well-known/security.txt', 'blog/existing.css']) {
      await putFixtureFile(content, relative, 'FORBIDDEN-FIXTURE-CONTENT');
    }
    await putFixtureFile(config, 'routes.conf', renderWebsiteNginx(fixtureSourceSha));
    await putFixtureFile(config, 'website.conf', await readFile(new URL('../../ui/nginx.website.conf', import.meta.url), 'utf8'));
    await putFixtureFile(config, 'headers.conf', await readFile(new URL('../../ui/nginx.website.headers.conf', import.meta.url), 'utf8'));
    await putFixtureFile(config, 'nginx.conf', `user nginx;
worker_processes 1;
error_log /dev/stderr warn;
pid /tmp/nginx.pid;
events { worker_connections 64; }
http {
  include /etc/nginx/mime.types;
  access_log off;
  client_body_temp_path /tmp/client;
  proxy_temp_path /tmp/proxy;
  fastcgi_temp_path /tmp/fastcgi;
  uwsgi_temp_path /tmp/uwsgi;
  scgi_temp_path /tmp/scgi;
  include /etc/nginx/conf.d/website.conf;
}
`);
    const mounts = [
      [content, '/usr/share/nginx/html'], [path.join(config, 'nginx.conf'), '/etc/nginx/nginx.conf'],
      [path.join(config, 'website.conf'), '/etc/nginx/conf.d/website.conf'],
      [path.join(config, 'routes.conf'), '/etc/nginx/marty-website-routes.conf'],
      [path.join(config, 'headers.conf'), '/etc/nginx/marty-website-headers.conf'],
    ].flatMap(([source, target]) => ['--mount', `type=bind,source=${source},target=${target},readonly`]);
    containerName = `website-policy-${randomUUID()}`;
    container = docker(['run', '--detach', '--rm', '--pull', 'never', '--read-only', '--network', 'bridge',
      '--publish', '127.0.0.1::80', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m',
      '--security-opt', 'no-new-privileges:true', '--name', containerName,
      ...mounts, '--entrypoint', 'nginx', image, '-c', '/etc/nginx/nginx.conf', '-g', 'daemon off;']);
    const binding = docker(['port', container, '80/tcp']);
    assert.match(binding, /^127\.0\.0\.1:\d+$/, 'fixture must only listen on loopback');
    port = Number(binding.split(':')[1]);
    const deadline = Date.now() + 15000;
    let failure;
    while (Date.now() < deadline) {
      try {
        const response = await request('/healthz');
        if (response.status === 200) return;
        failure = new Error(`Nginx health returned ${response.status}`);
      } catch (error) { failure = error; }
      await delay(100);
    }
    throw new Error(`Nginx fixture did not become ready: ${failure?.message}; ${docker(['logs', container], true)}`);
  }, { timeout: 60000 });

  after(async () => {
    try {
      if (container || containerName) {
        const cleanup = spawnSync(process.env.DOCKER || 'docker', ['rm', '--force', container || containerName],
          { encoding: 'utf8', timeout: 30000 });
        if (cleanup.error) throw cleanup.error;
        assert.ok(cleanup.status === 0 || /No such container/i.test(cleanup.stderr || ''),
          `Owned fixture container cleanup failed: ${cleanup.stderr || cleanup.stdout}`);
      }
    } finally {
      if (root) await rm(root, { recursive: true, force: true });
    }
  });

  test('health endpoint responds on the isolated loopback listener', async () => {
    assert.equal((await expectStatus('/healthz', 200)).body, 'ok\n');
  });

  test('homepage and product serve their actual prerendered documents', async () => {
    assert.match((await expectStatus('/', 200)).body, /Fixture home/);
    assert.match((await expectStatus('/product', 200)).body, /Fixture product/);
    assert.match((await expectStatus('/product/', 200)).body, /Fixture product/);
  });

  test('the internal fallback document is not directly exposed', async () => {
    for (const route of ['/index.html', '/%69ndex.html', '/index.html?direct=1']) {
      assert.doesNotMatch((await expectStatus(route, 404)).body, /Fixture home/);
    }
  });

  test('all contract-owned nonresource exact routes remain available except withheld pricing', async () => {
    for (const route of WEB_SURFACE_ROUTES.website.exact_paths.filter((value) => !value.startsWith('/pricing') && !/\.[a-z]+$/i.test(value))) {
      await expectStatus(route, 200);
    }
  });

  test('dotted article and author slugs serve actual prerendered pages', async () => {
    assert.match((await expectStatus('/blog/release.v1', 200)).body, /Fixture dotted article/);
    assert.match((await expectStatus('/authors/ada.lovelace', 200)).body, /Fixture dotted author/);
  });

  test('unprerendered dotted article and author slugs retain page fallback', async () => {
    for (const route of ['/blog/new.article', '/authors/new.person']) assert.match((await expectStatus(route, 200)).body, /Fixture home/);
  });

  test('numeric demo releases remain page routes', async () => {
    assert.match((await expectStatus('/demos/2026.07.0', 200)).body, /Fixture numeric demo/);
    assert.match((await expectStatus('/demos/2026.09.0', 200)).body, /Fixture home/);
  });

  test('pricing and encoded pricing paths remain withheld even when files exist', async () => {
    for (const route of ['/pricing', '/pricing/', '/pricing/checkout', '/%70ricing', '/pricing%2fcheckout']) {
      const response = await expectStatus(route, 404);
      assert.doesNotMatch(response.body, /FORBIDDEN-FIXTURE-CONTENT|Fixture home/);
    }
  });

  test('application and unknown routes cannot serve planted content', async () => {
    for (const route of ['/console', '/login', '/docs', '/docs/private.json', '/auth/callback', '/api/status', '/v1/credential', '/unknown']) {
      assert.doesNotMatch((await expectStatus(route, 404)).body, /FORBIDDEN-FIXTURE-CONTENT|Fixture home/);
    }
  });

  test('unowned root resources cannot leak physically present files', async () => {
    for (const route of ['/unowned.txt', '/assets/leak.js', '/images/leak.png', '/locales/en/common.json', '/.well-known/security.txt']) {
      assert.doesNotMatch((await expectStatus(route, 404)).body, /FORBIDDEN-FIXTURE-CONTENT/);
    }
  });

  test('known resources beneath page prefixes cannot become HTML fallbacks or unversioned assets', async () => {
    for (const route of ['/blog/missing.css', '/authors/avatar.png', '/demos/missing.js', '/blog/existing.css', '/blog/missing%2ecss']) {
      assert.doesNotMatch((await expectStatus(route, 404)).body, /FORBIDDEN-FIXTURE-CONTENT|Fixture home/);
    }
  });

  test('owned crawler, documentation and release resources remain available', async () => {
    for (const route of ['/robots.txt', '/sitemap.xml', '/llms.txt', '/marty-website-release.json']) {
      assert.doesNotMatch((await expectStatus(route, 200)).body, /Fixture home<\/h1>/);
    }
    const release = JSON.parse((await request('/marty-website-release.json')).body);
    assert.equal(release.repository, 'ElevenID/website');
    assert.equal(release.source_sha, fixtureSourceSha);
  });

  test('the owned blog RSS feed is served as XML', async () => {
    const response = await expectStatus('/blog/rss.xml', 200);
    assert.match(response.headers['content-type'], /xml/);
    assert.match(response.body, /Fixture feed/);
  });

  test('missing owned crawler resources remain HTTP404 instead of HTML', async () => {
    for (const route of ['/sitemap-index.xml', '/sitemap-missing.xml']) {
      assert.doesNotMatch((await expectStatus(route, 404)).body, /Fixture home/);
    }
  });

  test('runtime configuration is uncached and reports the website revision', async () => {
    const response = await expectStatus('/_website/runtime-config.js', 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['x-marty-website-revision'], fixtureSourceSha);
    assert.match(response.body, /__RUNTIME_CONFIG__/);
  });

  test('versioned assets are immutable and support HEAD without a body', async () => {
    const route = `/_website/${fixtureSourceSha}/assets/site.js`;
    const response = await expectStatus(route, 200);
    assert.match(response.headers['cache-control'], /max-age=31536000.*immutable/);
    assert.match(response.headers['content-type'], /javascript/);
    assert.match(response.body, /versioned asset/);
    const head = await request(route, 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.equal(head.headers['content-length'], response.headers['content-length']);
  });

  test('missing versioned resources never receive immutable HTML responses', async () => {
    const response = await expectStatus(`/_website/${fixtureSourceSha}/assets/missing.js`, 404);
    assert.doesNotMatch(response.body, /Fixture home/);
    assert.doesNotMatch(response.headers['cache-control'] || '', /immutable/);
  });

  test('page responses revalidate rather than inheriting asset immutability', async () => {
    const response = await expectStatus('/product', 200);
    assert.match(response.headers['cache-control'], /no-cache/);
    assert.ok(Date.parse(response.headers.expires) < Date.now() + 1000);
  });

  test('security and revision headers survive both successful and denied responses', async () => {
    for (const route of ['/', '/pricing', '/docs', '/_website/runtime-config.js', `/_website/${fixtureSourceSha}/assets/site.js`]) {
      const response = await request(route);
      assert.equal(response.headers['x-marty-website-revision'], fixtureSourceSha, route);
      assert.equal(response.headers['x-frame-options'], 'SAMEORIGIN', route);
      assert.equal(response.headers['x-content-type-options'], 'nosniff', route);
      assert.equal(response.headers['referrer-policy'], 'strict-origin-when-cross-origin', route);
      assert.match(response.headers['content-security-policy'], /default-src 'self'/, route);
    }
  });

  test('decoded traversal into application paths remains denied', async () => {
    for (const route of ['/blog/../docs', '/blog/%2e%2e/docs', '/_website/..%2fdocs']) {
      assert.doesNotMatch((await expectStatus(route, 404)).body, /FORBIDDEN-FIXTURE-CONTENT|Fixture home/);
    }
    assert.match((await expectStatus('/blog/release%2ev1', 200)).body, /Fixture dotted article/);
  });
});
