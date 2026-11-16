# Batch 6: navigation and runtime helpers

Work is tracked in [website PR #6](https://github.com/ElevenID/website/pull/6), based on accepted main `c4d3e03c97e892a846716fc753d3b4949af1893b`.

## Source extraction and correction

Six unchanged helpers were copied with original paths and Git blob identities: `appHandoff`, `publicEntry`, `landingEntry`, `webSurface`, `safeNavigation` and `runtimeConfig`. Their total is **10,491 bytes**; every blob matches both the pinned source snapshot and comparison revision `e10a7f26cda8ac217c7ddefebc709fc246dabaff`.

A separate adaptation corrects `getLandingAuthError`. Its caller supplies React Router's `URLSearchParams`, whose `get()` result is already decoded. A second percent decode could throw on literal or malformed percent sequences and altered encoded text; replacing plus signs corrupted literal pluses. The helper now returns that decoded value unchanged while retaining missing/empty-to-null behavior.

The original helper remains recoverable from the extraction commit. Its provenance moves to `adapted_files`; the other five new helpers remain verbatim. Two tests adapt earlier landing/runtime behavioral cases with exact source-test identities recorded; the navigation harness and tests are independently authored.

| Checkpoint | Commit |
| --- | --- |
| Verbatim source extraction | `b577df9ec58d4d6f19fa6786941c9646616b77c5` |
| Correction and focused tests | `8b021b03dd7b117e81984f06d5aa371573a12431` |
| AWS-tested source tree | `c0f63b5c27089a940455473b8dc453051973506a` |

## Verification on AWS

The preserved Node.js **24.22.1** runtime on the existing development instance ran:

- The existing **24 tests**, passing after verbatim extraction.
- The expanded suite before the fix: **45 passed, 4 failed**. Each failure reproduced a distinct landing-error decoding defect.
- The corrected suite: **49 passed, 0 failed, 0 cancelled, 0 skipped**.
- Whitespace checks for both staged changes and the entire PR, passing.

The existing six-hour automatic-stop timer was active. No new infrastructure or dependency installation was needed. The following documentation checkpoint does not change source or tests; see PR #6 for its final head, required hosted check and merge receipt.

## Coverage and limits

| Test group | Count | Scope |
| --- | ---: | --- |
| Existing contracts/build/metadata | 24 | Retained route, source, asset and metadata checks |
| Navigation | 9 | Actual route JSON, surface/console transitions, safe destinations, exact aliases, query/hash retention, redirect method selection and loop prevention |
| Landing | 8 | Error text, nonmutating query clearing and loading/authentication decisions |
| Runtime configuration | 8 | Hosting, section gates, malformed sections, organization/analytics/admin precedence and build fallbacks |

The VM harness evaluates eight actual JavaScript modules and the actual route-contract JSON. It limits each source read to 16 KB and permits only the declared dependencies. A URL-backed location fixture records redirect calls; these tests do not perform browser navigation or render React.

Runtime section gating and website/application route ownership are separate contracts. `/verify` remains application-owned, while `/verification` remains website-owned. The application verification page and backend are outside this extraction.

## Resume

The next bounded slice is the React `useSurfaceNavigate` hook and `WebSurfaceBoundary`, with inherited tests and a real React/DOM environment. Actual modified-click behavior, browser handoffs, emitted assets, full Vite build, prerender, Nginx and release production remain unqualified.

The five changed CTA source files and English marketing locale remain reconciled candidates for later import. No public assets were copied, and no full large source, SVG/binary, lockfile or large generated-module contents were read.

The active migration checkpoint is now short. Its previous contents are retained unchanged beside it as `migration-history-through-batch-5.md`, preserving historical receipts and relative links.
