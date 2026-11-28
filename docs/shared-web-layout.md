# Shared web header source

The website's `AppHeader` React adapter delegates structure and default branding
to `ui/src/shared/web-layout/header.mjs`. The canonical owner is
`ElevenID/marty-ui`; its application, Keycloak theme generator and Supabase static
auth build use that same general source. `header.css` contains only namespaced
header styling. Existing website language/login actions remain React children.

This repository keeps an exact, content-addressed snapshot so the website
build remains standalone and offline. `source.json` pins all three shared source
files by SHA-256; `verifyHeaderSource` rejects drift before Vite development or
build. `contracts/shared-web-header-adaptation.json` records the canonical owner,
revision, prior website source and the adapted consumer files, preserving the
earlier extraction receipts. The source import should also record the reviewed
protected canonical commit in `canonical_source.commit`.

To update it, first qualify the general source in `ElevenID/marty-ui` and run
`node scripts/sync-web-layout.mjs` there. Import `header.mjs`, `header.css`,
`verify-source.mjs` and `source.json` together, and use the same `AppHeader.jsx`
adapter. Update the adaptation receipt with the new exact hashes and canonical
commit, then run the website contract, DOM and production-build checks. Do not
maintain independent header markup or update this snapshot at runtime.

The DOM regression checks preserve default **ElevenID LLC** branding, escaped
custom brand text, deployment color/logo overrides and existing login actions.
The snapshot contract also proves modified shared files are rejected before a
new website build. The website retains its existing independent release owner.
