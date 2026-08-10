#!/usr/bin/env node
/**
 * Publish the Torn Data Hub extension to the Chrome Web Store.
 *
 * Usage:
 *   node publish-webstore.mjs status            — check current item status
 *   node publish-webstore.mjs upload <zip>      — upload a new zip as draft
 *   node publish-webstore.mjs publish           — publish the uploaded draft
 *   node publish-webstore.mjs ship <zip>        — upload + publish in one go
 *
 * Requires env: CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN
 */
import { readFileSync } from "node:fs";

const EXTENSION_ID = "jhnmhkifckfklnmacpedegggjaolfllg";

const { CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN } = process.env;
if (!CWS_CLIENT_ID || !CWS_CLIENT_SECRET || !CWS_REFRESH_TOKEN) {
  console.error("Missing CWS_CLIENT_ID / CWS_CLIENT_SECRET / CWS_REFRESH_TOKEN env vars.");
  process.exit(1);
}

async function getAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CWS_CLIENT_ID,
      client_secret: CWS_CLIENT_SECRET,
      refresh_token: CWS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    console.error("Failed to get access token:", JSON.stringify(data));
    process.exit(1);
  }
  return data.access_token;
}

async function api(token, method, path, body, contentType) {
  const res = await fetch(`https://www.googleapis.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "x-goog-api-version": "2",
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

const cmd = process.argv[2];
const zipPath = process.argv[3];
const token = await getAccessToken();

async function status() {
  const r = await api(token, "GET", `/chromewebstore/v1.1/items/${EXTENSION_ID}?projection=DRAFT`);
  console.log("Status:", r.status, JSON.stringify(r.json, null, 2));
  return r;
}

async function upload(zip) {
  if (!zip) { console.error("Provide path to zip."); process.exit(1); }
  const buf = readFileSync(zip);
  console.log(`Uploading ${zip} (${(buf.length / 1024).toFixed(0)} KB)…`);
  const r = await api(token, "PUT", `/upload/chromewebstore/v1.1/items/${EXTENSION_ID}`, buf, "application/zip");
  console.log("Upload:", r.status, JSON.stringify(r.json, null, 2));
  if (r.json.uploadState !== "SUCCESS") process.exit(1);
}

async function publish() {
  const r = await api(token, "POST", `/chromewebstore/v1.1/items/${EXTENSION_ID}/publish`);
  console.log("Publish:", r.status, JSON.stringify(r.json, null, 2));
  const ok = (r.json.status || []).includes("OK") || (r.json.status || []).includes("ITEM_PENDING_REVIEW");
  if (!ok) process.exit(1);
}

if (cmd === "status") await status();
else if (cmd === "upload") await upload(zipPath);
else if (cmd === "publish") await publish();
else if (cmd === "ship") { await upload(zipPath); await publish(); }
else { console.error("Unknown command. Use: status | upload <zip> | publish | ship <zip>"); process.exit(1); }
