# Batch 13: complete source candidates and standalone bundle smoke

[PR #13](https://github.com/ElevenID/website/pull/13) extends accepted main `c586c1ca2800f181594ffd03c5045fd3b93f76fb`. The user removed the former size/SVG restriction; this PR preserves large files using exact Git identities and keeps production untouched.

## Published source and public inputs

- Ten large candidate files: 411,599 bytes, with current reconciled source for LandingPageContent, marketingContent, PublicIAPages, and VerifiableCredentialApiPage.
- Eight diagram files: 46,150 bytes, with original pin identities.
- All original candidate source paths: **79/79 present**.
- Twenty-two selected public text resources, five brand/icon binaries, seven demo poster binaries/SVG, and four social/blog images: **38 of 46** selected public paths present. Separate source-identification shards record the copied text and byte-identical blobs.
- The eight missing selected binary assets are `favicon.svg` and seven author portraits, total 16,574,562 bytes. The current GitHub connector cannot retrieve their contents from the source's large-file API; the checked-in AWS import utility verifies exact source blob and size without printing the files.
- No files are removed from `marty-ui`. The older immutable source snapshot, newer reconciliation records and original attribution remain authoritative.

## Standalone build work

The independent npm manifest/lock now directly pins `@elevenid/marty-blog` v0.1.9 (no API-core download), TypeScript 7, React types, and the existing React/MUI/Vite dependencies. The website-only `ui/vite.config.mjs` wires the public configuration alias, pinned blog compatibility resolver, website asset namespaces and source-bound release metadata. An isolated `ui/index.html` and TypeScript project complete the entry and build context.

The build runner's TypeScript CLI path was updated for the extensionless TypeScript 7 executable. The historical batch 12 source/adaptation identity remains in place and a new receipt/test checks the updated runner. A build smoke now runs in the **existing required** read-only GitHub Actions job with development-audience metadata, rather than weakening CI permissions.

### Executed CI

[Website contracts run 44135521693, job 134223871973](https://github.com/ElevenID/website/actions/runs/44135521693/job/134223871973) passed on revision `2e251a5cf61c6d25b69afcce18fc2f0974110ec4`:

| Suite | Passing |
| --- | ---: |
| Node native contracts, including new source-provenance tests | 65 |
| React/DOM across 24 files | 345 |
| Vite/crawler/build/startup fixtures | 122 |
| Real isolated Nginx HTTP | 20 |
| **Total** | **552** |

There were no failures or skips. Five Python cases run inside the crawler wrapper and are not double-counted. The additional real Vite development build transformed **1,147 modules** and emitted **66 JavaScript chunks**. The smoke script checked release audience, repository ownership, versioned entry and representative output assets. The blog plugin emitted three nonblocking warnings about code-split modules also statically imported by its index.

### Explicit limits

This is a **development-audience, client-rendered smoke**, not proof of a complete production build. Eight public assets are absent; no Chromium prerender ran; the current emitted output has not been tested for complete route-level metadata/SEO or browser handoff; no website image was published or rolled back. Rootless Docker, AWS instance sizing and production services were not modified in this work pass.

## Next work

Use the existing AWS Free-plan development instance and its current protection/timer to import and verify the eight large resources with `scripts/import-large-public-assets.mjs`, commit and push only verified blobs, then run `scripts/verify-public-assets.mjs`. Follow with independent production Chromium prerender, full-artifact/Nginx/browser qualification, and release-producer/rollback acceptance. Preserve withheld pricing, application-owned `/verify`, DRAFT/PARTIAL demo publication states, and private commerce isolation.
