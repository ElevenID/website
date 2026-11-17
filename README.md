# Website

ElevenID's public website, product information and marketing experiences.

## Migration status

This repository is being extracted from [ElevenID/marty-ui](https://github.com/ElevenID/marty-ui). Route and asset contracts, build helpers, runtime foundations, selected public pages, catalog/demo helpers and website composition foundations are preserved here. The complete website build and release producer remain pending.

[Batch 11](docs/checkpoints/batch-11-sections-release-routing.md) adds **12 bounded source files totaling 60,382 bytes**: the AI page/catalog adapter, four landing sections, and six website build/server files. It qualifies actual component behavior with explicit small input boundaries, corrects MUI layout/typography and accessible navigation, and advances website release identity and server routing checks. Final development validation: **436 passing native/DOM/build records** — 56 native, 304 DOM across 22 files, and 76 build. 20 separate Nginx HTTP cases passed in 0.72 seconds. Together, the commands passed **456 records**, with no failures, cancellations or skips. Fresh dependency audit: zero vulnerabilities at every severity (exit 0). Five Python cases execute inside one existing build record and are reported separately without double counting.

Source preservation uses the immutable [`df6ec6c4bfee803d89c54e9333297f29f378cee3`](https://github.com/ElevenID/marty-ui/tree/df6ec6c4bfee803d89c54e9333297f29f378cee3) snapshot. [Earlier provenance](contracts/extraction-provenance.json) and the bounded [batch 11 provenance shard](contracts/extraction-provenance-batch-11.json) record original paths and Git blob hashes, with intentional adaptations recorded separately. These records are not release attestations or a transfer of Git history.

Start with the short [current migration checkpoint](docs/migration-status.md). Historical receipts include [batch 10](docs/checkpoints/batch-10-crawler-build-routes.md), [batch 9](docs/checkpoints/batch-9-demo-catalog-composition.md), [batch 8](docs/checkpoints/batch-8-runtime-pages-build.md), [batch 7](docs/checkpoints/batch-7-react-integration.md), [batch 6](docs/checkpoints/batch-6-navigation.md) and [history through batch 5](docs/migration-history-through-batch-5.md).

## Run the checks

Use Node.js **24.22.1**, the version pinned in CI, and **Python 3.10 or newer** for the standard-library crawler CLI and tests:

```sh
npm ci
npm test
```

The committed lock installs the selected React/Router, MUI/Emotion, i18n, web-vitals and test/build dependencies. `npm test` runs native contract checks, isolated React/DOM suites and actual Vite/crawler fixture checks. Individual commands are listed in [package.json](package.json). Python requires no third-party packages. The distribution validator uses the already-pinned `jsdom` package for inert HTML inspection, so install development dependencies for build checks. The separate `npm run test:nginx` suite requires Docker and the official image `nginx@sha256:785835ea65db4bba6f021acc0f3be91b0fef76a53fe41f8588c6698d2aed0606` to be available. Required CI pulls that exact image and runs the HTTP suite explicitly; `npm test` retains the native/DOM/build aggregate.

These checks qualify selected modules and artifact contracts. Large production data, diagrams/SVG, the immutable blog package and complete production composition remain deferred.

## Route ownership

[`contracts/web-surface-routes.json`](contracts/web-surface-routes.json) reserves explicit public routes and prefixes for the website. Other routes belong to the application, including login, authentication callbacks, consoles, API routes and unknown paths. Route ownership alone does not make a page available; pricing remains reserved and withheld by the existing production website.

Source paths are retained during extraction. Their `application/routing` directory name describes their origin; the extracted helpers and React boundary run from this independent repository.

See [the migration checkpoint](docs/migration-status.md) for completed work, verification and remaining qualification. Production source, workflows and routing remain in `marty-ui` while the replacement is qualified.

## License

AGPL-3.0-only. See [LICENSE](LICENSE), preserved from the source repository.
