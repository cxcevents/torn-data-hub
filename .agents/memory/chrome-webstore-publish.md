---
name: Chrome Web Store publishing
description: How to push new extension versions to the Chrome Web Store automatically
---

# Chrome Web Store publishing

Automated via `lib/torn-extension/publish-webstore.mjs` (`node publish-webstore.mjs ship <zip>`), using secrets `CWS_CLIENT_ID` / `CWS_CLIENT_SECRET` / `CWS_REFRESH_TOKEN` (user's Google OAuth client + refresh token, scope `chromewebstore`).

**Quirks learned:**
- Zip upload must go to `https://www.googleapis.com/upload/chromewebstore/v1.1/items/<id>` — the non-`/upload/` path returns a JSON parse error.
- Manifest `description` must be ≤132 characters or upload fails with `PKG_MANIFEST_SUMMARY_TOO_LONG`.
- `status` command (projection=DRAFT) shows the published `crxVersion` — useful to check store vs repo drift.
- Publishing returns `OK` but Google still runs review before the new version goes live/auto-updates.

**How to apply:** ship-workflow for extension releases now includes `node publish-webstore.mjs ship <new zip>` after building the zip; no manual dashboard upload needed.
