# Standalone website publication

The `Standalone website release` workflow publishes the public website from this repository's selected protected-main commit. Its fixed signer identity is `.github/workflows/production-website-release.yml@refs/heads/main`; its image coordinate is `ghcr.io/elevenid/website`. The release subject uses the [v2 standalone contract](standalone-release-contract.md).

Publication includes a fresh complete qualification of the selected source, a registry manifest bound to the qualified container, and original receipt and image signatures. The website release can then enter the existing authenticated intake and composition flow in `ElevenID/marty-ui`.

## Select an exact main source

Merge the source and publisher changes through the repository's normal required checks. Select the complete 40-character lowercase commit SHA from protected `main`, then dispatch the workflow on `main` with that exact value:

```sh
gh workflow run production-website-release.yml \
  --repo ElevenID/website \
  --ref main \
  --field expected_source_sha=EXACT_MAIN_COMMIT_SHA
```

The input is required. If main advances between selection and dispatch, the expected-source comparison fails and a new source must be selected explicitly. Re-running an existing attempt continues to identify that run's original source and records the new attempt number.

The job checks the repository's numeric ID (`1459542519`), manual dispatch event, protected main ref, exact workflow path, workflow commit, actual checkout commit, fetched main history, clean source tree, positive run/attempt identifiers, and GitHub-hosted Linux x64 runner before installing dependencies. GitHub documents `GITHUB_REF_PROTECTED`, `GITHUB_WORKFLOW_SHA` and `RUNNER_ENVIRONMENT` in its [default variables reference](https://docs.github.com/en/actions/reference/workflows-and-actions/variables). These checks supplement the fixed original certificate identity enforced by consumers.

The workflow grants its release job only `contents: read`, `packages: write`, `id-token: write`, `attestations: write` and `artifact-metadata: write`. All actions use immutable commit pins. The job uses the repository's built-in `GITHUB_TOKEN`; it does not require a cross-repository application checkout or an application credential. The image and proofs must be publicly readable at the registry because public release verification runs without registry authentication. A newly created GHCR package may require its owner to configure public visibility before the first complete release can pass that verification.

## Qualification and publication sequence

1. Install the exact website dependency lockfile and run the contract, component, build and Nginx routing tests.
2. Build the independent development fixture and verify its browser routes and isolated application handoff.
3. Build the production static tree, prerender every public route, and verify public assets and final output.
4. Build the pinned-base `linux/amd64` container and qualify that exact local image through Nginx.
5. Finalize the source and output evidence and create the v2 plan from the unchanged checkout and output bytes.
6. Publish the already qualified image, resolve the registry's actual manifest, pull its immutable digest, and verify the manifest and pulled image against the qualified image identity.
7. Create the v2 release subject, sign and attest the published image and receipt, then verify the retained original proofs with the same pinned GitHub CLI and Cosign versions used by consumers.
8. Upload only the fixed release proof set under the original run-attempt artifact name.

The registry operation does not rebuild the container. The local image/config ID, static output inventory digest and registry manifest digest remain distinct values. The published manifest must identify the qualified image configuration, and the immutable pulled image must match the qualified Linux amd64 image and filesystem identity. Only the verified registry manifest digest can become `image.digest` in `website-release.json`.

The publisher uses an attempt-specific `<source SHA>-<run ID>-<attempt>` tag to transfer the qualified image. Consumers select its verified digest; the tag is not an admission identity. [ORAS v1.4.0](https://github.com/oras-project/oras/releases/tag/v1.4.0) is pinned by archive byte length and SHA-256 in `install_website_publisher_tools.sh`; `manifest fetch --output -` supplies unchanged bytes for hashing. The existing consumer's pinned GitHub CLI 2.103.2 and Cosign 3.1.4 installer is copied unchanged, with source lineage recorded in extraction batch 24.

The dependency installation, build and qualification stages use this repository alone. The separate migration-provenance workflow remains an extraction audit. The application handoff exercised here is the isolated qualification fixture; selecting a real combined application and qualifying its actual application/OIDC host are subsequent integration steps.

## Original proof artifact

The retained release artifact is named:

```text
web-website-RUN_ID-RUN_ATTEMPT
```

It contains exactly five files and is retained for 90 days:

| File | Purpose |
| --- | --- |
| `website-release.json` | V2 subject binding source, qualified build plan, image metadata and published registry manifest |
| `website-release.json.sigstore.json` | Original Cosign blob-signature bundle for the exact subject bytes |
| `website-release.json.provenance.jsonl` | Original GitHub SLSA provenance bundle for the receipt |
| `image.provenance.jsonl` | Original GitHub SLSA provenance bundle for the immutable published image |
| `web-surface-routes.json` | Exact source route contract checked against the release metadata |

Before upload, verification checks both subjects against the fixed original repository, workflow, main ref, exact source, hosted runner and original run invocation including attempt. The receipt's Sigstore bundle is verified separately. The registry image signature must identify the same manifest digest. Proof verification uses isolated authentication-free tool processes so a private registry object cannot pass by borrowing the publisher's login.

The artifact name includes the attempt to prevent a rerun from replacing the original proof set. The proof helper rejects missing or unexpected files; upload uses `overwrite: false` and fails on an empty file selection. The artifact ID, archive SHA-256 and immutable image reference appear in the workflow summary after upload. Consumers must select the original successful run and exact attempt; they do not infer release eligibility from the newest artifact or a mutable image tag.

Qualification JSON remains unsigned evidence of the earlier source/build/HTTP checks. It is not renamed into a release receipt and is not admitted by release intake. The fixed release artifact is kept separate from plans, build logs, publication manifests and qualification records.

## Failures and release intake

A failed source, qualification or image-binding check stops the workflow before signing. A failure after publication can leave image objects in the registry, but does not establish a successful release attempt or a valid retained release artifact. Re-run the complete workflow after fixing the cause; a new attempt must qualify its own source and preserve its own original proofs.

The existing consumer workflow in `ElevenID/marty-ui` accepts `website_repository=ElevenID/website` together with the original website run ID and attempt. Its Actions artifact download requires `WEBSITE_RELEASE_READ_TOKEN` with read access to this repository's Actions artifacts. That token is used only for the selected website download. Application and backend intake retain their existing identities and credentials.

Authenticated original-proof intake and cross-repository composition must be qualified against a real published release. A signed website image does not establish that a selected combined application is compatible, that the live host/OIDC handoff works, or that retained-slot rollback has passed. Those gates remain required before production activation under the existing independent website release plan.

Publication does not select production traffic, modify an installation, change AWS resources, remove source from `marty-ui`, or rename an application repository.
