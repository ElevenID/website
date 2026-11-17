# Batch 8: runtime, public pages and fixture builds

Work is grouped in [website PR #8](https://github.com/ElevenID/website/pull/8), based on accepted main `8d473beb3971d09da07a36eaeb11faf3e9081a78`. Track final required CI and merge status on that PR.

## Source batches and provenance

Two source-copy commits preserve **24 files totaling 71,274 bytes** before adaptation: nine runtime files (17,213 bytes) and fifteen page/shared-component files (54,061 bytes). Their original blobs match source pin `df6ec6c4bfee803d89c54e9333297f29f378cee3` and comparison `a4fc3801b636e2cfd0753797e8fc0dc846b42a22`.

The runtime group contains the two public-config variants, i18n initialization, font waiting, prerender readiness, branding context/hook, bootstrapRoot and analytics. The UI group contains ten bounded public pages plus FutureFeatureButton, PublicFooter, LanguageSwitcher, WebSectionUnavailable and LandingSection. These copies do not constitute full WebsiteApp/WebsiteRoutes composition.

[Extraction provenance](../../contracts/extraction-provenance.json) records each original identity and adaptation. The initial copies remain recoverable in commits `47406784` and `fb748b4a`. Twenty-five inherited trailing-whitespace lines were normalized with provenance: i18n (12), BrandingContext (2), useBranding (4), analytics (7). BrandingContext and useBranding have whitespace-only adaptations.

The [metadata refresh receipt](../input-inventory/source-refresh-batch-8.json) checks all 79 source candidates plus the reconciled English locale. Seventy-four source blobs still match the original pin; five source blobs and the locale match their recorded reconciliation decisions. There are no missing paths or unexpected differences. This does not refresh the other public assets or execute the complete source graph.

## Exact dependency environment

Nine direct pins were added to the existing environment and verified against npm on AWS:

| Package | Exact version |
| --- | --- |
| `@mui/material` | `9.4.0` |
| `@mui/icons-material` | `9.3.0` |
| `@emotion/react` | `11.14.0` |
| `@emotion/styled` | `11.14.1` |
| `i18next` | `26.5.7` |
| `i18next-browser-languagedetector` | `8.2.1` |
| `i18next-http-backend` | `4.0.4` |
| `react-i18next` | `17.0.12` |
| `web-vitals` | `6.2.3` |

Node **24.22.1** and npm **11.19.1** remain the validation runtime. The expanded destination lock is 105,449 bytes, Git blob `cc06f8ce81a58d54215ab8c03e07b3114f0d89d5`, SHA-256 `866df6bd0f7e23acb45949fe97f1d4c52d399cb1b661e7431713923189e64573`. It records 205 dependency package entries; 173 packages were installed on AWS Linux. Clean `npm ci` and `npm ls` succeeded. The lock was updated and transferred as a machine-managed, hash-verified artifact; the full upstream lock was not read or copied.

The reusable icon resolver preserves source `ui/vite.config.ts` blob `c5b2000bb311da5b4a54f4b18236d6b2edb1ee49` behavior: icon `.js` to `.mjs` lookup and the trailing `Outline` to `Outlined` fallback. It was extracted from a bounded 15,091-byte excerpt of the 22,614-byte configuration. There is no Grid compatibility alias.

## Reproduced corrections

- **Analytics:** Four behavior assertions exposed one obsolete `onFID` API reference. The supported metric registrations remain CLS, FCP, INP, LCP and TTFB. Vitest's missing-export proxy stops earlier than native ESM would, so the four failures are not four distinct defects.
- **Translations:** One uppercase-formatting regression established that the existing formatter must use the supported i18next formatter plugin API. The formatter body and existing lowercase, Date and passthrough behavior are retained.
- **Readiness:** Five lifecycle failures exposed retained deadlines, observers or frames. Effect-owned resources now settle and dispose on completion, timeout or cleanup; abandoned pathname/query effects cannot dispatch stale readiness. The 10-second translation deadline, 15-second demo deadline, two frames and separate bounded font wait remain.
- **Responsive Grid:** Six page failures exposed missing effective sizing. Fifteen opening tags now express the original breakpoint values through `size`.
- **Typography:** Twelve computed-weight failures exposed ignored direct `fontWeight` props. Thirty-nine values moved into `sx`, preserving existing style fields and content.

Independent exact-diff reviews confirmed the Grid and typography edits, and independent runtime/build reviews found no blocking issue. Tests execute actual React, Router, MUI, URL helpers and controlled DOM lifecycle behavior. Fixtures control translation/network boundaries where necessary; navigation fixtures record terminal document-loading methods.

## Verification on AWS

| Check | Result |
| --- | --- |
| Native contracts/helpers | 49 passed |
| React/DOM suites | 118 passed across 13 files |
| Node build-test records | 11 passed |
| **Total** | **178 passed; zero failures, cancellations or skips** |
| Clean dependency installation and `npm ls` | Passed |
| Separate `npm audit --json` | Exit 0; zero findings at every reported severity |
| Full PR whitespace check | Passed |

Build records comprise three resolver cases, an asset-build parent with six subtests, and one ten-page bundle case. Real Vite builds use tiny synthetic public assets/locales/blog fixtures and the actual asset plugin, preserving its relative public-root lookup. The page fixture bundles all ten actual pages with MUI/Emotion and a legacy icon path. These are executed fixture builds, not a complete production website build.

Runtime correction commit `d9e870a86a1509769c85d61e10024e1785516a69` passed 136 tests before adding the final UI suites. UI correction commit `789ac14f44eea03e1803a79c9a079bffe8bd8e62` passed the full 178-test aggregate on AWS; its published tree exactly matched the tested tree `4cede259ed4c9eb36fc8a3a144f9fa9267cbc927`. [Functional-revision CI](https://github.com/ElevenID/website/actions/runs/43987357077) also succeeded. Documentation-only follow-up commits require their own final hosted check, tracked on PR #8.

## Remaining work and limits

The existing AWS environment was retained. Final accepted-main synchronization and automatic-stop status are recorded on the PR.

No upstream SVG/binary assets were imported, and no full large-source or upstream lock contents were read. This milestone does not qualify the production asset corpus, full WebsiteApp/WebsiteRoutes entry graph, immutable blog integration, generated crawler inputs, actual prerender execution, Nginx/browser handoffs or release/rollback production.

Resume from the short [migration checkpoint](../migration-status.md). Earlier batch receipts remain unchanged.
