import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WEB_SURFACE_ROUTES } from '../ui/scripts/web-surface-contract.mjs';

const manifestDirectory = fileURLToPath(new URL('../ui/public/demos/manifests/', import.meta.url));
const invalidAliases = new Set(['/pricing', '/verification', '/issuance', '/privacy', '/terms']);

function normalizeRoute(route) {
  if (typeof route !== 'string' || !route.startsWith('/') || route.includes('\\')
    || route.includes('?') || route.includes('#') || route.includes(String.fromCharCode(0))) {
    throw new Error('Invalid website prerender route');
  }
  const normalized = route.replace(/\/+$/, '') || '/';
  if (normalized !== '/' && normalized.slice(1).split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Unsafe website prerender route: ' + route);
  }
  return normalized;
}

export async function createWebsitePrerenderPlan() {
  const blog = await import('@elevenid/marty-blog/prerender-data');
  const {
    BLOG_POSTS, BLOG_AUTHORS, BLOG_POST_CONCEPT_TAGS, BLOG_POST_STANDARDS_TAGS,
    GUIDE_ARTICLE_SLUGS, GUIDE_ARTICLES, GUIDE_CHAPTERS, ARTICLE_META,
    getBrowseVisiblePosts, buildBlogTagPath,
  } = blog;

  if (!Array.isArray(BLOG_POSTS) || !BLOG_AUTHORS || !Array.isArray(GUIDE_ARTICLE_SLUGS)
    || !Array.isArray(GUIDE_ARTICLES) || !Array.isArray(GUIDE_CHAPTERS)
    || typeof getBrowseVisiblePosts !== 'function' || typeof buildBlogTagPath !== 'function') {
    throw new Error('Pinned Marty blog prerender data does not satisfy its route contract');
  }

  const chapterById = Object.fromEntries(GUIDE_CHAPTERS.map((chapter) => [chapter.id, chapter]));
  const tagPaths = new Set();
  getBrowseVisiblePosts(BLOG_POSTS).forEach((post) => {
    const meta = ARTICLE_META[post.slug];
    const tags = new Set([
      ...(BLOG_POST_STANDARDS_TAGS[post.slug] || []),
      ...(BLOG_POST_CONCEPT_TAGS[post.slug] || []),
      ...(meta && meta.topic ? [meta.topic] : []),
    ]);
    tags.forEach((tag) => tagPaths.add(buildBlogTagPath(tag)));
  });
  GUIDE_ARTICLES.forEach((article) => {
    const tags = new Set([
      ...(article.conceptTags || []),
      ...(chapterById[article.chapterId] && chapterById[article.chapterId].title
        ? [chapterById[article.chapterId].title] : []),
    ]);
    tags.forEach((tag) => tagPaths.add(buildBlogTagPath(tag)));
  });

  const blogRoutes = Array.from(new Set([
    '/blog',
    ...tagPaths,
    ...BLOG_POSTS.map(({ slug }) => '/blog/' + slug),
    ...GUIDE_ARTICLE_SLUGS.map((slug) => '/blog/' + slug),
  ])).map(normalizeRoute);
  const authorRoutes = ['/authors', ...Object.keys(BLOG_AUTHORS).map((id) => '/authors/' + id)].map(normalizeRoute);

  const demoIndex = JSON.parse(readFileSync(manifestDirectory + '/index.json', 'utf8'));
  if (demoIndex.schema_version !== 2 || !Array.isArray(demoIndex.releases) || demoIndex.releases.length === 0) {
    throw new Error('Website demo index is not a supported release catalog');
  }
  const demoRoutes = ['/demos'];
  const versions = new Set();
  for (const release of demoIndex.releases) {
    const version = release && release.stack_version;
    if (typeof version !== 'string' || !/^\d{4}\.\d{2}\.\d+$/.test(version) || versions.has(version)) {
      throw new Error('Website demo index contains an invalid or duplicate release version');
    }
    versions.add(version);
    const manifest = JSON.parse(readFileSync(manifestDirectory + '/' + version + '.json', 'utf8'));
    if (manifest.stack_version !== version || !Array.isArray(manifest.scenarios)) {
      throw new Error('Website demo manifest identity mismatch for ' + version);
    }
    demoRoutes.push('/demos/' + version);
    for (const scenario of manifest.scenarios) {
      if (!scenario || typeof scenario.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scenario.slug)) {
        throw new Error('Website demo scenario has an invalid public slug in ' + version);
      }
      demoRoutes.push('/demos/' + version + '/' + scenario.slug);
      if (demoIndex.latest_approved_stack_version === version) {
        demoRoutes.push('/demos/latest/' + scenario.slug);
      }
    }
  }
  if (demoIndex.latest_approved_stack_version != null && !versions.has(demoIndex.latest_approved_stack_version)) {
    throw new Error('Latest approved demo release is not in the release catalog');
  }

  const staticRoutes = WEB_SURFACE_ROUTES.website.exact_paths
    .map(normalizeRoute)
    .filter((route) => !invalidAliases.has(route) && !/\.[a-z0-9]+$/i.test(route));
  const routes = Array.from(new Set([
    ...staticRoutes,
    ...blogRoutes,
    ...authorRoutes,
    ...demoRoutes.map(normalizeRoute),
  ]));
  routes.sort((left, right) => left === '/' ? -1 : right === '/' ? 1 : left.localeCompare(right));
  if (!routes.includes('/') || routes.length < 40) {
    throw new Error('Website prerender plan is unexpectedly incomplete');
  }
  return { routes, demoIndex };
}
