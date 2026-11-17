# PR 13 follow-up: complete asset migration and browser qualification

This checkpoint continues [PR #13](https://github.com/ElevenID/website/pull/13). The accepted main remains `c586c1ca2800f181594ffd03c5045fd3b93f76fb`; the PR stays draft. Its earlier source/bundle receipt is [preserved](batch-13-complete-source-bundle.md).

## Published functional checkpoints

| Commit | Change |
| --- | --- |
| `0777f9c77632076aaa37ce13a9c6d22ee5a51ec3` | Correct root-level asset import; preflight all source and destination files; no-clobber publication; strict resource verification and 24 regression tests |
| `09a9d11ffe4fde70dfe3cb86aee99fd264a0567c` | Separate read-only full-asset migration and Chrome rendering fixture |
| `1db43c264a1d949cde0403d2681dd22a84c299d9` | Fix doubled immutable prefixes in actual Vite entry/preload URLs; verify each executable HTML reference resolves to an emitted file |
| `37f592b0fcbb7e410bc3fde919eebebca3ed8aa0` | Correct the browser fixture's demo canonical expectation to the selected version and retain the draft publication disclaimer |

Functional tree: `18dbcff459847a41f82c20bc2f1d43033c31f610`. The documentation checkpoint changes no executable files.

## Import and verification corrections

The old importer rejected `favicon.svg` because it required the destination parent to be a child of the public directory, excluding the public directory itself. The replacement accepts that valid root parent and walks all intermediate directories without following symlinks.

All eight source entries and destination conflicts are checked before any output file is created. Git tree mode, blob identity and byte count are bound to the immutable source commit. Source working-tree modifications do not substitute for pinned Git objects. Existing identical assets are verified without rewriting timestamps. Existing different files, dangling links, hard links and unsafe parents fail closed. Publishing uses a temporary file and a no-clobber hard-link operation, with cleanup; this is individually atomic publication, not a transaction across the complete asset set.

The verifier now rejects unclassified asset categories and checks both the reconciled English marketing locale hash and its exact **10,539-byte** size. It checks intermediate directories as well as leaf files. These tools assume an operator-owned workspace, not an adversarial process racing filesystem changes.

The 24 new cases use actual temporary Git repositories and cover root/nested assets, source integrity, repeat import, late conflicts, unsafe paths, symlink/hard-link custody, missing assets and explicit reconciliation. All 24 also passed locally under Node 22.16.0; hosted CI uses the required Node 24.22.1.

## Executed complete-asset fixture

The separate [migration qualification job](https://github.com/ElevenID/website/actions/runs/44149436307/job/134273368119) passed at functional head `37f592b0fcbb7e410bc3fde919eebebca3ed8aa0`.

It obtains only the pinned source snapshot `ElevenID/marty-ui@df6ec6c4bfee803d89c54e9333297f29f378cee3` as a temporary migration input. Its token is read-only and credentials are not persisted. It then:

1. Imports eight exact original blobs totaling **16,574,562 bytes** and verifies **46/46** selected public resources.
2. Replays the import with **zero writes and eight existing verified files**, then verifies **46/46** again.
3. Removes the temporary source checkout before dependency installation and the independent website build.
4. Runs `npm ci`, the real TypeScript/Vite development build and the strengthened bundle smoke. The build transforms **1,147 modules**, emits **66 JavaScript chunks**, and verifies **37 executable entry/preload resources** resolve to emitted files.
5. Executes actual headless Chrome against an isolated loopback server and the real emitted module graph.

The browser fixture covers `/`, `/product`, `/standards`, `/protocol`, `/demos` and `/blog`. It requires `app-rendered`, completed startup, an actual page heading, the expected canonical, no captured browser exception, and no missing same-origin resource request. The demo canonical follows the existing approved-or-available selection; the current available release remains **2026.08.0, DRAFT/PARTIAL** and displays its publication-preview disclaimer.

It also clicks the real `/verify` CTA and observes a new HTTP document request reaching a separate application sentinel document. This qualifies the website's document-navigation boundary against a fixture, not a deployed application, authentication flow or credential issuance.

### Browser-discovered startup regression

The first Chrome run failed because Vite applied `/_website/development/` as both `base` and the prefix within `assetsDir`. Script/preload requests therefore contained the prefix twice and returned 404. Keeping the site base `/` and retaining the immutable prefix in `assetsDir` corrected actual loading. The old substring-only build smoke missed this failure; it now parses and verifies every script and modulepreload resource path.

The following failed run preserves the original browser evidence: [44148021847](https://github.com/ElevenID/website/actions/runs/44148021847/job/134268360248). After that correction, the fixture's unversioned `/demos` canonical expectation failed; production behavior was intentionally retained and the expectation was corrected from the emitted demo index.

## Existing required validation

The independent [Website contracts job](https://github.com/ElevenID/website/actions/runs/44149436306/job/134273369969) passed all its stages on the same functional head, including clean dependency installation, contracts/DOM/build tests, the pinned Nginx HTTP suite and the real standalone development build. This job never checks out `marty-ui`.

The regression suite adds **24 cases** to the preceding 552-record suite: 65 native, 345 DOM, 146 build and 20 Nginx records, **576 total**. The five nested Python cases are not added again. The full-asset import checks, six Chrome page checks and document handoff are separate qualification evidence, not added to that test-record count.

## Persistence and remaining gates

**The website repository still contains 38 of the 46 selected public asset files.** The eight large original assets have now been transferred and verified in an ephemeral CI workspace, but have not been committed to the destination repository. A green migration fixture is not evidence of persisted source completeness.

Interactive access to the existing AWS development instance was unavailable in this session. No AWS workload, instance size, timer, security policy or production deployment was changed or reverified. The existing rootless Docker and automatic-stop safeguards remain requirements for the next AWS run.

Next, run the corrected importer on the existing development instance (or another explicitly authorized Git-capable workspace), verify 46/46, and commit the exact eight assets with their source receipt. Do not add download-on-build behavior or broaden workflow token permissions to hide this missing persistence step.

Then complete production prerender/crawler output for the full route set, replay Nginx against that output, qualify live application handoffs, and finish image publication, repository/workflow/run provenance, platform intake and retained-slot rollback. Current browser coverage is six default-config routes, not the entire site; external fonts/services are blocked in the fixture. No visual-layout, authenticated-app, complete production SEO or release acceptance is claimed. No production cutover.
