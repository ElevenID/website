# Migration checkpoint

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

1. Finish the asset, build and test input inventory. The 34-module source-ownership list expands to 79 files in the audited public import graph; that graph alone is not the full build input set.
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
