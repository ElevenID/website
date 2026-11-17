# Migration checkpoint

## Current milestone: runtime, public pages and fixture builds

[Website PR #8](https://github.com/ElevenID/website/pull/8) groups 24 source copies, the expanded dependency environment, compatibility corrections and real Vite fixture qualification into one larger PR. **All 178 tests passed on AWS**: 49 native tests, 118 DOM tests across 13 files and 11 build-test records. Clean installation, dependency validation and the separate npm audit passed; the audit reported zero vulnerabilities.

| Evidence | Revision |
| --- | --- |
| Accepted base, PR #7 | `8d473beb3971d09da07a36eaeb11faf3e9081a78` |
| Runtime correction | `d9e870a86a1509769c85d61e10024e1785516a69` |
| Page/UI correction | `789ac14f44eea03e1803a79c9a079bffe8bd8e62` |
| AWS-tested functional tree | `4cede259ed4c9eb36fc8a3a144f9fa9267cbc927` |

Read [the batch 8 receipt](checkpoints/batch-8-runtime-pages-build.md) for dependency pins, reproduced failures, build scope and source identities. Track the final required CI check and merge status on PR #8. Earlier receipts remain unchanged; their resume instructions are historical.

## Resume and next batches

1. Refresh PR #8 and the AWS receipt before new work. If it has merged, begin from its accepted main; otherwise continue its existing branch and final gates. Preserve the six-hour automatic stop and other workloads.
2. Complete WebsiteApp/WebsiteRoutes composition and remaining page dependencies using the [source audit](source-import-inventory.json) and [input inventory](input-inventory/README.md). Bootstrap helpers alone do not close the application entry graph.
3. Preserve the six current-blob decisions in [source reconciliation](input-inventory/source-reconciliation.json). The [new metadata receipt](input-inventory/source-refresh-batch-8.json) checks all 79 source candidates and the reconciled locale against `a4fc3801b636e2cfd0753797e8fc0dc846b42a22`: no missing paths or unexpected differences. Refresh again before later imports if source advances.
4. Extend the existing lock/build context to the remaining website graph, including the immutable blog dependency and generated inputs. Keep source reads bounded and group related verified commits into larger PRs.

## Remaining qualification

Real Vite fixtures now cover asset emission contracts and the ten selected page imports. They use small synthetic inputs and do not qualify the full website asset corpus or production entrypoint.

Full website rendering, remaining large/generated inputs, crawler output, real metadata-image emission, prerender, Nginx/browser handoffs and release/rollback identity remain pending. DOM tests record document-navigation methods and inspect effective styling; they do not establish HTTP handoffs or pixel layout.

Website/application route ownership, withheld pricing and demo publication states remain unchanged. Commit and push each verified batch promptly and keep this checkpoint small.
