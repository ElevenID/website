# Website

ElevenID's public website, product information and marketing experiences.

## Migration status

This repository is being extracted from [ElevenID/marty-ui](https://github.com/ElevenID/marty-ui). The route and asset contracts, independent build helpers, metadata helpers and pure navigation/runtime boundary are now preserved here. The complete website build and release producer remain pending.

[Batch 6](docs/checkpoints/batch-6-navigation.md) copies six navigation/runtime helpers, corrects double decoding of landing-page error messages, and expands the suite to **49 tests passing on AWS**. The tests execute the actual helper modules and route JSON. React click handling, full builds and deployment remain separate qualification.

The verbatim source and license entries are byte-for-byte identical to their originals at [`df6ec6c4bfee803d89c54e9333297f29f378cee3`](https://github.com/ElevenID/marty-ui/tree/df6ec6c4bfee803d89c54e9333297f29f378cee3). [Extraction provenance](contracts/extraction-provenance.json) records original paths and Git blob hashes, and separately identifies intentional adaptations. This record is not a release attestation or a transfer of Git history.

Start with the short [current migration checkpoint](docs/migration-status.md). Older receipts are retained in [the history through batch 5](docs/migration-history-through-batch-5.md).

## Run the checks

Use Node.js **24.22.1**, the version pinned in CI:

```sh
npm test
```

No dependency installation is needed. The checks use Node's built-in test runner and standard library.

## Route ownership

[`contracts/web-surface-routes.json`](contracts/web-surface-routes.json) reserves explicit public routes and prefixes for the website. Other routes belong to the application, including login, authentication callbacks, consoles, API routes and unknown paths. Route ownership alone does not make a page available; pricing remains reserved and withheld by the existing production website.

The source paths are retained for these extraction batches. Their `application/routing` directory name describes their origin; these copied helpers are pure functions and do not require an application checkout.

See [the migration checkpoint](docs/migration-status.md) for completed work, verification and the next batch. Production source, workflows and routing remain in `marty-ui` while the replacement is qualified.

## License

AGPL-3.0-only. See [LICENSE](LICENSE), preserved from the source repository.
