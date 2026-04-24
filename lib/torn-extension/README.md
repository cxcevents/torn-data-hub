# Torn Vitals — Chrome Extension

A small Chrome extension that puts your live Torn.com vitals in the browser toolbar (the icon itself becomes a 4-bar gauge of Energy / Nerve / Happy / Life), plus a customizable popup dashboard with cooldowns, travel, wallet, and alerts.

## Install (developer / unpacked)

1. Open `chrome://extensions` in Chrome (or any Chromium browser: Edge, Brave, Arc).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select this folder: `lib/torn-extension`.
5. Pin the extension from the puzzle-piece menu so the icon stays visible.
6. Click the icon → **Open settings** → paste your Torn API key (Limited Access is fine).

The toolbar icon will refresh every 30 seconds with your current vitals as 4 stacked bars.

## Features

- **Live toolbar icon** — Energy / Nerve / Happy / Life as 4 stacked bars, redrawn every 30s.
- **Configurable badge** — show energy current, unread messages, unread events, or off.
- **Customizable popup** — toggle and reorder which panels appear:
  - Vitals (with per-bar tick countdown)
  - Cooldowns (Drug / Medical / Booster)
  - Travel (only shown when in transit)
  - Wallet (cash / bank / vault / cayman / points)
  - Alerts (Messages / Events / Awards / Comps — clickable, deep-link to Torn)
  - Education (only shown when a course is active)
- **Footer link** — opens the full hosted dashboard in a new tab.
- **Settings sync** — your API key, badge mode, and panel choices sync across Chrome installs via `chrome.storage.sync`.

## Files

- `manifest.json` — Manifest V3 declaration.
- `background.js` — Service worker. Polls the Torn API on a 30s alarm, draws the icon, updates the badge, and serves cached snapshots to the popup.
- `popup.html` / `popup.js` / `popup.css` — Toolbar popup UI.
- `options.html` / `options.js` / `options.css` — Settings page (API key, badge mode, panel order).
- `icons/` — Initial PNG icons. Replaced at runtime by the live vitals drawing.

## Permissions

- `storage` — to save your API key and preferences.
- `alarms` — to schedule the 30-second poll.
- `host_permissions: https://api.torn.com/*` — only the Torn API. The extension does not run on torn.com pages and does not read or modify them.

## Updating

Edit any file, then in `chrome://extensions` click the **reload** button on the Torn Vitals card.
