# Website

ElevenID's public website, product information and marketing experiences.

## Migration status

This repository is being extracted from [ElevenID/marty-ui](https://github.com/ElevenID/marty-ui). The route-contract foundation is merged through [PR #1](https://github.com/ElevenID/website/pull/1), with `Website contracts` configured as a required check. It preserves the existing website/application route contract and its validation helpers. The complete website build and release producer remain pending.

The next [asset-contract batch](https://github.com/ElevenID/website/pull/3) adds independent asset URL checks and rejects non-string revisions before conversion. Its 13 dependency-free tests passed on the existing AWS development environment.

The verbatim source and license entries are byte-for-byte identical to their originals at [`df6ec6c4bfee803d89c54e9333297f29f378cee3`](https://github.com/ElevenID/marty-ui/tree/df6ec6c4bfee803d89c54e9333297f29f378cee3). [Extraction provenance](contracts/extraction-provenance.json) records the original paths and Git blob hashes, and separately identifies intentional adaptations. This source record is not a release attestation or a transfer of Git history.

The [input inventory and build-helper batch](https://github.com/ElevenID/website/pull/4) records public assets, build/test inputs and source drift, and extracts two dependency-free helpers with their original tests. See [the input inventory](docs/input-inventory/README.md) for scope and remaining qualification gates. AWS validation for this batch awaits restored sign-in; hosted checks are linked from the PR.

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
