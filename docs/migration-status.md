# Migration checkpoint

## Batch 1: route contract foundation

Branch: `feat/website-route-contract`.

Destination base: `ElevenID/website` initial commit `e24f1401a7de0d1c9dbff1fc875003feca3b1030`.

Source snapshot: `ElevenID/marty-ui` commit `df6ec6c4bfee803d89c54e9333297f29f378cee3`.

Planning reference: [marty-ui PR #1969](https://github.com/ElevenID/marty-ui/pull/1969), head `f22b5de068b4eb3ebffe70a1de447cafe437ec6a`. It records the separate website, platform and application responsibilities.

This batch copies the existing route data, pure routing helpers and license without changing their bytes. Its test suite checks website/application boundaries, malformed inputs, canonical contract identity and copied-file hashes. It requires no third-party packages or application checkout. The extraction record identifies original source blobs; it does not establish release provenance or preserve source-repository ancestry.

The `Website contracts` CI job runs on pull requests, pushes to `main`, and merge groups. It uses Ubuntu 24.04, exact Node.js 24.22.1, read-only repository permissions and checkout without persisted credentials. The pinned checkout/setup-node revisions come from the recorded source CI workflow. Hosted CI and the normal protected merge path must pass before integration; local tests alone do not establish that result.

Local validation for this batch: `npm test` passed all 6 tests on Node.js 24.22.1, with no failures or skips. The staged whitespace check passed. All five copied-file hashes, including the original license, match their recorded source blobs.

## Repository controls observed during preparation

Actions are enabled with full action-SHA pinning and approval for all external contributors. The default workflow token has read access to contents and packages; workflow creation or approval of pull requests is disabled.

The active `main-protection` ruleset targets the default branch with no bypass. It requires pull requests and resolved review threads, and blocks deletion and non-fast-forward updates. A required status check is still pending: add `Website contracts` after its first successful hosted run exists.

## Next batch

1. Finish the asset, build and test input inventory. The 34-module source-ownership list expands to 79 files in the audited public import graph; that graph alone is not the full build input set.
2. Extract the public website source and required assets in a separate commit, with original paths and source identities recorded. Retain the source in `marty-ui` during qualification.
3. Create a self-contained website build context and dependency lock. The public source graph does not import API-core, but the current shared Dockerfile downloads it; remove that incidental dependency in the website-specific build.
4. Run the public-route, prerender, crawler, asset, Nginx and browser handoff checks from a clean website-only checkout. Preserve the blog package pin and the common/marketing language resources.
5. Address publication identity and consumer compatibility in a separate reviewed batch. Existing metadata and verifiers bind `ElevenID/marty-ui`; a new producer needs its own exact repository/workflow/run identity and a bounded migration policy.

The current website build, image publication, application integration and host deployment remain unqualified in this repository. Production source, workflows and routing are unchanged. Private commerce remains isolated, and platform/Canvas extraction continues as separate work. Production cutover requires its own host qualification and rollback evidence.
