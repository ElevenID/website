# ElevenID public website: Cloudflare Pages production operation

The public marketing website is deployed separately from the console, authorization
UI, and API. The `elevenid-public-website` Cloudflare Pages project currently serves
`elevenidllc.com`, `www.elevenidllc.com`, and `web-next.elevenidllc.com`. All three
custom domains were Active with SSL enabled in the Cloudflare dashboard on
2026-11-25. The apex currently serves the Pages site directly.

## Verified checkpoint and remaining dependency

On 2026-11-25, Cloudflare listed `8f5913d0.elevenid-public-website.pages.dev` as
the current Production/main deployment. The three custom domains returned the
website release revision `6ef043be8c7f907c254945a924ddccf76d299c37`.
The previous `9f413383` deployment remained available in the deployment history.
The live `www` route returned `/` and `/healthz` as 200, `/index.html` and
`/console` as 404, and `/login?next=%2Fconsole` as 302 to
`https://console.elevenidllc.com/login?next=%2Fconsole`.

These checks establish static website delivery. They do not establish that the
Supabase-native console sign-in, authorization UI, API, or account return path is
accepted for production. Keep the current console and API routes until their
separate acceptance and recovery checks pass. The deployment operator owns Pages
and DNS changes; the application owner owns acceptance of the console, Auth/Flow,
API, and Supabase handoff.

## Qualify a website update

1. Record the website and console source commits, intended console origin, Pages
   deployment ID, immutable preview URL, qualification run, and rollback owner in
   the existing deployment audit. Check the host storage budget before a large
   local build. Use the accepted console origin in a fresh protected `main`
   dispatch of `Website standalone qualification`; its `application_origin` input
   applies only to that run. Download `website-pages-<full website commit>` before
   the one-day artifact retention ends. Preserve POSIX `/` paths when preparing
   the Windows upload ZIP.
2. At the immutable preview URL, match the release JSON revision to the qualified
   commit. Check `/`, `/healthz`, public pages, sitemap, feed, robots, revisioned
   assets, CSP, cache headers, `/index.html` 404, `/console` 404, and retired
   `/demos/<release>/<slug>` routes 410. Check `/login?next=%2Fconsole` and a
   Start Verifying link against the accepted console origin with return parameters
   intact. Follow an Open API docs action and check `/docs`, `/docs/quickstart`,
   and documentation query strings reach that same console origin. Keep unknown
   website paths, including `/docs-extra`, at 404. The HTTP handoff check in the
   README exercises these redirect and boundary cases. Record statuses and
   `Location` values.
3. Before replacing the current production deployment, capture the three custom
   domain associations, DNS records and proxy state, redirects or rules, current
   deployment ID, Free plan status, and an available previous production
   deployment as the rollback target in the audit. Confirm the
   update does not displace the console, authorization, API, or tunnel routes.
4. Upload the qualified artifact to `elevenid-public-website` through the normal
   Pages deployment path. Read back the new Production/main deployment ID and
   immutable URL from Cloudflare. From outside the host, repeat the route, TLS,
   release revision, redirect, and cache checks on the immutable URL and all three
   custom domains. Compare the served release bytes with the uploaded artifact.
5. When the console and native Auth/Flow are accepted, complete a real sign-in and
   return to the console from the website login link. Record the account journey
   separately from static route checks. Review Pages and the limited Worker route
   usage and errors during the initial window. Keep the project on the Free plan.

## Roll back a website update

If the release revision, TLS, routing, redirect behavior, or availability differs
from the qualified artifact, select the recorded previous Pages deployment through
Cloudflare's [Pages rollback path](https://developers.cloudflare.com/pages/configuration/rollbacks/).
Restore only any website DNS or custom-domain
association that this update changed. Verify the previous revision and website
routes on the apex, `www`, and `web-next` from outside the host. Record the failure,
restored deployment ID, observed revision, and next owner action in the audit.
