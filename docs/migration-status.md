# Migration checkpoint — complete source graph and standalone development bundle

**Latest branch:** [website PR #13](https://github.com/ElevenID/website/pull/13), `feat/complete-website-source-graph`. It remains **draft**; accepted main is still `c586c1ca2800f181594ffd03c5045fd3b93f76fb` from PR #12. Do not merge as a complete website release.

## Verified progress

- All **79/79** original source candidates now exist in `website`. Ten large public data/page/catalog files (411,599 bytes) and eight diagram source files (46,150 bytes) were added with exact Git identities. The four previously reconciled large sources use their current blobs; source data and application-owned `/verify` CTA semantics remain preserved.
- **38/46** public assets from the selected inventory exist with pinned source blobs: six common/marketing language pairs, demo manifests, RSS/llms and runtime text, branding, manifest icons, demo posters, and blog/social images. The remaining eight image assets total **16,574,562 bytes** and are listed in [the asset inventory](input-inventory/asset-inventory.json).
- A new website-only `ui/index.html`, `ui/vite.config.mjs`, TypeScript configuration, npm lock, and exact `@elevenid/marty-blog` v0.1.9 package pin no longer require a marty-ui source checkout for the **development bundle smoke**. The root script `npm run build:website` first generates the demo manifest module, then executes the real TypeScript CLI and Vite.
- The [required hosted CI check](https://github.com/ElevenID/website/actions/runs/44135521693/job/134223871973) passed a clean install, **65 native + 345 DOM + 122 build + 20 Nginx HTTP = 552 checks** (zero failures/skips), and a real Vite bundle: **1,147 modules transformed, 66 JavaScript chunks**, release metadata with development audience, and eight emitted resource checks. The existing 5 nested Python crawler cases are not added twice.
- TypeScript 7's native CLI path is resolved without broadening the source/bundle boundary. [Batch 18 provenance](../contracts/extraction-provenance-batch-18.json) supersedes only the current runner blob while preserving the previous [batch 12 historical record](../contracts/extraction-provenance-batch-12.json).

## Reproduce the qualified scope

With Node.js 24.22.1 and Docker for the HTTP suite:

```sh
npm ci --no-audit --no-fund
npm test
npm run test:nginx
MARTY_WEBSITE_SOURCE_SHA=development MARTY_WEBSITE_ALLOW_DEVELOPMENT=true npm run build:website
node scripts/verify-standalone-bundle.mjs
```

These commands build a **development audience** bundle with a full source graph and pinned blog package; they do not produce a publishable site image. The generated module can change in the working directory during the build; do not mistake that output for a reviewed commit.

On the existing AWS development instance, preserve the existing rootless Docker and six-hour stop safeguard. To transfer the remaining eight image blobs, use a local source Git checkout containing the immutable `df6ec6c4bfee803d89c54e9333297f29f378cee3` commit, from the website checkout:

```sh
node scripts/import-large-public-assets.mjs --source /absolute/path/to/marty-ui
node scripts/verify-public-assets.mjs
```

Both scripts are source-bound. The importer refuses collisions and does not automatically commit, push or deploy. Review and commit the eight copied assets as the next checkpoint. No AWS operations were executed in this session because interactive browser command execution was unavailable.

## Remaining acceptance gates

1. Complete **46/46** public asset identity verification. The root `favicon.svg` and seven author PNGs remain missing.
2. Integrate full production Chromium prerender, sitemap/robots generation, RSS/demos, actual emitted metadata images and every route's HTML; the current bundle is a client-rendered development smoke.
3. Test real browser website/application redirects and Nginx against the complete production output, not only synthetic fixtures.
4. Produce and verify a website-only container digest, source/workflow/run provenance, private commerce compatibility, promotion and retained-slot rollback without mutating application/backend releases.
5. Continue the separate platform/application/Canvas migrations. No production cutover.

[Detailed receipt](checkpoints/batch-13-complete-source-bundle.md) · [Original candidate inventory](source-import-inventory.json) · [Source reconciliation](input-inventory/source-reconciliation.json).
