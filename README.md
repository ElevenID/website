# Website

ElevenID's public website, product information and marketing experiences.

## Migration status

This repository is being extracted from [ElevenID/marty-ui](https://github.com/ElevenID/marty-ui). Route and asset contracts, runtime foundations, selected public pages, catalog/demo helpers and build/server contracts are preserved here. The complete production website and release producer still require qualification.

[Batch 12](docs/checkpoints/batch-12-pages-build-runtime.md), grouped in [PR #12](https://github.com/ElevenID/website/pull/12), adds **seven source files totaling 45,628 bytes**, each below 16 KiB. It covers the identity, protocol and standards pages; a small wallet-schema projection; and website generation, build and public runtime scripts. The page adaptations preserve accessible navigation and existing route handoffs. The build work checks generated inputs, stage ordering and public startup settings with bounded fixtures.

Final validation passed **548 records**: `npm test` passed 528 records in 64.77 seconds (61 native, 345 DOM across 24 files and 122 build), and the separate HTTP suite passed 20 records in 0.77 seconds. There were no failures, cancellations or skips. This adds **92 records** to batch 11. Fresh dependency audit: zero vulnerabilities at every severity (exit 0). Five Python cases inside an existing build record are reported separately without double counting.

The original 79-file source candidate inventory now has **61 paths present and 18 deferred**. Those 18 comprise ten large inputs/page/service/catalog bodies and eight diagram modules or their barrel. The **86 provenance targets** are a separate count that also includes build and other extracted files.

Source preservation uses the immutable [`df6ec6c4bfee803d89c54e9333297f29f378cee3`](https://github.com/ElevenID/marty-ui/tree/df6ec6c4bfee803d89c54e9333297f29f378cee3) snapshot. [Original provenance](contracts/extraction-provenance.json), the [batch 11 shard](contracts/extraction-provenance-batch-11.json) and the [batch 12 shard](contracts/extraction-provenance-batch-12.json) retain original identities and separate later adaptations. They are extraction records, not release attestations or a transfer of Git history.

Start with the compact [current migration checkpoint](docs/migration-status.md). [Batch 11](docs/checkpoints/batch-11-sections-release-routing.md) and earlier receipts remain historical.

## Run the checks

Use Node.js **24.22.1**, pinned in CI, and **Python 3.10 or newer** for the standard-library crawler CLI and tests:

```sh
npm ci
npm test
```

`npm test` runs native contract checks, isolated React/DOM suites and Vite/crawler/build fixtures. [package.json](package.json) lists the individual commands. Build checks require development dependencies, including the pinned `jsdom` package for inert HTML inspection. Python requires no third-party packages.

The separate `npm run test:nginx` command requires Docker and the official image `nginx@sha256:785835ea65db4bba6f021acc0f3be91b0fef76a53fe41f8588c6698d2aed0606`. Required CI pulls that exact image and runs the HTTP suite explicitly.

These checks qualify selected modules and contracts. The build-runner fixture executes Vite while instrumenting the TypeScript stage. The production runner requires the complete configuration and dependencies and rejects an incomplete checkout. Marketing/blog data, SVG/diagrams, the production asset corpus, complete prerender and real browser/application handoffs remain deferred.

## Route ownership

[`contracts/web-surface-routes.json`](contracts/web-surface-routes.json) reserves explicit public routes and prefixes for the website. Other routes belong to the application, including login, authentication callbacks, consoles, API routes and unknown paths. Route ownership does not make a page available: pricing remains reserved and withheld.

Source paths are retained during extraction. Their `application/routing` directory name describes their origin; the extracted helpers and React boundary run from this independent repository. Preserve the reconciled `Start Verifying` CTA to application-owned `/verify` and existing demo publication states.

Production source, workflows and routing remain in `marty-ui` while the replacement is qualified. Production cutover is a later milestone.

## License

AGPL-3.0-only. See [LICENSE](LICENSE), preserved from the source repository.
