# Migration checkpoint

## Current milestone: React navigation and metadata integration

[Website PR #7](https://github.com/ElevenID/website/pull/7) groups source extraction, the pinned DOM environment, navigation regression coverage and page metadata coverage into one larger PR with separate commits. **All 88 tests passed on AWS**: 49 native tests and 39 DOM tests across four suites. Track the final required hosted check and merge status on the PR.

| Evidence | Revision |
| --- | --- |
| Accepted base, PR #6 | `8ee7c0221ded85faa2f704dae987cd40767f1139` |
| Verbatim React extraction | `6a92462d3f280ac2fdab01534c0e6e178d953a38` |
| Pinned DOM environment | `384c959af19fc6773aa965f37a1e5c265e583941` |
| Navigation correction and tests | `2200772357096154e9cceedce122fe691992fc19` |
| Metadata correction and tests | `6e16040ebf4abb57f76f91c0ce546c27ae5efa80` |
| AWS-tested functional source tree | `eaa950497c0a810638822f14546fa4d5688cdf2e` |

Read [the batch 7 checkpoint](checkpoints/batch-7-react-integration.md) for source identities, dependency provenance, reproduced failures and coverage limits. Earlier evidence remains in [batch 6](checkpoints/batch-6-navigation.md) and [history through batch 5](migration-history-through-batch-5.md); their resume instructions are historical.

## Next batches

1. Confirm the accepted PR #7 merge and clean AWS checkout before branching from current main. Preserve the existing six-hour automatic stop and workloads.
2. Continue remaining website-owned source extraction using the [source audit](source-import-inventory.json) and [input inventory](input-inventory/README.md). Apply the six current-blob decisions in [source reconciliation](input-inventory/source-reconciliation.json), refreshing drift before each import.
3. Extend the minimal dependency lock to the audited website build closure, preserving the immutable blog pin and MUI resolver. Add website runtime/build entrypoints and generated inputs in reviewable commits within larger milestone PRs.

Selected navigation, metadata and package/config blobs were checked against source `62b5da9d607b0200b417b4d24f040083886b82de`. This does not refresh the entire 79-file candidate graph. `prop-types` is now a direct dependency.

## Remaining build and release gates

The source and input inventories remain bounded evidence. Public assets and the full website build have not been imported or qualified. Verify emitted assets and metadata images, generated crawler output, prerender, actual browser/Nginx handoffs and release/rollback identity before production cutover.

The React/DOM tests record document-navigation calls; they do not load a second document. Demo publication states and website/application route ownership remain unchanged.

Commit and push each verified batch promptly. Keep this recovery checkpoint small and group related batches into larger PRs.
