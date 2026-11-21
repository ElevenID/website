# Website

ElevenID's public website, product information, blog and public demonstrations.

## Current migration

[PR #13](https://github.com/ElevenID/website/pull/13) contains **all 79 source candidates and all 46 selected public assets** from the original extraction inventory, including the large page/data modules, diagrams and illustrations.

The [standalone qualification workflow](.github/workflows/standalone-qualification.yml) builds on a clean website-only checkout, renders the public route plan, validates each route's expected canonical, and tests the exact built image through Nginx. It preserves source-bound, byte-hashed qualification evidence as a downloadable Actions artifact. The historical source/asset replay is a separate [migration audit](.github/workflows/migration-qualification.yml).

**Standalone signed publication and cross-owner composition are qualified.** The original [publisher run `44449706828`, attempt 2](https://github.com/ElevenID/website/actions/runs/44449706828/attempts/2) supplied the website selected by the successful [composition run `44594894023`, attempt 1](https://github.com/ElevenID/marty-ui/actions/runs/44594894023/attempts/1). A newer successful website publication does not change that composition's pinned inputs. Actual application/OIDC handoff, isolated-host promotion and retained-slot rollback remain separate gates. [Latest checkpoint](docs/migration-status.md) · [Qualification and evidence](docs/standalone-qualification.md).

The [standalone release contract](docs/standalone-release-contract.md) defines the website-only producer identity, Bun v3 build/release/image data with retained v2 compatibility, exact source and output hashes, and compatibility with existing release consumers. The [manual protected-main publisher](docs/standalone-publication.md) repeats qualification, publishes the exact qualified image, verifies its registry identity, and signs and preserves the original five-file proof set. Merging its source does not dispatch a release or activate production traffic.

## Development and tests

Bun **1.4.4** installs dependencies and runs package scripts. Node.js **24.22.1** is pinned in CI for website tooling and the test runtime. Python 3.10+ is required for crawler tests, and Docker is required for the separate pinned Nginx HTTP suite.

```sh
node scripts/verify-package-manager.mjs
bun install --frozen-lockfile --linker=hoisted
bun run test
bun run test:nginx
MARTY_WEBSITE_SOURCE_SHA=development MARTY_WEBSITE_ALLOW_DEVELOPMENT=true bun run build:website
node scripts/verify-standalone-bundle.mjs
```

`bun run dev` serves the website at Vite's printed local URL with runtime configuration, branding, translations, images and demo manifests in the same website-owned namespaces used by builds. Set `VITE_DEV_PUBLIC_ORIGIN=https://your-development-host:8443` when an existing development edge supplies the public origin; HMR keeps that exact host and port. Application-owned sign-in and verification journeys still require the separate application/edge.

`packageManager` pins Bun, and `bun.lock` is the install lock. `package-lock.json` remains the reviewed compatibility/reference lock. `node scripts/verify-package-manager.mjs` verifies that both locks describe identical package versions, sources and integrity values. Node 24 remains the JavaScript runtime for the build and test commands.

`bun run build:website` generates the demo module before the website-only TypeScript/Vite stages. Its development output does not have production provenance.

For production-mode qualification, use an exact clean Git checkout, Chrome and Docker, then follow [the qualification procedure](docs/standalone-qualification.md). Its output records a local Docker image ID, not a published registry digest or signed release.

The [regression audit](docs/extraction-regression-audit.md) records the Bun and local-development repairs and their validation. These source changes do not replace the accepted signed publication/composition checkpoint above.

## Ownership

The [web surface contract](contracts/web-surface-routes.json) reserves public marketing/blog/demo pages. Login, authentication callbacks, consoles, APIs, `/verify` and unknown routes remain application-owned; pricing remains withheld. `ElevenID/website` publishes its own website image and proofs. Existing `marty-ui` producers retain application, backend and outer composition authority. Published artifacts and accepted composition do not establish a production cutover.

The exact source and extracted adaptation identities are preserved in [provenance](contracts/extraction-provenance.json), [batch 13](contracts/extraction-provenance-batch-13.json), [batch 14](contracts/extraction-provenance-batch-14.json) and later resource/adaptation shards. These are extraction receipts, not signing attestations. Preserve immutable blog v0.1.9 and private commerce boundaries.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
