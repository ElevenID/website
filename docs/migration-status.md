# Migration checkpoint — full-asset production qualification

Continue [website PR #13](https://github.com/ElevenID/website/pull/13), branch `feat/complete-website-source-graph`. It remains **draft**. Accepted main is still `c586c1ca2800f181594ffd03c5045fd3b93f76fb`; no production cutover.

## Current state

- All **79/79** original source candidates are committed.
- All **46/46** selected public assets are now committed. The eight large assets total **16,574,562 bytes** and were persisted from immutable marty-ui commit `df6ec6c4bfee803d89c54e9333297f29f378cee3` at website commit `8ad4b340a4ec7e325e72bb8adfa00492b0bd966b`.
- The complete migration fixture previously verified 46/46 assets, idempotent replay with zero writes, 1,147 transformed modules, 66 JavaScript chunks, and 37 executable references.
- Real Chrome smoke coverage and the isolated `/verify` application-boundary fixture pass.
- Production prerender now exercises the full generated route plan. The first complete run found one route-specific readiness-signal gap on `/security` after the page itself rendered correctly; see [Batch 14](checkpoints/batch-14-production-prerender.md).
- The readiness harness is being hardened with an explicit `app-ready` fallback that still requires no loading marker and a real heading, and records the readiness source per route.
- The temporary large-asset persistence workflow has been removed after successful asset persistence. Direct push qualification is enabled for this migration branch.

## Next gates

1. Pass the full production prerender with the readiness fallback.
2. Pass pinned Nginx against the complete production output.
3. Verify sitemap, robots, canonical/OG/Twitter metadata, JSON-LD, immutable assets and draft-demo disclaimers from the final output.
4. Qualify the real application-owned handoff separately; current handoff testing remains an isolated fixture.
5. Define digest-pinned image/provenance publication and retained-slot rollback without touching production traffic.

AWS interactive execution was not available in this session. The large-file/SVG restriction is therefore bypassed through a pinned GitHub Actions source checkout that writes the exact source blobs directly into the branch; no asset contents were transferred through the chat context.

Do not merge or publish this as production until all gates pass.
