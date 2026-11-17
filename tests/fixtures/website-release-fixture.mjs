import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { websiteReleaseMetadata } from '../../ui/scripts/web-surface-build-contract.mjs';

export const fixtureSourceSha = 'a'.repeat(40);
export const fixtureCommerceSha = 'b'.repeat(40);
export const fixturePages = [
  ['/', 'Fixture home'], ['/product', 'Fixture product'],
  ['/blog/release.v1', 'Fixture dotted article'], ['/authors/ada.lovelace', 'Fixture dotted author'],
  ['/demos/2026.07.0', 'Fixture numeric demo'],
];

export async function putFixtureFile(root, relative, content) {
  if (path.isAbsolute(relative) || relative.split('/').includes('..')) throw new Error('Fixture path must stay within its root');
  const filename = path.join(root, relative);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, content);
  return filename;
}

export function fixtureHtml(title, revision) {
  return `<!doctype html><html><head><meta name="prerender-status-code" content="200"><title>${title}</title>
<link rel="stylesheet" href="/_website/${revision}/assets/site.css"></head>
<body><h1>${title}</h1><a href="/product">Product</a>
<script src="/_website/runtime-config.js"></script><script type="module" src="/_website/${revision}/assets/site.js"></script></body></html>\n`;
}

export async function writeWebsiteFixture(root, { sourceSha = fixtureSourceSha, commerceSha, pages = 'public' } = {}) {
  const metadata = websiteReleaseMetadata({ sourceSha, commerceSha, pages });
  const revision = metadata.revision;
  await mkdir(root, { recursive: true });
  await putFixtureFile(root, 'marty-website-release.json', `${JSON.stringify(metadata)}\n`);
  for (const [route, title] of fixturePages) {
    await putFixtureFile(root, route === '/' ? 'index.html' : `${route.slice(1)}/index.html`, fixtureHtml(title, revision));
  }
  await putFixtureFile(root, '_website/runtime-config.js', 'window.__RUNTIME_CONFIG__ = {};\n');
  await putFixtureFile(root, `_website/${revision}/assets/site.js`, 'window.websiteFixture = "versioned asset";\n');
  await putFixtureFile(root, `_website/${revision}/assets/site.css`, 'body { color: #123; }\n');
  await putFixtureFile(root, 'blog/rss.xml', '<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture feed</title></channel></rss>\n');
  await putFixtureFile(root, 'llms.txt', 'Website fixture documentation.\n');
  await putFixtureFile(root, 'robots.txt', 'User-agent: *\nDisallow: /console\nDisallow: /auth/*\nDisallow: /api/*\nDisallow: /v1/*\nSitemap: https://elevenidllc.com/sitemap.xml\n');
  const urls = fixturePages.map(([route]) => `<url><loc>https://elevenidllc.com${route}</loc></url>`).join('');
  await putFixtureFile(root, 'sitemap.xml', `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`);
  return { sourceSha, revision, metadata };
}
