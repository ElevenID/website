# Website

ElevenID's public website, product information, blog and public demonstrations.

## Current migration

[PR #13](https://github.com/ElevenID/website/pull/13) contains **all 79 source candidates and all 46 selected public assets** from the original extraction inventory, including the large page/data modules, diagrams and illustrations.

The [standalone qualification workflow](.github/workflows/standalone-qualification.yml) builds on a clean website-only checkout, renders **262 public routes**, validates each route's expected canonical, and tests the exact built image through Nginx. It preserves source-bound, byte-hashed qualification evidence as a downloadable Actions artifact. The historical source/asset replay is a separate [migration audit](.github/workflows/migration-qualification.yml).

**A qualified build is not yet a published production release.** Image publication, authenticated producer admission, real application/OIDC handoff and retained-slot host rollback remain separate gates. [Latest checkpoint](docs/migration-status.md) · [Qualification and evidence](docs/standalone-qualification.md).

The [standalone release contract](docs/standalone-release-contract.md) defines the website-only producer identity, v2 build/release/image data, exact source and output hashes, and compatibility with existing release consumers. The [manual protected-main publisher](docs/standalone-publication.md) repeats qualification, publishes the exact qualified image, verifies its registry identity, and signs and preserves the original five-file proof set. Merging its source does not dispatch a release or activate production traffic.

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

For production-mode qualification, use an exact clean Git checkout, Chrome and Docker, then follow [the qualification procedure](docs/standalone-qualification.md). Its output records a local Docker image ID, not a published registry digest or signed release.

## Ownership

The [web surface contract](contracts/web-surface-routes.json) reserves public marketing/blog/demo pages. Login, authentication callbacks, consoles, APIs, `/verify` and unknown routes remain application-owned; pricing remains withheld. The existing `marty-ui` release producers remain authoritative for published artifacts until standalone producer admission is qualified. Source extraction does not activate a production cutover.

The exact source and extracted adaptation identities are preserved in [provenance](contracts/extraction-provenance.json), [batch 13](contracts/extraction-provenance-batch-13.json), [batch 14](contracts/extraction-provenance-batch-14.json) and later resource/adaptation shards. These are extraction receipts, not signing attestations. Preserve immutable blog v0.1.9 and private commerce boundaries.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
