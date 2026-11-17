# Batch 9: page, catalog, demo and composition foundations

Work is grouped in [website PR #9](https://github.com/ElevenID/website/pull/9), based on accepted main `fd5288e14660b4d296c70bee13b8a9182064a5d2`. The source-copy baseline, expanded red evidence and corrected **272-test AWS aggregate** are verified. Track final required CI, merge and accepted-main synchronization on that PR.

## Source imports and dependency boundaries

Source-copy commit `33fac865efe571130cafeeb136de00ad89cba20c`, tree `785ef758b0c5a6d4de10dea83c19c5f503afbdf5`, preserves **12 files totaling 46,957 bytes** before the reviewed corrections:

| Group | Files under `ui/src/` | Count | Bytes |
| --- | --- | ---: | ---: |
| Page and catalog view | `components/FromIDVPage.jsx`; `components/pages/ProtocolSupportCatalogView.jsx` | 2 | 19,466 |
| Demo formatting and playback component | `application/verifier/verifierDemoFlow.js`; `components/landing/proofLabRuntime.js`; `components/demos/DemoVideoPlayer.jsx` | 3 | 12,024 |
| Catalog and public commerce helpers | `application/protocolSupportCatalog.js`; `extensions/commerce/publicStub.jsx`; `extensions/commerce/website.js` | 3 | 3,542 |
| Composition foundations with deferred imports | `website.jsx`; `apps/website/WebsiteApp.jsx`; `apps/website/WebsiteRoutes.jsx`; `variants/marketingRoutes.jsx` | 4 | 11,925 |
| **Total** | | **12** | **46,957** |

The first three groups provide **eight closed fixture inputs totaling 35,032 bytes**. The commerce entry uses an explicit alias to the checked-in public stub inside the fixture. That alias does not configure a production website build. The four composition files retain their real imports; their large or absent dependencies remain deferred.

Eleven initial copies match immutable source pin `df6ec6c4bfee803d89c54e9333297f29f378cee3`. WebsiteApp deliberately uses the previously reconciled current source:

| WebsiteApp provenance | Git blob |
| --- | --- |
| Original immutable-pin blob | `51789b621ae64442135789314c7857ff393a6cf0` |
| Reconciled and copied current blob | `bb9616ba5618cac9899b4c487487b687a1caa51c` |

The current blob preserves `Start Verifying` and its `/verify` target, along with existing public-entry handoffs. [Extraction provenance](../../contracts/extraction-provenance.json) retains the original source identity and distinguishes reconciliation from later functional adaptations.

Source main was refreshed and still resolves to `a4fc3801b636e2cfd0753797e8fc0dc846b42a22`. The existing [79-source-plus-locale receipt](../input-inventory/source-refresh-batch-8.json) therefore remains applicable: 74 source blobs match the original pin; five sources and the locale match their recorded reconciliation decisions. This batch does not rewrite that history or claim a fresh audit of the other public assets.

## Environment and test scope

No new package dependency or production build configuration is introduced. Node **24.22.1**, npm **11.19.1** and the exact pins from [batch 8](batch-8-runtime-pages-build.md) remain the environment. At the source-copy revision, `package.json` is blob `31a89c1ed12abc6f48562b144109c6e423602adb`; the unchanged 105,449-byte lock is blob `cc06f8ce81a58d54215ab8c03e07b3114f0d89d5`. Lock identity was checked as metadata; the lock body was not read.

The expanded suites exercise:

- **FromIDV:** Actual React/MUI rendering, article/breadcrumb metadata, public navigation, application document handoff and the real branding provider at a controlled fetch boundary.
- **Catalog:** The actual normalizer and view with small synthetic fixtures, support/qualification distinctions, unsupported surface restrictions, path summaries, escaped text and layout. The positive fixtures follow the small source schema; these tests do not import the production catalog or claim full JSON Schema validation.
- **Demo helpers:** Deterministic request/presentation formatting, caller-owned audience constraints, explicit verification-result state and isolated scenario claims. These helpers do not perform cryptographic verification.
- **Demo player:** Consent, publication states, scenario/revision/recording changes and chapter behavior. No remote video, production poster or manifest is loaded.
- **Website shell:** Real WebsiteApp, router, branding, chrome and surface boundary with WebsiteRoutes replaced by a small page boundary. Translation uses local in-memory resources; analytics is controlled. This protects the reconciled CTA, login return, tabs, aliases and error fallback without claiming full route composition.

The actual Vite fixture expands from ten to **eighteen source inputs**, adding all eight closed inputs above. It uses real modules, installed MUI/Emotion and the existing icon resolver. A guard checks repository source size before loading and excludes SVG, deferred website composition, services, large catalog/manifest imports and excluded application and blog packages. The fixture verifies loaded modules and physically emitted chunks. It replaces the existing page-bundle case, so the build suite remains eleven records; the existing small asset-emission fixtures remain.

## Reviewed correction scope

AWS reproduced the targeted failures before correction. After applying the reviewed changes, the full suite passed with 272 tests.

- **Catalog revision:** Require a primitive string before applying the revision pattern, rejecting JSON arrays that otherwise coerce to a valid-looking revision.
- **Verifier/demo results:** Require explicit boolean `true` for success; select only own scenario keys before the retail fallback; copy the scalar disclosure claims so editing one generated presentation cannot alter later demos.
- **FromIDV styling:** Preserve two Grid breakpoint maps, eleven source heading-weight declarations, six text alignments and the checklist font size with supported MUI props. Remove eight obsolete paragraph flags, adding six fixed 16px margins while retaining both existing `mb: 3` overrides. Normalize eight inherited trailing-whitespace lines; content, routes and metadata remain intact.
- **Catalog/player styling:** Preserve catalog card sizing, chip wrapping, block metadata and aligned card headers; retain the demo unavailable-message weight and alignment.
- **Earlier educational pages:** Preserve the intended spacing for five remaining paragraph declarations across four previously imported pages.

Independent static reviews cover the source identities, test fixtures and exact UI transformations. The AWS red runs reproduced one native revision-coercion failure and 39 DOM failures: FromIDV compatibility (26), catalog styling (4), earlier paragraph spacing (4), verifier/demo isolation (3) and demo-player styling (2). All five website-shell cases and all six FromIDV behavior cases passed. One intermediate green attempt exposed a timing-sensitive assertion in the existing analytics fixture after all 40 targeted failures were corrected. The fixture now waits for observable metric registration before reading callbacks, while retaining the original second-call asynchronous drain and exact idempotence assertion. The installed-export guard and negative cases remain unchanged; production analytics code is unchanged. The isolated eight-case analytics run and subsequent full aggregate passed. Static reviews remain separate from executed validation.

## AWS verification and final gates

| Check | Observed result |
| --- | --- |
| Existing suite after the source-copy commit | **178 passed**: 49 native, 118 DOM, 11 build records |
| Expanded red regression evidence | Native: 53 passed / 1 failed of 54; DOM: 168 passed / 39 failed of 207 |
| Final expanded native tests | 54 passed |
| Final expanded DOM tests and file count | 207 passed across 19 files |
| Expanded build records before and after correction | 11 passed; fixture loaded 18 inputs / 37 repository sources / 323 bundled modules and emitted 1 chunk |
| **Expanded aggregate** | **272 passed; zero failures, cancellations or skips** |
| Fresh npm audit | Exit 0; zero vulnerabilities at every reported severity |
| Full PR whitespace check | Passed |
| Required hosted CI and final head | Track PR #9 for the final documentation revision |
| Merge and accepted-main AWS synchronization | Recorded on PR #9 after protected merge |

Corrected functional commit `2197809f17c92a27b3153bc3103cb174c00ffb2f` has tree `8fe0c90a703e154f2e313f892aba78fb8d1aa1e9`, exactly matching the AWS-tested staged tree. The full `npm test` run completed successfully in 31.81 seconds. The documentation follow-up requires its own final hosted check. Package, lockfile, Vitest configuration and CI workflow remain unchanged.

The existing AWS environment and automatic-stop policy remain the operating context. Final synchronization and timer status are recorded in the final PR receipt.

## Deferred scope

LegalPages (20,810 bytes), the production protocol catalog (21,034 bytes), marketing data (37,770 bytes), the manifest service (17,722 bytes), generated manifests and their larger page/diagram dependencies remain outside this import batch. The inspected small AI/landing candidates retain those dependencies and were not added as incomplete production features.

No upstream SVG/binary content or full large-source/upstream lock contents were read or imported for this batch. Full website composition, production assets, immutable blog integration, crawler output, real prerender, browser/Nginx handoffs and release/rollback production remain unqualified.

Resume from the compact [migration checkpoint](../migration-status.md). Original inventories and historical batch receipts remain unchanged.
