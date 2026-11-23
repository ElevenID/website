export function pagesLoginRedirect(origin) {
  if (!origin) return '';
  const url = new URL(origin);
  if (url.protocol !== 'https:' || origin !== url.origin || url.port
    || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]+$/i.test(url.hostname)
    || ['elevenidllc.com', 'www.elevenidllc.com', 'elevenid-public-website.pages.dev'].includes(url.hostname)
    || url.hostname.endsWith('.elevenid-public-website.pages.dev')) {
    throw new Error('Expected a separate canonical HTTPS application origin');
  }
  return `/login ${origin}/login 302\n`;
}
