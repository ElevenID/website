# ElevenID public website: Cloudflare Pages production cutover

This runbook moves `www.elevenidllc.com` and the apex redirect to the separately
qualified public website Pages project. It does not move the console or API to
Pages. Keep the current public origin available until the new domain is verified.

## Current checkpoint and owners

On 2026-11-24, `web-next.elevenidllc.com` served the Pages candidate and
`www.elevenidllc.com` served the current public site. The candidate login link
redirected to `console-next.elevenidllc.com`; its static login page loaded.
`api-next.elevenidllc.com/health` returned HTTP 530. These are observations,
not a production acceptance result. The deployment operator owns the Cloudflare
domain association and DNS change; the application owner must first accept the
console, Auth, Flow, API, and Supabase handoff at the intended production origins.

## Entry gates

1. Record the website and console source commits, Pages deployment IDs and
   immutable preview URLs, qualification runs, and intended production console
   origin in the existing deployment audit. Use the accepted application origin
   in a fresh `main` dispatch of `Website standalone qualification`. The
   `application_origin` input applies only to that run. Download
   `website-pages-<full website commit>` before its one-day artifact retention
   ends. Upload the extracted contents to the public website staging Pages
   project, preserving POSIX `/` paths in a ZIP made on Windows.
2. Confirm the console's production login and verification routes work with a
   real account; the API and Auth/Flow health and functional checks pass; the
   Supabase redirect and Site URL configuration names the accepted origins; and
   a successful sign-in returns to the console. A 200 response from a static
   login page alone does not satisfy this gate. Keep the domain unchanged if
   any dependency is unhealthy or its acceptance evidence is missing.
3. At the immutable website preview URL, check the release JSON revision against
   the qualified commit, `/healthz`, public pages, sitemap, feed, revisioned
   assets, CSP and cache headers. Check that `/login?next=%2Fconsole` and a
   Start Verifying link redirect to the accepted console origin with their
   return parameters intact. Check retired demo URLs return 410, the direct
   `/index.html` returns 404, and `/console` plus other application routes
   return 404. Record response status and `Location` values.
4. In Cloudflare immediately before changing traffic, capture the current
   `www` and apex DNS records, proxy state, Pages custom-domain associations,
   current public deployment, redirects or rules, and the candidate project's
   Free plan status. Record the exact values and a rollback owner in the audit.
   Verify that attaching the domain will not displace a needed console, Auth,
   API, or tunnel route. Do not guess the DNS target from a public lookup.

## Switch and verify

1. Associate `www.elevenidllc.com` with the qualified public website Pages
   project and make the matching Cloudflare DNS change using the target shown
   for that project. Preserve the apex-to-`www` redirect. Change only the
   recorded website records or association, using the normal Cloudflare path.
2. From outside the host, verify TLS and HTTP for apex-to-`www`, the homepage,
   `/healthz`, release JSON revision, public pages, assets, sitemap and feed.
   Verify the login and verification redirects, then complete an actual
   sign-in and console return. Repeat the 410 and 404 checks above on `www`.
   Check Cloudflare's domain and deployment views agree with the observed
   revision. Record times, exact deployment ID, statuses, and any deviations.
3. Watch the relevant Cloudflare Free usage and error views during the initial
   window, including Pages and the limited Worker route for demo statuses.
   This cutover must not enable a paid plan or add paid bindings.

## Roll back

If the revision, TLS, redirects, functional sign-in, status semantics, or
availability checks fail, restore the captured previous `www` association and
DNS record through Cloudflare, retaining the previous public deployment. Verify
the apex redirect and previous public site from outside the host. Record the
failure, restored values, observed revision, and the next owner action in the
deployment audit. Do not switch the console or API as a website rollback step.
