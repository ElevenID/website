# Migration checkpoint — published website and signed composition

## Current continuation checkpoint

Refreshed November 19, 2026 (America/Denver): standalone signed website publication and authenticated cross-owner composition are complete. Application source packaging and actual application/OIDC and isolated-host acceptance remain separate work. The historical milestones below retain their original source-specific evidence.

### Accepted composition selection

The original [publisher run `44449706828`, attempt 2](https://github.com/ElevenID/website/actions/runs/44449706828/attempts/2) succeeded from protected-main source `7ec0707aa348939a0e48e6a26b24fb1af8671b9b` after the registry credential correction in [PR #16](https://github.com/ElevenID/website/pull/16). Its original artifact is `web-website-44449706828-2`, ID `14495945528`. The preceding attempt did not complete and is not the selected release.

The successful [composition run `44594894023`, attempt 1](https://github.com/ElevenID/marty-ui/actions/runs/44594894023/attempts/1), on `marty-ui` source `6daf2a216fbc6e16472a06977b21f33896f372f5`, authenticated those original website proofs together with application run `42385654811/1` and its selected backend `v1.1.273`. It signed and uploaded `web-composition-44594894023-1`, artifact ID `14564688078`. The [consumer checkpoint](https://github.com/ElevenID/marty-ui/blob/main/docs/restructuring/website-composition-checkpoint.md) records the exact source, archive, proof and composition identities.

These remain the accepted composition inputs. The composition records `runtime_tested: false` and `billing_journey_tested: false`; signing and intake do not establish host or authenticated-journey success.

### Newer website publication

The inspected website `main` source is `79f7d60f737ead799ca33c5b91bc349c7e5df419`. It includes merged [PR #17](https://github.com/ElevenID/website/pull/17), which filters retired provider demos, and [PR #18](https://github.com/ElevenID/website/pull/18), which returns HTTP 410 for their retired permalinks. Its [main CI](https://github.com/ElevenID/website/actions/runs/44671843297), [standalone qualification](https://github.com/ElevenID/website/actions/runs/44671843247) and [protected-main publisher `44671855574/1`](https://github.com/ElevenID/website/actions/runs/44671855574/attempts/1) all completed successfully.

GitHub reports the latest original artifact as `web-website-44671855574-1`, ID `14600337685`, with 22,756 archive bytes and SHA-256 `70905ab6fb9a0ffdb5147fe54f8aafee24f2f4a2a5838bffa5c411bc9927ef7e`. This refresh checked run and artifact metadata; it did not independently download or cryptographically reverify this newest archive. Its successful publication does not replace the older release pinned by the accepted composition.

## Historical milestone 16 acceptance

Milestone 16 is merged in both repositories: [website PR #14](https://github.com/ElevenID/website/pull/14) at `aac683df865e6adec1d250bf1b9621e204f6675d` and [marty-ui PR #1997](https://github.com/ElevenID/marty-ui/pull/1997) at `983cc226ba4b11defc6f10d01404e52200e34bea`. Website [main CI](https://github.com/ElevenID/website/actions/runs/44412287658) and [standalone qualification](https://github.com/ElevenID/website/actions/runs/44412288659) passed. The consumer's final required merge-group [CI](https://github.com/ElevenID/marty-ui/actions/runs/44431689631) and [Helm](https://github.com/ElevenID/marty-ui/actions/runs/44431689706) passed before its normal squash-queue merge. Refresh current PR and Actions results before continuing from this checkpoint.

## Recovered November 18 checkpoint

- All **79/79** original source candidates and **46/46** selected public assets are committed. The eight large assets total **16,574,562 bytes**, imported from immutable marty-ui source `df6ec6c4bfee803d89c54e9333297f29f378cee3` at website commit `8ad4b340a4ec7e325e72bb8adfa00492b0bd966b`.
- The last chat's final head, `1ba942da211d3cf236369d45427c0e7205a4794f`, finished successfully after its checkpoint was written: [Website CI](https://github.com/ElevenID/website/actions/runs/44265461081) and [migration qualification](https://github.com/ElevenID/website/actions/runs/44265460945).
- That historical qualification checked 257 routes, 253 canonical URLs, 46 assets, a local image built from a pinned Nginx base, 57 HTTP resource checks and 19 denied application/private paths. Its application handoff was an isolated fixture.
- The architecture plan [marty-ui #1969](https://github.com/ElevenID/marty-ui/pull/1969) and initial installer-consumer extraction [platform #1](https://github.com/ElevenID/platform/pull/1) are merged. Neither establishes standalone website release admission or a complete platform installer.

## Batch 15 changes

Review found gaps not covered by the earlier green run. The current qualification now:

1. Includes `/privacy`, `/terms`, `/verification`, `/issuance` and `/blog/foundations`, bringing the plan to **262 routes / 254 canonical paths**. Every rendered and HTTP-served route must match its own canonical identity, so a homepage fallback cannot pass as another page.
2. Rejects caught React error pages and remaining loading markers. Readiness fallback becomes eligible only after 25 seconds; normal `app-rendered` evidence takes precedence. Behavioral tests exercise errors, loaders, demo settlement and the signal/fallback race.
3. Builds on a fresh runner that never checks out `marty-ui`. Exact source-asset replay remains a separate migration audit.
4. Requires a clean checkout matching the claimed source SHA and records four successful stages against the same final distribution bytes. Nginx starts the exact inspected local image ID.
5. Uploads a bounded `web-qualification-RUN-ATTEMPT` artifact with per-file hashes, input identities, workflow context and stage receipts. These are explicitly unsigned qualification records, not production intake evidence.
6. Commits the existing demo generator's normalized output. The previous import retained an older serialization that the first build rewrote; the generated exports now match every committed JSON input without dirtying the checkout. Original blob identity remains in the extraction history and the adaptation receipt.

See [qualification procedure and evidence](standalone-qualification.md). The authoritative acceptance result is the associated **Website contracts**, **Migration asset provenance** and **Standalone production qualification** checks on the final source head.

## Source merge versus release activation

The approved [independent release plan](https://github.com/ElevenID/marty-ui/blob/main/docs/independent-website-release.md#first-cutover) separates reviewed source changes from subsequent protected-main signing and live-host qualification. The earlier Batch 14 wording conflated those gates. Merge this extraction milestone only after review and exact-head source/build/contract/browser/HTTP checks pass. A source merge does not publish or activate a website image.

## Milestone 16 — standalone producer contract

This batch defines closed v2 website build-plan, release and image contracts for `ElevenID/website`, its reserved `.github/workflows/production-website-release.yml` publisher identity and `ghcr.io/elevenid/website`. The plan binds eleven source input hashes, the clean exact source, the final output inventory, public routes, public-only pages, a pinned Nginx base and the inspected Linux amd64 image platform. The qualification workflow now verifies that it can construct this plan from the same fully qualified output. Its evidence remains unsigned.

The coordinated `marty-ui` consumer changes admit this identity only for website receipts and its own image. Application, backend and outer composition authorities stay with their existing producers. Legacy public/private v1 receipts remain supported, and the optional composition website owner defaults to `ElevenID/marty-ui`. Shared synthetic fixtures verify cross-language canonical hashing; role, original-evidence, composition and retained-slot tests cover the new boundary. See the [standalone release contract](standalone-release-contract.md).

Milestone 16 reserved the publisher identity without installing or invoking it. A v2 object or the qualified local Docker image ID cannot replace original cryptographic proof and a registry manifest digest.

## Milestone 17 — protected-main publisher source

The new [publication workflow](standalone-publication.md) accepts a manual dispatch naming an exact protected-main source. It repeats the website-only qualification, publishes that same local image, fetches and hashes the raw registry manifest with pinned ORAS, and verifies its configuration, platform, RootFS and immutable repository identity after a digest pull. It rechecks clean source and all qualified bytes before creating the v2 release subject.

The workflow signs and attests the receipt and image with pinned tools and actions. It retains the original bundles verbatim and runs the consumer-equivalent checks in isolated anonymous verifier environments. Only a successful proof check can upload the exact five-file `web-website-RUN-ATTEMPT` artifact. A current publisher run cannot assert that its own Actions attempt has completed successfully; subsequent original-artifact intake supplies that gate.

The source and offline negative tests established the implementation. The subsequent successful protected-main publication and original signed intake are recorded in the current checkpoint above; a source merge or passing unsigned qualification alone did not establish those operational results. Tool-copy and proof-policy adaptation lineage is recorded in `contracts/extraction-provenance-batch-24.json` against the merged consumer source.

## Next development milestone

Continue the independent application work in [marty-ui PR #2004](https://github.com/ElevenID/marty-ui/pull/2004) and its [continuation plan](https://github.com/ElevenID/marty-ui/blob/main/docs/restructuring/README.md). The next development boundary is a portable application source archive with a fresh consumer installation, build, tests and runtime qualification outside the original checkout. Keep the accepted composition inputs pinned while that work proceeds.

Actual application/OIDC handoff, isolated-host promotion, retained-slot rollback and recovery remain open. The separately scoped website read credential remains confined to website Actions intake; application and composition work retain their existing job-token scope. Only after the remaining source and release acceptance gates pass should `marty-ui` become `application`.

This checkpoint records completed publication and signed composition, without claiming production activation. Production traffic, private commerce, source deletion and repository renaming remain outside this documentation update.
