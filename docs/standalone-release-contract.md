# Standalone website release contract

Milestone 16 defined the public website producer's data contract and the consumer rules needed to accept its signed releases. Milestone 17 installs the [manual protected-main publisher](standalone-publication.md) that implements that contract. Publishing and verifying a real release remains a separate operation from merging the source; production selection and host changes are later qualification gates.

The implementation is split between the producer in this repository and the existing web release consumers in `ElevenID/marty-ui`. The producer is `scripts/lib/standalone-release-contract.mjs`; the planning command is `scripts/website-release-contract.mjs`. Consumer validation lives in `website_release.py`, with role policy in `website_producer_policy.py` and original-proof checks in `website_provenance.py`.

## Fixed producer identity

| Property | Standalone public website contract |
| --- | --- |
| Repository | `ElevenID/website` |
| Numeric repository ID | `1459542519` |
| Signer workflow | `.github/workflows/production-website-release.yml` |
| Signer ref | `refs/heads/main` |
| Image repository | `ghcr.io/elevenid/website` |
| Platform | `linux/amd64` |
| Production pages | `public` |
| Commerce extension | `null` |
| Build-plan schema | `marty.website-build-plan/v2` |
| Release-receipt schema | `marty.website-release/v2` |
| Image metadata schema | `marty.website-image/v2` |

The signer workflow accepts only manual dispatch for an explicitly selected protected-main commit. The `standalone-qualification.yml` workflow remains a separate, unsigned qualification workflow. Its workflow identity cannot stand in for the release identity.

Source and revision are the same exact 40-character lowercase Git commit SHA from this repository. Run ID and run attempt are positive decimal strings. A later signed receipt must bind both to the original successful main release attempt. Branch names, abbreviated SHAs, mutable image tags and application-repository SHAs cannot replace these values.

## Exact build inputs and output

The v2 plan describes the build that this repository actually performs: a static output tree built with the root dependency lockfile and packaged by `Dockerfile.website`. Its fixed `build_kind` is `prebuilt-static`; it does not describe the legacy `docker/ui.Dockerfile` website target or require an application checkout.

The plan records raw-file SHA-256 fingerprints for this closed set of source inputs:

| Input group | Files |
| --- | --- |
| Dependencies | `package.json`, `package-lock.json` |
| Container | `Dockerfile.website`, `scripts/build-website-image.mjs` |
| Routes and rendering | `contracts/web-surface-routes.json`, `scripts/prerender-website.mjs`, `scripts/website-prerender-plan.mjs` |
| Nginx | `ui/nginx.website.conf`, `ui/nginx.website.headers.conf`, `ui/scripts/render-website-nginx.mjs` |
| Bundler | `ui/vite.config.mjs` |

The exact source commit identifies the complete tracked source tree, including code outside this fingerprint index. The preceding qualification context also records the Git tree SHA. The planning command requires the claimed source to match actual HEAD and rejects tracked changes and untracked source files before and after creating the plan. Inputs must be bounded regular files with no symlink components.

The plan fixes the container base to:

```text
nginx:1.29.1-alpine@sha256:42a516af16b852e33b7682d5ef8acbd5d13fe08fecadc7ed98605ba5e3b26ab8
```

The command checks the Dockerfile's `FROM` line against that value. The only build arguments in this contract are:

```text
WEBSITE_SOURCE_SHA=<source SHA>
WEBSITE_REVISION=<same source SHA>
WEBSITE_ROUTE_CONTRACT_SHA256=<route contract digest>
```

The output identity contains the fixed directory `ui/dist-website`, the qualification inventory digest, file count and total bytes. Qualification walks the complete emitted tree, rejects symlinks and special files, and records each relative path, byte size and file SHA-256. The output must contain between 1 and 10,000 files and at most 512 MiB. The inventory digest is computed over that inventory's encoded file list; it is not a container digest or an archive digest.

The route contract has version `1` and a SHA-256 digest of its canonical JSON representation. The raw `contracts/web-surface-routes.json` fingerprint and this canonical route digest serve different purposes: one identifies source bytes; the other expresses route compatibility despite formatting differences. The plan's build argument, emitted image metadata and verified source route contract must agree.

The plan uses closed objects. Unknown or missing fields, extra input paths, other owners, private commerce, another platform, a different base image and out-of-bounds output are rejected. A structurally valid plan remains a declaration of inputs. Its authenticity depends on the original producer's later signed evidence.

## Generate a plan from qualification

First complete the production-mode source, prerender, output, image and HTTP checks described in [standalone-qualification.md](standalone-qualification.md). Keep the output and qualification receipts from the same source and workflow context, then run:

```sh
node scripts/website-release-contract.mjs plan
```

`MARTY_WEBSITE_SOURCE_SHA` must still identify the qualified clean checkout. The command re-runs the qualification finalizer, rechecks all stage receipts against the current output, hashes the source inputs, and compares the built `marty-website-release.json` with the expected v2 image metadata. It prints the plan to standard output. Keep captured output outside the tracked source tree and outside the qualification directory's closed receipt set.

The command emits a build plan only. It does not convert `website-qualification.json` into a release receipt or infer a registry digest from its local image ID. Repeated finalization is permitted only when the existing evidence bytes still match.

For the plan digest, JavaScript recursively sorts object keys, serializes with two-space indentation, and appends one newline. Python uses the same representation through the existing canonical serializer. All admitted contract strings are ASCII. A shared synthetic contract fixture and its expected digest exercise byte-for-byte parity between the two implementations. Synthetic fixtures establish parser and compatibility behavior; they are not production evidence.

