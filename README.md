# Website

ElevenID's public website, product information and marketing experiences.

## Migration status

This repository is being extracted from [ElevenID/marty-ui](https://github.com/ElevenID/marty-ui). The route and asset contracts, build helpers, runtime foundation, React navigation boundary, ten public pages and selected shared components are now preserved here. The complete website build and release producer remain pending.

[Batch 8](docs/checkpoints/batch-8-runtime-pages-build.md) expands qualification to **178 tests passing on AWS**: 49 native contract tests, 118 DOM tests and 11 build-test records. It covers runtime readiness, supported analytics metrics, translation formatting, selected page rendering and actual Vite fixture builds. The tests reproduce and protect corrections for stale readiness resources, obsolete package APIs, responsive Grid sizing and typography weights. Full WebsiteApp/WebsiteRoutes composition, production assets, prerender and actual browser document loading remain separate qualification.

The verbatim source and license entries are byte-for-byte identical to their originals at [`df6ec6c4bfee803d89c54e9333297f29f378cee3`](https://github.com/ElevenID/marty-ui/tree/df6ec6c4bfee803d89c54e9333297f29f378cee3). [Extraction provenance](contracts/extraction-provenance.json) records original paths and Git blob hashes, and separately identifies intentional adaptations. This record is not a release attestation or a transfer of Git history.

Start with the short [current migration checkpoint](docs/migration-status.md). Earlier receipts remain in [batch 7](docs/checkpoints/batch-7-react-integration.md), [batch 6](docs/checkpoints/batch-6-navigation.md) and [history through batch 5](docs/migration-history-through-batch-5.md).

## Run the checks

Use Node.js **24.22.1**, the version pinned in CI:

```sh
npm ci
npm test
```

The committed lock installs the selected React/Router, MUI/Emotion, i18n, web-vitals and test/build dependencies. `npm test` runs the native contract checks, isolated React/DOM suites and actual Vite fixture-build checks. Individual commands are listed in [package.json](package.json). These fixtures qualify the selected modules and asset contracts; the manifest is not yet the complete website build dependency graph.

## Route ownership

[`contracts/web-surface-routes.json`](contracts/web-surface-routes.json) reserves explicit public routes and prefixes for the website. Other routes belong to the application, including login, authentication callbacks, consoles, API routes and unknown paths. Route ownership alone does not make a page available; pricing remains reserved and withheld by the existing production website.

The source paths are retained for these extraction batches. Their `application/routing` directory name describes their origin; the extracted helpers and React boundary run from this independent website checkout.

See [the migration checkpoint](docs/migration-status.md) for completed work, verification and the next batches. Production source, workflows and routing remain in `marty-ui` while the replacement is qualified.

## License

AGPL-3.0-only. See [LICENSE](LICENSE), preserved from the source repository.
