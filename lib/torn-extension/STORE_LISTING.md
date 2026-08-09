# Chrome Web Store Listing — Torn Data Hub

Everything you need to publish. Upload `torn-data-hub-extension.zip` (built from
`chrome-extension/`, Manifest V3, v3.1.0).

## Step-by-step: publishing

1. Go to https://chrome.google.com/webstore/devconsole and sign in with a Google
   account. Pay the one-time **$5 developer registration fee** if you haven't.
2. Click **+ New item** and upload `lib/torn-extension/torn-data-hub-extension.zip`.
3. Fill in the **Store listing** tab with the text below and upload the
   screenshot(s) from `store-assets/` (1280×800 PNG).
4. In **Privacy practices**, use the justifications below, link a privacy policy
   (text provided below — host it anywhere public, e.g. a GitHub gist), and
   declare that remote code is NOT used.
5. In **Distribution**, choose Public (or Unlisted if you only want link-sharing).
6. Click **Submit for review**. First reviews typically take a few business days.

To ship an update later: bump `"version"` in `manifest.json`, rebuild the zip
(`cd chrome-extension && zip -r ../torn-data-hub-extension.zip .`), and upload a
new package on the same item. Chrome auto-updates all users.

## Store listing text

**Name:** Torn Data Hub

**Summary (max 132 chars):**
Live Torn.com overlays — daily Xanax tracker, refill status, and effective battle stats, right on your Torn homepage.

**Description:**
Torn Data Hub adds a compact, live-updating panel to your Torn.com homepage:

★ Xanax tracker — see how many Xanax you've taken today (vs. your daily goal) plus a live drug-cooldown countdown.
★ Refills — instant view of which daily refills (Energy / Nerve / Casino tokens) you've used, with one-click links to use the rest.
★ Effective battle stats — your battle stats with active modifiers applied, injected right into the Battle Stats card.
★ Toolbar popup — Energy, Nerve, Happy, and Life bars plus drug cooldown at a glance, from any tab.

Setup takes 10 seconds: click the toolbar icon, paste your Torn API key (a Limited Access key is fine), done. Data refreshes automatically every 2 minutes.

Privacy: your API key is stored locally in your browser and used only to call the official Torn API (api.torn.com). Nothing is sent anywhere else — no analytics, no third-party servers.

This extension is fan-made and is not affiliated with or endorsed by Torn.

**Category:** Tools (or Fun)
**Language:** English

## Privacy practices tab

- **Single purpose:** Displays the user's own Torn.com game stats (Xanax use,
  refills, battle stats) as overlays on torn.com and in a toolbar popup.
- **storage justification:** Stores the user's Torn API key locally so they
  don't have to re-enter it.
- **host permission (api.torn.com) justification:** Fetches the user's own game
  data from the official Torn API; this is the extension's sole data source.
- **content script (www.torn.com) justification:** Injects the stats panel into
  the user's Torn homepage.
- **Remote code:** No, extension does not use remote code.
- **Data usage:** collects "Website content" is NOT collected; the API key is
  personal auth info that never leaves the device — check "does not sell or
  transfer data", "not for unrelated purposes", "not for creditworthiness".

## Privacy policy (host publicly, paste the URL in the dashboard)

> **Torn Data Hub — Privacy Policy**
> Torn Data Hub stores your Torn API key locally in your browser
> (chrome.storage.local). It is used exclusively to request your own game data
> from the official Torn API (https://api.torn.com). The extension collects no
> analytics, sets no cookies, and transmits no data to any server other than
> api.torn.com. Removing the extension deletes the stored key.

## Assets

- Icon: `chrome-extension/icons/icon128.png` (128×128, required) — auto-taken from the zip.
- Screenshots: `store-assets/` — at least one 1280×800 PNG is required.
