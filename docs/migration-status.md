# Migration checkpoint

## Batch 4: input inventory and independent build helpers

Published through [website PR #4](https://github.com/ElevenID/website/pull/4), based on accepted main `b850cdbbd94b5c991767e1dd4e7e2de437b02c8d`.

The [input inventory](input-inventory/README.md) classifies all **83 tracked public files** (46 retained and 37 excluded by existing website behavior) and **59 build/test paths**. Inventory commit: `dcc47e8715cd73d2cb95cdabac51d787cd4191d9`. A metadata comparison of the 79 candidate source files and public tree against `e10a7f26cda8ac217c7ddefebc709fc246dabaff` records **five source changes and one locale change**. These changes must be reconciled before importing the affected files.

A separate source commit copies `dev-server-origin.mjs` and `generated-text.mjs`, plus their original Node tests, without changing bytes. The four files total **4,806 bytes**, and all four blob identities match both the pinned source snapshot and the current-source comparison. The provenance allowlist includes them; the earlier adapted asset-revision guard remains intact.

The root test command explicitly runs the two copied test files alongside the existing contract suite: **19 tests are expected**. The six inherited tests cover exact development origin/HMR/CORS behavior, malformed-origin rejection, cross-platform line endings and detection of changed generated content. See the PR for the observed final hosted-check result and merge receipt; the expected count alone is not evidence of a passing run.

AWS sign-in expired before this batch. No current-turn AWS execution or full website build is claimed. The previous AWS checkout remains at the batch 3 checkpoint until it can fetch the accepted revision after sign-in. No actual public assets, SVGs, lockfile contents or large generated modules were read or copied for this batch.

### Current resume point

1. Restore AWS sign-in, reconnect to the existing development instance and verify the automatic-stop safeguard. Refresh the existing website checkout from accepted main; preserve any local changes.
2. Run the expanded dependency-free contract suite on the existing pinned Node 24.22.1 runtime.
3. Reconcile the five changed source files and English marketing locale using targeted reads and exact Git identities.
4. Continue classified source/assets extraction separately from build-context changes. Preserve the immutable blog pin/MUI resolver and declare directly imported `prop-types`.
5. Correct metadata image URLs, then qualify real asset emission, generated inputs, independent build/prerender, Nginx/browser handoffs and release-producer identity.

The shared `@ui-public-routes` alias is source-configuration evidence, not a demonstrated website dependency; do not bring application routes into the new repository to satisfy an unused alias. Demo publication states and route ownership remain unchanged.

## Batch 3: asset URL contracts on AWS

Published for review through [website PR #3](https://github.com/ElevenID/website/pull/3).

| Evidence | Revision |
| --- | --- |
| Accepted base | `cc2b3f82a23dd0118ee966868f80a39db84e8dfa` |
| Verbatim asset-helper extraction | `a6da397976533fdbd31a42eb1ea8fc59837f7ee4` |
| Original asset-helper blob | `0cf0fee406e2d4c1888f254e0b7867a9092149d4` |

The first commit copies `ui/scripts/website-assets.mjs` from the pinned source snapshot and adds independent asset-URL tests. The same source blob was also verified at `marty-ui` commit `5e0734151ab8428cc5174aed83eb6d8eac3082d7`; this check does not requalify the rest of the older import inventory.

The next commit rejects non-string asset revisions before regular-expression validation or string interpolation. Previously, arrays and objects could pass validation through implicit conversion. A stateful `toString` could then supply different text when the asset URL was constructed. The correction preserves all accepted primitive-string revision forms and never invokes user-defined conversion for a rejected value.

The original helper remains recoverable from the extraction commit. Its current record moves to `adapted_files` with the original source blob and a description of this deliberate change; it is no longer represented as a verbatim copy.

Validation ran in an isolated checkout on the existing AWS Free-plan development instance, with Node.js **24.22.1** verified against the official distribution checksum. The initial extraction passed 11 tests. Both new non-string regression tests failed against the original helper, then all **13 tests passed** after the correction, with no skips. The staged whitespace check also passed. No dependency installation was needed. See the PR for the published head, required hosted-check result and merge receipt.

The tests cover revision namespaces, HTML entry/runtime/static URL rewriting, blog-owned local image rewriting, preserved external URLs and application links, non-string rejection, and the existing route/provenance contracts. They do not invoke `buildStart` or enumerate real public assets. No SVG, large generated module, shared lockfile or production data was read or copied for this batch.

### Next slice recorded after batch 3

Finish the asset/build/test input classification using file names, sizes and Git identities. Preserve the committed source snapshot until relevant changes are reconciled; do not fetch an aggregate diff or dump asset contents. Then extract the classified source and assets separately from the website-only build.

The following known items must be addressed before standalone-build qualification:

- Keep the common/marketing locales for `de`, `en`, `es`, `fr`, `ja`, `nl`, the immutable blog package pin and its MUI compatibility resolver.
- Declare the directly imported `prop-types` dependency in the reduced package.
- Preserve generated demo-manifest inputs and the committed wallet-schema projection without importing the installer tree.
- Remove the incidental API-core download and application-pruning import from the website-specific build context.
- Correct default Open Graph/Twitter and JSON-LD logo URLs: the source currently uses an absolute root `logo512.png` URL while the asset build namespaces the image by revision.
- Keep real asset emission, independent build, prerender, Nginx/browser handoffs, producer identity and production cutover as explicit remaining gates.

## Batch 1 complete: route contract foundation

Integrated through [website PR #1](https://github.com/ElevenID/website/pull/1) using the normal protected merge path.

| Evidence | Revision |
| --- | --- |
| Published PR head | `08823069f4a11b2ddc43dcabc2948189a4ed26fd` |
| Hosted CI merge checkout | `694bdc1727de0e3433b7467f764285005c98d32f` |
| Accepted main commit | `9136480448f380aa585ded15b075ce955fc684af` |
| Shared source tree | `318e7fd535b9f6243717f826c68bbcb2cd009cbd` |

Destination base: `ElevenID/website` initial commit `e24f1401a7de0d1c9dbff1fc875003feca3b1030`.

Source snapshot: `ElevenID/marty-ui` commit `df6ec6c4bfee803d89c54e9333297f29f378cee3`.

Planning reference: [marty-ui PR #1969](https://github.com/ElevenID/marty-ui/pull/1969), head `f22b5de068b4eb3ebffe70a1de447cafe437ec6a`. It records the separate website, platform and application responsibilities.

This batch copies the existing route data, pure routing helpers and license without changing their bytes. Its test suite checks website/application boundaries, malformed inputs, canonical contract identity and copied-file hashes. It requires no third-party packages or application checkout. The extraction record identifies original source blobs; it does not establish release provenance or preserve source-repository ancestry.

The `Website contracts` CI job runs on pull requests, pushes to `main`, and merge groups. It uses Ubuntu 24.04, exact Node.js 24.22.1, read-only repository permissions and checkout without persisted credentials. The pinned checkout/setup-node revisions come from the recorded source CI workflow.

[Hosted run 43812040235, job 133115635465](https://github.com/ElevenID/website/actions/runs/43812040235/job/133115635465) passed all 6 tests on Node.js 24.22.1. It tested the synthetic merge checkout listed above; that checkout, the published PR head and accepted main commit have the same source tree. This qualifies the route-contract foundation, not the remaining website build or deployment.

Local validation for this batch: `npm test` passed all 6 tests on Node.js 24.22.1, with no failures or skips. The staged whitespace check passed. All five copied-file hashes, including the original license, match their recorded source blobs.

## Repository controls after integration

Actions are enabled with full action-SHA pinning and approval for all external contributors. The default workflow token has read access to contents and packages; workflow creation or approval of pull requests is disabled.

The active `main-protection` ruleset (`27350292`) targets the default branch with no bypass. It requires pull requests and resolved review threads, and blocks deletion and non-fast-forward updates. `Website contracts` is now a required status check from GitHub Actions (integration `15368`), with strict up-to-date branch checking enabled.

## Retained source audit

[`source-import-inventory.json`](source-import-inventory.json) records the 79-file candidate source closure, exact blob hashes, public alias mappings and 75 unique bare package import specifiers at the source snapshot above. All 79 recorded hashes were verified against the retrieved source bytes. The audit found no unresolved literal relative imports under the recorded resolution assumptions.

The inventory is audit-only. It does not authorize export or deletion and does not prove the complete build graph. Public assets, translations, package locks, build configuration, tests, computed imports, generated-module inputs and runtime fetches still require classification and verification.

## Next batch

1. Finish content/build qualification of the classified inputs and reconcile recorded source drift. The 34-module source-ownership list expands to 79 candidate source files; metadata classification alone is not a complete executed build graph.
2. Extract the public website source and required assets in a separate commit, with original paths and source identities recorded. Retain the source in `marty-ui` during qualification.
3. Create a self-contained website build context and dependency lock. The public source graph does not import API-core, but the current shared Dockerfile downloads it; remove that incidental dependency in the website-specific build.
4. Run the public-route, prerender, crawler, asset, Nginx and browser handoff checks from a clean website-only checkout. Preserve the blog package pin and the common/marketing language resources.
5. Address publication identity and consumer compatibility in a separate reviewed batch. Existing metadata and verifiers bind `ElevenID/marty-ui`; a new producer needs its own exact repository/workflow/run identity and a bounded migration policy.

The current website build, image publication, application integration and host deployment remain unqualified in this repository. Production source, workflows and routing are unchanged. Private commerce remains isolated, and platform/Canvas extraction continues as separate work. Production cutover requires its own host qualification and rollback evidence.

## Resume in small batches

1. Fetch the current `main` and confirm accepted commit `9136480448f380aa585ded15b075ce955fc684af` is in its ancestry. Read this checkpoint and the retained import inventory before choosing the next slice.
2. Start a branch from current `main`; inspect source changes since the pinned audit commit before reusing any inventory. Begin with the missing asset/build/test input classification above.
3. Complete and verify one bounded change, then commit and push it promptly. Keep source extraction, build changes and release-identity migration in separate reviewable batches.
4. Record each published head, PR, tested revision and remaining gate in the next checkpoint. Carry the exact stopping point forward before expanding scope.
