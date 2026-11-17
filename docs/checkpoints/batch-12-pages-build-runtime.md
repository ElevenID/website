# Batch 12: educational pages, build inputs and public runtime

This milestone is grouped in [website PR #12](https://github.com/ElevenID/website/pull/12), starting from accepted PR #11 at `57adcea498bb77935bdbd08ca49654eea44db878`.

It preserves the remaining three bounded educational page candidates and a small generated schema, together with three generation/build/startup scripts. Component and build fixtures qualify their behavior without importing large production data, the blog package or diagram bodies. The complete production website remains a later milestone.

## Source preservation

All **seven imports, totaling 45,628 bytes**, were preserved before adaptation. Every source file is below 16 KiB. Their Git blobs match both the immutable source pin `df6ec6c4bfee803d89c54e9333297f29f378cee3` and comparison source main `9ff6e9779a020839ebeafc60095370725e9fb694`.

| Source and target path | Bytes | Original Git blob |
| --- | ---: | --- |
| `ui/src/components/IdentityGuidePage.jsx` | 11,013 | `f3e9104a7d4b242b11359a83da80a88560c75cc4` |
| `ui/src/components/ProtocolPage.jsx` | 16,232 | `42e1d3b5e32aaefb2e44d371602839f0c1baa580` |
| `ui/src/components/StandardsPage.jsx` | 9,764 | `0fcbf958eeaa57e8e0f52c77bdbef08ec388be26` |
| `ui/src/generated/demoWalletSchema.generated.json` | 1,836 | `58dd81b135c281707185927a6c48de599e100bf9` |
| `ui/scripts/generate-demo-manifest-module.mjs` | 2,723 | `8cdf1d9ea21f37a60e2a24c69b7df9d9faeae76e` |
| `ui/scripts/build-web-surface.mjs` | 1,769 | `7ffefb9d6109b12fc39d6b89accfbc358f656d03` |
| `scripts/ui-production-start.sh` | 2,291 | `3916bc1f2b446f893bc63c35418466b80603bdd8` |

The [batch provenance shard](../../contracts/extraction-provenance-batch-12.json) extends [batch 11](../../contracts/extraction-provenance-batch-11.json), retaining one verbatim schema and six explicitly adapted sources. Earlier provenance targets remain unchanged; the complete provenance chain contains **86 targets**. The two new [extraction checks](../../tests/extraction-batch-12.test.mjs) verify the bounded shard, target blob identities and recorded adapted byte counts; actual adapted outputs must also stay below 16 KiB. The earlier 67 original-shard targets and 12 batch 11 targets remain unchanged.

The [metadata refresh](../input-inventory/source-refresh-batch-12.json) confirms unchanged UI/contracts trees and separately verifies the selected root startup script at both revisions. Source modes are 100644, including the startup script. Prior reconciliation and adaptations remain authoritative.

The original [79-file candidate inventory](../source-import-inventory.json) now has **61 present and 18 deferred**. This is a different set from the 86 provenance targets: the candidate inventory describes the original website module closure, while provenance also records build and other extracted files. The remaining 18 candidates comprise ten large inputs/page/service/catalog bodies and eight diagram modules or their barrel.

## Educational page behavior

[Identity/standards cases](../../tests/dom/identity-standards-pages.test.jsx) and [protocol cases](../../tests/dom/protocol-page.test.jsx) execute the actual pages, metadata helpers, React, MUI, Router and translation implementation.

The adaptations address these concrete behaviors:

- **Layout and typography:** eight Grid declarations use the installed `size` API. Twenty-nine direct Typography weights and 15 direct alignment properties move into `sx`, retaining their values, other styles and heading gutters.
- **Shared blog data:** chapter articles are sorted in a copied array. Rendering supports frozen imported arrays and preserves the original array identity and order.
- **Accessible navigation:** article rows become native anchors with a real `href`. Ordinary, uncancelled primary clicks retain the existing `useSurfaceNavigate` helper; alternate activation and cancelled events keep native behavior. `publicEntryHref` preserves configured DNS destinations from a public IP entry. A synthetic unexpected slug also verifies that application destinations retain a document handoff.
- **Chapter availability:** empty or unindexed chapters disable their start action. Article counts use singular/plural labels. The fixed-zero progress indicator is removed because the page has no learner-progress state.
- **Existing contracts:** canonical and structured metadata, translation fallback, draft/standards qualifications, safe external repository/specification links, website CTAs and diagram props remain intact.

The [education content boundary plugin](../../tests/fixtures/education-content-boundaries.mjs) intercepts only exact reviewed importer/specifier pairs. [Three native boundary cases](../../tests/education-content-boundaries.test.mjs) exercise rejection of unexpected inputs and confirm that other callers remain unaffected. The pre-existing route and marketing-section fixture boundaries remain separate.

The new DOM scope is **41 cases**: 17 identity/standards cases and 24 protocol cases. The final original-source comparison passed 25 and failed 16 in 7.58 seconds. These are failing regression cases across related behaviors, not 16 independent production incidents. After adaptation, the complete native/DOM/build aggregate passed **482 records** in 61.39 seconds: 61 native, 345 DOM across 24 files and 76 build, with no failures, cancellations or skips.

One intermediate corrected run had 61 passing native records and 344 passing DOM records with one DOM failure. The failure was an overly narrow gutter expectation: the test expected 11.2px while the rendered result was 16.8px. The test now derives the gutter from `0.35 × effective font size`; page source was unchanged by that test correction. The 41-case original-source comparison was rerun with the same final assertions, producing the 25/16 result above.

### Runtime limits

Small independently authored marketing/blog inputs replace the deferred production data. Named diagram markers preserve the component boundary without loading SVG or diagram implementations. Tests exercise metadata, link semantics, router transitions and recorded final document-load calls; they do not qualify actual browser navigation, production marketing copy, the immutable blog package or complete page composition.

## Generated demo inputs and build execution

The [generator cases](../../tests/build/demo-generation.test.mjs) cover release identity, projection consistency, generated-output freshness and data preservation with small synthetic inputs.

The adapted generator:

- Rejects duplicate or path-unsafe release identities, mismatched manifest identities and latest pointers that do not name a listed release.
- Requires a usable wallet-schema projection and keeps the committed small schema available when the original projection source is absent.
- Rejects symlinked paths and non-file generated targets, validating inputs and output kinds before creating replacements.
- Preserves JSON semantics, including a literal `__proto__` key, through generated-module execution.
- Supports `--check` without rewriting output and writes completed files through unique temporary paths followed by rename.

Each rename is atomic for one file. The schema/module pair is not a filesystem transaction, and these checks do not claim recovery from every possible I/O failure. Synthetic fixtures preserve DRAFT/PARTIAL publication states; no production manifest was read or regenerated.

The [website runner cases](../../tests/build/website-build-runner.test.mjs) execute the actual runner and Vite CLI. The runner accepts only the website surface, requires an exact source identity or explicit development mode, checks complete build prerequisites before starting stages, rejects stale generated artifacts, propagates stage failures and removes the application-pruning dependency.

**The TypeScript stage is instrumented in these fixtures.** They establish invocation, arguments, environment and failure ordering; they do not establish production type-check success. The runner still requires the complete production configuration, generated inputs and dependencies and rejects an incomplete extraction. This milestone does not make the full production build available.

The original generator/runner comparison ran **28 cases: 10 passed and 18 failed**, in 3.94 seconds (exit 1). The original startup script is not executed: it has fixed global output paths and a secrets-loader dependency. Startup behavior is exercised only after the explicit website adaptation.

## Public runtime startup

[Startup cases](../../tests/build/website-runtime-config.test.mjs) execute the actual shell script against a synthetic HTML tree. The script writes runtime configuration at the website-owned `/_website/runtime-config.js` path and uses only named public settings. When the generated script executes, it merges its public values into any `window.__MARTY_RUNTIME_CONFIG__` already initialized by the page, preserving that in-memory hosting configuration. It replaces analytics/registration values, escapes verification metadata and removes stale managed values on restart. It no longer sources the application secrets loader.

Preflight rejects invalid settings, symlinked roots/resource paths, non-file runtime destinations and destinations outside the owned namespace before modifying artifacts. HTML traversal preserves names containing spaces or newlines and does not follow file or directory symlinks. The tested metadata forms include mixed tag casing, quote variants, unquoted managed names and an unrelated `data-name` attribute that must remain untouched.

This is support for the tested **single-line generated metadata forms**, not a general HTML parser. Per-file replacement does not make changes across the entire HTML corpus transactional. Full production output and container startup still need acceptance together.

The focused adapted build suite passed **46 of 46 cases** in 4.28 seconds: 16 generator, 12 runner and 18 startup cases, with no failures, cancellations or skips.

## Execution and revision receipt

| Checkpoint | Evidence |
| --- | --- |
| Source preservation | 438 native/DOM/build records passed: 58 native + 304 DOM + 76 build, in 54.03 seconds |
| Source checkpoint HTTP | 20 separate records passed in 0.92 seconds; 458 combined records |
| Source checkpoint hosted CI | [Required Website contracts job passed](https://github.com/ElevenID/website/actions/runs/44009299256/job/133792151996) |
| Original educational-page comparison | 41 cases: 25 passed, 16 failed, in 7.58 seconds (exit 1); three native boundary cases passed |
| Corrected educational-page aggregate | 482 native/DOM/build records passed: 61 native + 345 DOM across 24 files + 76 build, in 61.39 seconds; no failures, cancellations or skips |
| Educational-page hosted CI | [Required Website contracts job passed](https://github.com/ElevenID/website/actions/runs/44010150926/job/133794951739) |
| Original generator/runner comparison | 28 cases: 10 passed, 18 failed, in 3.94 seconds (exit 1); original startup not executed |
| Focused adapted build suite | 46 of 46 cases passed in 4.28 seconds; no failures, cancellations or skips |
| Final native/DOM/build aggregate | 528 records passed: 61 native + 345 DOM across 24 files + 122 build, in 64.77 seconds; no failures, cancellations or skips |
| Final separate HTTP suite | 20 records passed in 0.77 seconds; no failures, cancellations or skips |
| Final dependency audit | Zero vulnerabilities at every severity and in total (exit 0), in 0.37 seconds |
| Whitespace and documentation links | Full PR whitespace and all 44 relative documentation links passed |

**Final accounting:** 61 native + 345 DOM across 24 files + 122 build = **528 passing records** for `npm test`, plus 20 passing separate HTTP records = **548 combined**, with no failures, cancellations or skips. This adds **92 records** to batch 11.

The existing crawler wrapper executes **five Python unittest cases**. They are reported separately without adding them again to the aggregate record total.

| Revision | Identity |
| --- | --- |
| Accepted base, PR #11 | `57adcea498bb77935bdbd08ca49654eea44db878` |
| Exact source-copy commit | `5cc954693cb4de0ac3938a1f0871d68d1a0e47ab` |
| Exact source-copy tree | `c03207086ede15bf72698cdabab1dd82a3147a22` |
| Corrected educational-page commit | `dbc26e6e059a9a4de8a6d072b22571ec8bc83180` |
| Corrected educational-page tree | `c383b62a87ecd6d7e43374e387e6eef1597633cf` |
| Corrected functional commit | `6e76d883132773b11a2b694438a7a53d34a619cc` |
| Verified functional tree | `ba71d9f93cf9812e5db77a9cd4e82d406df466b2` |

Independent static review verified source identities, adaptation manifests, route-handoff preservation, strict fixture boundaries, generator fidelity, build-stage limits and startup behavior. Track the final documentation revision, required hosted checks and accepted merge on [PR #12](https://github.com/ElevenID/website/pull/12).

## Next work

Resume from the [compact checkpoint](../migration-status.md). The remaining original candidate files are all large inputs or diagram-related modules under the current reading constraint. Further bounded build/release work can continue while those imports remain deferred.

The immutable blog dependency, production assets, complete crawler/prerender output, real browser/application handoffs and production release/rollback acceptance remain open. Existing Nginx evidence uses synthetic content; replay it against the complete production output before deployment acceptance. Preserve website/application ownership, withheld pricing, the reconciled verification CTA and demo publication states. Production cutover is a later milestone.
