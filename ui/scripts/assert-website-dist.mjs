import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { WEB_SURFACE_ROUTES } from './web-surface-contract.mjs';
import { websiteReleaseMetadata } from './web-surface-build-contract.mjs';

const canonicalOrigin = 'https://elevenidllc.com';
const resourceSuffix = /\.(?:css|[cm]?js|json|txt|xml|map|png|jpe?g|gif|webp|avif|ico|svg|woff2?|ttf|otf|eot|mp[34]|webm|pdf|zip|wasm)$/i;
const isPublicPage = (route) => !/^\/pricing(?:\/|$)/.test(route) && !resourceSuffix.test(route)
  && (WEB_SURFACE_ROUTES.website.exact_paths.includes(route)
    || WEB_SURFACE_ROUTES.website.path_prefixes.some((prefix) => prefix !== '/_website/' && route.startsWith(prefix)));

export function assertWebsiteDist(directory, { sourceSha, commerceSha, allowDevelopment = false } = {}) {
  assert.equal(typeof allowDevelopment, 'boolean', 'development mode must be explicit');
  const expectedSource = sourceSha ?? (allowDevelopment ? 'development' : undefined);
  assert.ok(typeof expectedSource === 'string' && (/^[a-f0-9]{40}$/.test(expectedSource)
    || (allowDevelopment && expectedSource === 'development')), 'expected website source SHA is required');
  const root = path.resolve(directory);
  assert.ok(lstatSync(root).isDirectory() && !lstatSync(root).isSymbolicLink(), 'artifact root must be a regular directory');
  const realRoot = realpathSync(root);
  function regularFile(relative) {
    const filename = path.join(root, relative);
    const stat = lstatSync(filename);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `artifact is not a regular file: ${relative}`);
    assert.ok(realpathSync(filename).startsWith(`${realRoot}${path.sep}`), `artifact escapes its root: ${relative}`);
    return filename;
  }
  const metadata = JSON.parse(readFileSync(regularFile('marty-website-release.json'), 'utf8'));
  assert.ok(metadata && typeof metadata === 'object' && !Array.isArray(metadata), 'invalid release metadata');
  const expected = websiteReleaseMetadata({ sourceSha: expectedSource, commerceSha,
    pages: metadata.production_pages, revision: metadata.revision });
  assert.deepEqual(metadata, expected, 'release metadata differs from the expected website inputs');
  const prefix = `/_website/${expected.revision}/`;
  const documents = [];
  function inspect(directoryPath) {
    for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
      const filename = path.join(directoryPath, entry.name);
      const relative = path.relative(root, filename).split(path.sep).join('/');
      assert.ok(!entry.isSymbolicLink(), `artifact symlink is forbidden: ${relative}`);
      assert.notEqual(relative, 'marty-ui-release.json', 'website must not claim stack identity');
      assert.ok(!/^(?:pricing|console|login|auth|api|v1)(?:\/|$)/.test(relative), `application artifact is forbidden: ${relative}`);
      if (entry.isDirectory()) { inspect(filename); continue; }
      assert.ok(entry.isFile(), `artifact is not a regular file: ${relative}`);
      if (!relative.endsWith('.html')) continue;
      const route = relative === 'index.html' ? '/' : `/${relative.replace(/\/index\.html$/, '')}`;
      assert.ok(isPublicPage(route), `unowned prerendered route: ${route}`);
      const html = readFileSync(filename, 'utf8');
      assert.ok(!/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?=[:/"'\s>]|$)/i.test(html), `loopback URL in ${relative}`);
      const pageUrl = new URL(route, canonicalOrigin).href;
      // Inert parsing handles actual HTML attribute rules without running scripts
      // or fetching resources. jsdom is already pinned for build/DOM qualification.
      const dom = new JSDOM(html, { url: pageUrl });
      try {
        assert.equal(dom.window.document.baseURI, pageUrl, `unexpected document base in ${relative}`);
        if (route === '/') {
          assert.ok(dom.window.document.querySelector('h1'), 'homepage must be prerendered');
          assert.equal(dom.window.document.querySelector('meta[name="prerender-status-code"]')?.content, '200', 'homepage status must be 200');
          const scripts = [...dom.window.document.querySelectorAll('script[src]')].map((element) => new URL(element.getAttribute('src'), pageUrl));
          assert.ok(scripts.some((url) => url.origin === canonicalOrigin && decodeURIComponent(url.pathname) === '/_website/runtime-config.js'), 'runtime configuration is missing');
          assert.ok(scripts.some((url) => url.origin === canonicalOrigin && decodeURIComponent(url.pathname).startsWith(`${prefix}assets/`)), 'versioned bundle is missing');
        }
        for (const element of dom.window.document.querySelectorAll('[src], [href]')) {
          for (const attribute of ['src', 'href']) {
            if (!element.hasAttribute(attribute)) continue;
            const value = element.getAttribute(attribute);
            const url = new URL(value, pageUrl);
            const hostname = url.hostname.toLowerCase().replace(/\.+$/, '');
            assert.ok(!['localhost', '0.0.0.0', '[::1]', '[::]'].includes(hostname)
              && !hostname.endsWith('.localhost') && !/^127\./.test(hostname)
              && !/^\[::ffff:7f[\da-f]{2}:/.test(hostname), `loopback URL in ${relative}`);
            if (url.origin !== canonicalOrigin) continue;
            const decodedPath = decodeURIComponent(url.pathname);
            if (element.localName === 'a' && attribute === 'href') {
              assert.ok(!/^\/pricing(?:\/|$)/.test(decodedPath), `pricing link in ${relative}`);
            }
            assert.ok(!/^\/(?:assets|locales|images)(?:\/|$)/.test(decodedPath), `root resource namespace leaked in ${relative}`);
            const rawPath = value.trim().replace(/^(?:[a-z][a-z\d+.-]*:)?\/\/[^/?#]*/i, '').split(/[?#]/, 1)[0];
            const rawDecoded = decodeURIComponent(rawPath);
            const namespaced = decodedPath.replace(/\/+/g, '/').startsWith('/_website/')
              || /(?:^|\/)_website\//.test(rawDecoded);
            if (!namespaced) continue;
            assert.ok(!/[\\\x00-\x20\x7f]/.test(rawPath) && !/%(?:2f|5c)/i.test(rawPath), `noncanonical resource path in ${relative}`);
            assert.ok(!rawDecoded.includes('//') && !rawDecoded.split('/').some((part) => part === '.' || part === '..')
              && !/[\\\x00-\x20\x7f]/.test(rawDecoded), `unsafe resource path in ${relative}`);
            assert.ok(decodedPath === '/_website/runtime-config.js' || decodedPath.startsWith(prefix), `stale asset namespace in ${relative}`);
            regularFile(decodedPath.slice(1));
          }
        }
      } finally { dom.window.close(); }
      documents.push(relative);
    }
  }
  inspect(root);
  assert.ok(documents.includes('index.html') && documents.includes('product/index.html'), 'homepage and product must be prerendered');
  const crawler = spawnSync(process.env.PYTHON || 'python3',
    [fileURLToPath(new URL('./check_crawler_artifacts.py', import.meta.url)), root],
    { encoding: 'utf8', timeout: 30000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  if (crawler.error) throw crawler.error;
  assert.equal(crawler.status, 0, `crawler artifacts failed: ${crawler.stderr || crawler.stdout}`);
  return { documents: documents.length, revision: expected.revision, sourceSha: expectedSource };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [directory, ...args] = process.argv.slice(2);
  if (!directory) throw new Error('Usage: assert-website-dist.mjs DIST --source-sha SHA [--commerce-sha SHA] [--allow-development]');
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const key = { '--source-sha': 'sourceSha', '--commerce-sha': 'commerceSha', '--allow-development': 'allowDevelopment' }[flag];
    if (!key || Object.hasOwn(options, key)) throw new Error(`Unknown or repeated argument: ${flag}`);
    options[key] = key === 'allowDevelopment' ? true : args[++index];
    if (options[key] === undefined || (typeof options[key] === 'string' && options[key].startsWith('--'))) throw new Error(`Missing value for ${flag}`);
  }
  const result = assertWebsiteDist(directory, options);
  console.log(`Website artifacts verified: ${result.documents} HTML documents, expected release identity, namespaced resources and crawler files.`);
}
