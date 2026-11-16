# Website

ElevenID's public website, product information and marketing experiences.

## Migration status

This repository is being extracted from [ElevenID/marty-ui](https://github.com/ElevenID/marty-ui). The route and asset contracts, independent build helpers, metadata helpers, navigation/runtime helpers and React navigation boundary are now preserved here. The complete website build and release producer remain pending.

[Batch 7](docs/checkpoints/batch-7-react-integration.md) adds a pinned React/DOM test environment and qualifies navigation and page metadata with **88 tests passing on AWS**: 49 native contract tests and 39 DOM tests. It corrects fragment-only navigation on configured entry aliases and stale keyword metadata across page changes. Actual browser document loading, full builds and deployment remain separate qualification.

The verbatim source and license entries are byte-for-byte identical to their originals at [`df6ec6c4bfee803d89c54e9333297f29f378cee3`](https://github.com/ElevenID/marty-ui/tree/df6ec6c4bfee803d89c54e9333297f29f378cee3). [Extraction provenance](contracts/extraction-provenance.json) records original paths and Git blob hashes, and separately identifies intentional adaptations. This record is not a release attestation or a transfer of Git history.

Start with the short [current migration checkpoint](docs/migration-status.md). Earlier receipts remain in the [batch 6 checkpoint](docs/checkpoints/batch-6-navigation.md) and [history through batch 5](docs/migration-history-through-batch-5.md).

## Run the checks

Use Node.js **24.22.1**, the version pinned in CI:

```sh
npm ci
npm test
```

The committed lock installs the minimal React, React Router, Vitest and jsdom dependencies for this milestone. `npm test` runs `test:contracts` with Node's built-in runner, then `test:dom` with the isolated Vitest configuration. Each can also be run separately. This manifest is not yet the complete website build dependency graph.

## Route ownership

[`contracts/web-surface-routes.json`](contracts/web-surface-routes.json) reserves explicit public routes and prefixes for the website. Other routes belong to the application, including login, authentication callbacks, consoles, API routes and unknown paths. Route ownership alone does not make a page available; pricing remains reserved and withheld by the existing production website.

The source paths are retained for these extraction batches. Their `application/routing` directory name describes their origin; the extracted helpers and React boundary run from this independent website checkout.

See [the migration checkpoint](docs/migration-status.md) for completed work, verification and the next batches. Production source, workflows and routing remain in `marty-ui` while the replacement is qualified.

## License

AGPL-3.0-only. See [LICENSE](LICENSE), preserved from the source repository.
