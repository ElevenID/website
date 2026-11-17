# Website

ElevenID's public website, product information and marketing experiences.

## Migration status

This repository is being extracted from [ElevenID/marty-ui](https://github.com/ElevenID/marty-ui). Route and asset contracts, build helpers, runtime foundations, selected public pages, catalog/demo helpers and website composition foundations are preserved here. The complete website build and release producer remain pending.

[Batch 10](docs/checkpoints/batch-10-crawler-build-routes.md) adds **four build/crawler source files totaling 13,734 bytes** and qualifies website route wiring at explicit page boundaries. Its source-copy checkpoint passed the existing **272 tests**, the two preserved production-contract cases and five Python crawler cases. The expanded aggregate passed **all 353 records**: 54 native, 266 DOM across 20 files and 33 build. The fresh npm audit reported zero vulnerabilities. Five Python cases execute inside one build record and are reported separately. The new checks cover actual route selection and publication gates, actual Vite adapter inclusion, and website-owned crawler artifacts.

The verbatim source and license entries are byte-for-byte identical to their originals at [`df6ec6c4bfee803d89c54e9333297f29f378cee3`](https://github.com/ElevenID/marty-ui/tree/df6ec6c4bfee803d89c54e9333297f29f378cee3). [Extraction provenance](contracts/extraction-provenance.json) records original paths and Git blob hashes, and separately identifies intentional adaptations. This record is not a release attestation or a transfer of Git history.

Start with the short [current migration checkpoint](docs/migration-status.md). Earlier receipts remain in [batch 9](docs/checkpoints/batch-9-demo-catalog-composition.md), [batch 8](docs/checkpoints/batch-8-runtime-pages-build.md), [batch 7](docs/checkpoints/batch-7-react-integration.md), [batch 6](docs/checkpoints/batch-6-navigation.md) and [history through batch 5](docs/migration-history-through-batch-5.md).

## Run the checks

Use Node.js **24.22.1**, the version pinned in CI, and **Python 3.10 or newer** for the standard-library crawler CLI and tests:

```sh
npm ci
npm test
```

The committed lock installs the selected React/Router, MUI/Emotion, i18n, web-vitals and test/build dependencies. `npm test` runs native contract checks, isolated React/DOM suites and actual Vite/crawler fixture checks. Individual commands are listed in [package.json](package.json). Python requires no third-party packages. These fixtures qualify selected modules and artifact contracts; the manifest is not yet the complete website build dependency graph.

## Route ownership

[`contracts/web-surface-routes.json`](contracts/web-surface-routes.json) reserves explicit public routes and prefixes for the website. Other routes belong to the application, including login, authentication callbacks, consoles, API routes and unknown paths. Route ownership alone does not make a page available; pricing remains reserved and withheld by the existing production website.

Source paths are retained during extraction. Their `application/routing` directory name describes their origin; the extracted helpers and React boundary run from this independent repository.

See [the migration checkpoint](docs/migration-status.md) for completed work, verification and remaining qualification. Production source, workflows and routing remain in `marty-ui` while the replacement is qualified.

## License

AGPL-3.0-only. See [LICENSE](LICENSE), preserved from the source repository.
