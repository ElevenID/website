// The build prefixes the existing retired-slug roster and the website security headers.
export default {
  fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    const demo = /^\/demos\/[^/]+\/([^/]+)\/?$/.exec(pathname);
    const status = pathname === '/index.html' ? 404 : demo && retired.includes(demo[1]) ? 410 : null;
    if (status === null) return env.ASSETS.fetch(request);
    return new Response(null, { status, headers });
  },
};
