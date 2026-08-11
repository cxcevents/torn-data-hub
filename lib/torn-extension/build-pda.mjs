#!/usr/bin/env node
/**
 * Build the TornPDA userscript from the Chrome extension sources.
 * Wraps content.js with a chrome.storage shim (localStorage-backed),
 * injects styles.css, and seeds the API key from TornPDA's ###PDA-APIKEY###.
 *
 * Usage: node build-pda.mjs
 * Output: torn-data-hub.pda.user.js
 */
import { readFileSync, writeFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("chrome-extension/manifest.json", "utf8"));
const content = readFileSync("chrome-extension/content.js", "utf8");
const css = readFileSync("chrome-extension/styles.css", "utf8");

const header = `// ==UserScript==
// @name         Torn Data Hub
// @namespace    https://github.com/cxcevents/torn-data-hub
// @version      ${manifest.version}
// @description  ${manifest.description}
// @author       cxcevents
// @match        https://www.torn.com/*
// @run-at       document-end
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/cxcevents/torn-data-hub/main/lib/torn-extension/torn-data-hub.pda.user.js
// @updateURL    https://raw.githubusercontent.com/cxcevents/torn-data-hub/main/lib/torn-extension/torn-data-hub.pda.user.js
// ==/UserScript==
`;

const shim = `
(function () {
  "use strict";
  if (window.__TDH_PDA_LOADED__) return;
  window.__TDH_PDA_LOADED__ = true;

  // ── chrome.storage.local shim backed by localStorage ──
  var STORE_PREFIX = "tdh_pda_";
  function readKey(k) {
    try {
      var raw = localStorage.getItem(STORE_PREFIX + k);
      return raw === null ? undefined : JSON.parse(raw);
    } catch (e) { return undefined; }
  }
  var chrome = {
    storage: {
      local: {
        get: function (keys, cb) {
          var out = {};
          var list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || {});
          list.forEach(function (k) {
            var v = readKey(k);
            if (v !== undefined) out[k] = v;
          });
          setTimeout(function () { cb(out); }, 0);
        },
        set: function (obj, cb) {
          Object.keys(obj).forEach(function (k) {
            try { localStorage.setItem(STORE_PREFIX + k, JSON.stringify(obj[k])); } catch (e) {}
          });
          if (cb) setTimeout(cb, 0);
        },
      },
    },
  };

  // ── Seed API key from TornPDA (token is replaced by the app) ──
  var pdaKey = "###PDA-APIKEY###";
  if (pdaKey && pdaKey.indexOf("###") === -1 && readKey("tdh_api_key") === undefined) {
    try { localStorage.setItem(STORE_PREFIX + "tdh_api_key", JSON.stringify(pdaKey)); } catch (e) {}
  }

  // ── Inject extension styles ──
  function injectCss() {
    if (document.getElementById("tdh-pda-styles")) return;
    var el = document.createElement("style");
    el.id = "tdh-pda-styles";
    el.textContent = __TDH_CSS__;
    (document.head || document.documentElement).appendChild(el);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectCss);
  } else {
    injectCss();
  }

  // ── Original extension content script (unmodified) ──
__TDH_CONTENT__
})();
`;

const out =
  header +
  shim
    .replace("__TDH_CSS__", JSON.stringify(css))
    .replace("__TDH_CONTENT__", content);

writeFileSync("torn-data-hub.pda.user.js", out);
console.log(`Built torn-data-hub.pda.user.js (v${manifest.version}, ${(out.length / 1024).toFixed(0)} KB)`);
