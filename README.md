# Website

ElevenID's public website, product information, blog and public demonstrations.

## Current migration

[PR #13](https://github.com/ElevenID/website/pull/13) now contains **all 79 source candidates** from the original extraction inventory, including large page/data modules and diagrams. A standalone Vite **development-audience** build has passed [hosted CI](https://github.com/ElevenID/website/actions/runs/44135521693/job/134223871973) with 1,147 transformed modules, 66 JavaScript chunks and 576 passing native/DOM/build/HTTP checks.

**It is not yet a production release.** All 46 selected public assets are now committed, while complete Chromium prerendering/SEO, real browser handoffs, digest-pinned image publishing and rollback remain under qualification. [Latest checkpoint](docs/migration-status.md) · [Detailed receipt](docs/checkpoints/batch-13-complete-source-bundle.md).

## Development and tests

Node.js **24.22.1** is pinned in CI. Python 3.10+ is required for crawler tests, and Docker is required for the separate pinned Nginx HTTP suite.

```sh
npm ci --no-audit --no-fund
npm test
npm run test:nginx
MARTY_WEBSITE_SOURCE_SHA=development MARTY_WEBSITE_ALLOW_DEVELOPMENT=true npm run build:website
node scripts/verify-standalone-bundle.mjs
```

`npm run build:website` generates the demo module before the website-only TypeScript/Vite stages. Its development output does not have production provenance.

## Ownership

The [web surface contract](contracts/web-surface-routes.json) reserves public marketing/blog/demo pages. Login, authentication callbacks, consoles, APIs, `/verify` and unknown routes remain application-owned; pricing remains withheld. The source `marty-ui` remains authoritative during migration and no production cutover is authorized.

The exact source and extracted adaptation identities are preserved in [provenance](contracts/extraction-provenance.json), [batch 13](contracts/extraction-provenance-batch-13.json), [batch 14](contracts/extraction-provenance-batch-14.json) and later resource/adaptation shards. These are extraction receipts, not signing attestations. Preserve immutable blog v0.1.9 and private commerce boundaries.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