## Release receipt and proof boundary

The pure release factory defines the `marty.website-release/v2` subject. It contains the exact source/revision, public audience, null commerce extension, original producer identity, fixed image coordinate with a manifest digest, complete v2 build plan and its digest, and expected v2 image metadata. The validator requires those representations to agree. The factory does not sign or authenticate any of them. The read-only `website-release-contract.mjs validate --receipt ABSOLUTE_PATH` command applies this complete closed schema to a bounded local receipt; cryptographic verification follows separately.

Three identifiers must remain distinct:

| Identifier | What it identifies | Admissible as a published image reference? |
| --- | --- | --- |
| `local_image_id` in qualification | The Docker image/config ID built and exercised locally | No |
| Output inventory digest | The listed static output paths and bytes | No |
| `image.digest` in a signed release | The published OCI manifest selected at the fixed registry coordinate | Only after original image proof and registry verification |

Each may use SHA-256 syntax. Syntax validation cannot establish which bytes were hashed. The publisher supplies the factory's `registryManifestDigest` argument only after hashing the unchanged registry manifest, binding its configuration digest to the qualified local image ID, and pulling the exact digest to compare platform, ordered RootFS layers and repository identity. Renaming a local image ID does not establish a manifest, registry presence, signature or provenance. Consumers verify the OCI reference itself as well as the original receipt.

The retained website proof set remains exactly:

```text
website-release.json
website-release.json.sigstore.json
website-release.json.provenance.jsonl
image.provenance.jsonl
web-surface-routes.json
```

Release intake must select `web-website-RUN_ID-RUN_ATTEMPT` from the original successful `workflow_dispatch` attempt on main. It binds the artifact to the numeric repository ID, exact workflow, original source, run and attempt, verifies the archive digest and bounded fixed file set, and checks the original proofs. An unsigned `web-qualification-*` artifact does not satisfy that contract.

Original proof verification checks GitHub's issuer, hosted runner, source repository URI and numeric ID, source digest and ref, build signer URI and exact run invocation including attempt. It verifies the receipt's original Sigstore bundle and attestation, and separately verifies the published OCI image's signature and attestation. Composition and host intake preserve and repeat those checks rather than granting a new owner to copied evidence.

## Role separation and compatibility

The new repository is admitted only for the `website` role and only for its own image coordinate. The policy does not extend the legacy general repository allowlist.

| Producer | Website | Application | Composition | Stable backend |
| --- | --- | --- | --- | --- |
| `ElevenID/website` | Public v2 only | Rejected | Rejected | Rejected |
| Existing `ElevenID/marty-ui` producer | Existing public v1 | Existing combined application | Existing public authority | Existing stable producer contract |
| Existing private subscriptions producer | Existing private/full v1 | Existing private application | Existing private authority | Existing backend linkage remains unchanged |

Application and composition verification use their explicit roles. Legacy generic proof callers remain restricted to legacy repositories. The new website identity cannot sign an application compatibility receipt, outer composition, backend inventory or another owner's image into acceptance.

A composition may pair the new standalone website with an existing combined public application from a different source SHA. It must retain each original producer identity, source, run, attempt and proof files. Website and application must agree on audience and the exact route contract. The backend remains bound to the selected original application release. No relabeling of a website commit as an application commit is permitted.

Legacy public and private v1 receipts remain valid through their existing schema, repository, workflow and image coordinates. Existing private registry credential handling remains in force. Retained website slots admit the new public image in addition to the legacy public and private images; private revisions keep their original commerce-source form. Rollback continues to reauthenticate the retained composition and original proofs, while preserving the currently adopted product baseline and OpenBao controls.

The extraction's retained full adapter still emits its historical v1 metadata. It is outside the standalone public release contract. Development metadata can identify the development build but cannot pass the production release validator.

## Reviewed milestones and operational qualification

Milestone 16 completed the contract, qualified plan generation, role-scoped consumer admission, unchanged legacy compatibility, and tests of cross-repository composition and retained slots. Its tests cover substituted owners and roles, wrong workflow/ref/run attempts, nested extra fields, mixed v1/v2 envelopes, altered plan digests, unsigned qualification supplied as a release, public/private mismatch and retained legacy rollback inputs.

The milestone 17 publisher implements the following publication and original-proof checks. Their operational acceptance requires a real successful manual run and subsequent consumer qualification:

1. Run from the exact protected-main source under the reserved workflow and repository identity, with pinned release tools and narrowly scoped publication/signing permissions.
2. Reproduce the complete qualification, preserve its source and output identity, and publish the exact qualified container. Record the registry's actual manifest digest, resolve the expected platform, and verify the pulled image and metadata against the qualified image and static output. A local config ID must never be reported as the manifest digest.
3. Produce the v2 release subject from those actual inputs, sign and attest the fixed original receipt and published image, and verify the results with the same pinned verifiers used by consumers.
4. Retain the complete fixed proof set in the exact original run-attempt artifact and demonstrate original-proof intake and cross-repository composition using those real published bytes.
5. Qualify the selected combined application's compatibility marker and actual host/application handoff, including retained-slot rollback and existing credential/OpenBao safeguards, before any production activation.

The source implements steps 1–3 and fixed artifact retention in step 4. Real original-proof intake/composition in step 4 and host/application qualification in step 5 remain subsequent operational gates. Existing production workflow defaults remain unchanged.
