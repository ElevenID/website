export function pagesLoginRedirect(origin) {
  if (!origin) return '';
  const url = new URL(origin);
  if (url.protocol !== 'https:' || origin !== url.origin || url.port
    || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]+$/i.test(url.hostname)
    || ['elevenidllc.com', 'www.elevenidllc.com', 'elevenid-public-website.pages.dev'].includes(url.hostname)
    || url.hostname.endsWith('.elevenid-public-website.pages.dev')) {
    throw new Error('Expected a separate canonical HTTPS application origin');
  }
  // Documentation belongs to the application too. Keep the wildcard beneath
  // /docs/ so unrelated or unknown website paths still reach the website 404.
  // Destinations have no query override: Pages preserves the incoming query.
  return `/login ${origin}/login 302\n/verify ${origin}/verify 302\n`
    + `/docs ${origin}/docs 302\n/docs/* ${origin}/docs/:splat 302\n`;
}
