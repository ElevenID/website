import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function websiteAssetBase(revision) {
  if (typeof revision !== 'string' || !/^(?:development|[a-f0-9]{40}(?:-[a-f0-9]{40})?)$/.test(revision)) throw new Error('Invalid website asset revision');
  return `/_website/${revision}/`;
}

export function websiteAssetsPlugin(revision) {
  const base = websiteAssetBase(revision);
  const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
  let building = true;
  const selected = (relative) => !relative.endsWith('.html')
    && (!/^locales\/[^/]+\//.test(relative) || /\/(?:common|marketing)\.json$/.test(relative));
  const assetName = (relative) => relative === 'runtime-config.js' ? '_website/runtime-config.js'
    : ['llms.txt', 'blog/rss.xml'].includes(relative) ? relative : `${base.slice(1)}${relative}`;
  function assetSource(relative) {
    let source = readFileSync(path.join(publicRoot, relative));
    if (relative === 'manifest.json') {
      const manifest = JSON.parse(source.toString());
      manifest.icons = manifest.icons.map((icon) => ({ ...icon, src: `${base}${icon.src.replace(/^\//, '')}` }));
      manifest.start_url = '/';
      manifest.scope = '/';
      source = Buffer.from(`${JSON.stringify(manifest)}\n`);
    }
    return source;
  }
  return {
    name: 'website-assets',
    enforce: 'pre',
    configResolved(config) { building = config.command === 'build'; },
    configureServer(server) {
      // publicDir is disabled so production and development share the same
      // website-owned URLs. Vite's SPA fallback must never answer asset reads.
      server.middlewares.use((request, response, next) => {
        const requested = (request.url || '').split('?', 1)[0];
        if (!requested.startsWith('/_website/') && requested !== '/llms.txt' && requested !== '/blog/rss.xml') {
          return next();
        }
        const reject = (status) => { response.statusCode = status; response.end(); };
        if (request.method !== 'GET' && request.method !== 'HEAD') return reject(405);
        let decoded;
        try { decoded = decodeURIComponent(requested); } catch { return reject(404); }
        const relative = decoded === '/_website/runtime-config.js' ? 'runtime-config.js'
          : decoded === '/llms.txt' || decoded === '/blog/rss.xml' ? decoded.slice(1)
            : decoded.startsWith(base) ? decoded.slice(base.length) : null;
        if (!relative || relative.includes('\\') || /[\x00-\x1f\x7f]/.test(relative)
          || relative.split('/').some((segment) => !segment || segment === '.' || segment === '..')
          || !selected(relative) || '/' + assetName(relative) !== decoded) return reject(404);
        const absolute = path.join(publicRoot, relative);
        try {
          if (!lstatSync(absolute).isFile() || realpathSync(absolute) !== absolute) return reject(404);
          const source = assetSource(relative);
          const types = { '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml',
            '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
          response.setHeader('Content-Type', types[path.extname(relative)] || 'application/octet-stream');
          response.setHeader('Content-Length', source.length);
          response.setHeader('Cache-Control', 'no-store');
          response.end(request.method === 'HEAD' ? undefined : source);
        } catch (error) {
          if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return reject(404);
          next(error);
        }
      });
    },
    buildStart() {
      if (!building) return;
      const emitDirectory = (directory, prefix = '') => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
          const absolute = path.join(directory, entry.name);
          if (entry.isDirectory()) { emitDirectory(absolute, relative); continue; }
          if (!entry.isFile() || !selected(relative)) continue;
          // Product translations and test harnesses do not belong in the website.
          this.emitFile({ type: 'asset', fileName: assetName(relative), source: assetSource(relative) });
        }
      };
      emitDirectory(publicRoot);
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace('src="/src/index.jsx"', 'src="/src/website.jsx"')
          .replace('src="/runtime-config.js"', 'src="/_website/runtime-config.js"')
          .replace(/((?:src|href)=")\/(favicon\.ico(?:\?[^\"]*)?|apple-touch-icon\.png|manifest\.json|startup\.js)(")/g,
            `$1${base}$2$3`);
      },
    },
    transform(code, id) {
      if (!id.replace(/\\/g, '/').includes('/@elevenid/marty-blog/')) return null;
      // The pinned blog package publishes local public image URLs in its data.
      // Rewrite those owned assets; links and external image origins stay intact.
      const transformed = code
        .replace(/(["'`])\/images(?=\/|["'`])/g, `$1${base}images`)
        .replace(/(["'`])\/logo512\.png(?=["'`])/g, `$1${base}logo512.png`)
        .replace(/(["'`])https:\/\/elevenidllc\.com\/logo512\.png(?=["'`])/g, `$1https://elevenidllc.com${base}logo512.png`);
      return transformed === code ? null : { code: transformed, map: null };
    },
  };
}
