// ==UserScript==
// @name         Torn Data Hub — Header Overlay
// @namespace    https://github.com/cxcevents/torn-data-hub
// @version      1.2.0
// @description  Shows Xanax and Refills cards overlaid in the Torn header while you browse torn.com
// @author       Torn Data Hub
// @match        https://www.torn.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // ─── Constants ───────────────────────────────────────────────────────────────
  const POLL_MS        = 2 * 60 * 1000;   // 2 min refresh
  const XANAX_CD_MAX   = 6 * 3600;        // 6-hour xanax cooldown (seconds)
  const STORAGE_KEY    = "torn_api_key";   // matches dashboard localStorage key
  const XAN_HIST_KEY   = "torn_xanax_tracker_v1";  // matches dashboard
  const XAN_GOAL       = 3;               // default daily goal

  // ─── Styles ──────────────────────────────────────────────────────────────────
  GM_addStyle(`
    #tdh-overlay {
      position: fixed;
      top: 0;
      right: 0;
      z-index: 99999;
      display: flex;
      align-items: stretch;
      gap: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11px;
      user-select: none;
      box-shadow: 0 2px 12px rgba(0,0,0,0.55);
    }

    /* ── card base ── */
    .tdh-card {
      background: #141414;
      border-bottom: 1px solid #2a2a2a;
      padding: 5px 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 140px;
      cursor: default;
      border-right: 1px solid #2a2a2a;
      transition: background 0.15s;
    }
    .tdh-card:hover { background: #1c1c1c; }
    .tdh-card:last-child { border-right: none; }

    /* ── card label ── */
    .tdh-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #666;
      white-space: nowrap;
    }

    /* ── xanax card ── */
    #tdh-xanax { border-left: 2px solid #8b5cf6; }
    .tdh-xan-count {
      font-size: 20px;
      font-weight: 900;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    .tdh-xan-count.green  { color: #4ade80; }
    .tdh-xan-count.amber  { color: #fbbf24; }
    .tdh-xan-count.orange { color: #fb923c; }
    .tdh-xan-count.dim    { color: #555; }
    .tdh-xan-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .tdh-xan-goal {
      color: #999;
      font-size: 10px;
      font-weight: 600;
    }
    .tdh-xan-cd {
      font-size: 9px;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .tdh-xan-cd.ready  { color: #4ade80; animation: tdh-pulse 1.2s ease-in-out infinite; }
    .tdh-xan-cd.active { color: #a78bfa; }

    /* ── refills card ── */
    #tdh-refills { border-left: 2px solid #3b82f6; min-width: 160px; }
    .tdh-refill-pills {
      display: flex;
      gap: 4px;
    }
    .tdh-pill {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 3px 7px;
      border-radius: 3px;
      border: 1px solid transparent;
      text-decoration: none;
      white-space: nowrap;
      transition: opacity 0.15s;
    }
    .tdh-pill.available.energy {
      background: rgba(34,197,94,0.15);
      border-color: rgba(34,197,94,0.35);
      color: #4ade80;
      box-shadow: 0 0 8px rgba(34,197,94,0.2);
      animation: tdh-pulse 1.6s ease-in-out infinite;
    }
    .tdh-pill.available.nerve {
      background: rgba(239,68,68,0.15);
      border-color: rgba(239,68,68,0.35);
      color: #f87171;
      box-shadow: 0 0 8px rgba(239,68,68,0.2);
      animation: tdh-pulse 1.6s ease-in-out infinite;
    }
    .tdh-pill.available.casino {
      background: rgba(161,161,170,0.12);
      border-color: rgba(161,161,170,0.3);
      color: #d4d4d8;
    }
    .tdh-pill.used {
      background: transparent;
      border-color: rgba(255,255,255,0.07);
      color: #3f3f3f;
      text-decoration: line-through;
    }

    /* ── dismiss / setup button ── */
    #tdh-dismiss {
      background: #141414;
      border: none;
      border-left: 1px solid #2a2a2a;
      border-bottom: 1px solid #2a2a2a;
      color: #444;
      font-size: 10px;
      padding: 0 8px;
      cursor: pointer;
      transition: color 0.15s;
    }
    #tdh-dismiss:hover { color: #999; }

    /* ── setup banner ── */
    #tdh-setup {
      background: #141414;
      border-bottom: 1px solid #2a2a2a;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #888;
      font-size: 11px;
    }
    #tdh-setup input {
      background: #222;
      border: 1px solid #333;
      border-radius: 3px;
      color: #ccc;
      font-size: 11px;
      padding: 3px 7px;
      width: 180px;
      outline: none;
    }
    #tdh-setup input:focus { border-color: #8b5cf6; }
    #tdh-setup button {
      background: #8b5cf6;
      border: none;
      border-radius: 3px;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      cursor: pointer;
    }

    /* ── error state ── */
    .tdh-error {
      color: #ef4444;
      font-size: 10px;
      padding: 6px 10px;
      background: #141414;
      border-bottom: 1px solid #2a2a2a;
    }

    @keyframes tdh-pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.5; }
    }
  `);

  // ─── State ───────────────────────────────────────────────────────────────────
  let apiKey      = getKey();
  let lastData    = null;
  let pollTimer   = null;
  let tickTimer   = null;
  let fetchedAt   = null;   // Date.now() of last successful fetch
  let overlayEl   = null;

  // ─── Key helpers — mirrors dashboard's localStorage key ───────────────────────
  function getKey() {
    // Prefer same-origin localStorage (dashboard sets it), fall back to GM storage
    try {
      const k = localStorage.getItem(STORAGE_KEY);
      if (k) return k;
    } catch (_) {}
    return GM_getValue(STORAGE_KEY, "");
  }

  function saveKey(k) {
    try { localStorage.setItem(STORAGE_KEY, k); } catch (_) {}
    GM_setValue(STORAGE_KEY, k);
    apiKey = k;
  }

  // ─── Xanax today count (delta from localStorage history) ─────────────────────
  function getXanaxToday(xantakenTotal) {
    try {
      const raw   = localStorage.getItem(XAN_HIST_KEY);
      const hist  = raw ? JSON.parse(raw) : {};
      const today = todayStr();
      const dates = Object.keys(hist).sort();
      const prev  = dates.filter((d) => d < today).pop();
      if (prev === undefined) return null;
      return Math.max(0, (xantakenTotal ?? 0) - hist[prev]);
    } catch (_) {
      return null;
    }
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function pad(n) { return String(n).padStart(2, "0"); }

  // ─── Time format ─────────────────────────────────────────────────────────────
  function fmtTime(s) {
    if (s <= 0) return "0s";
    const h  = Math.floor(s / 3600);
    const m  = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${ss}s`;
    return `${ss}s`;
  }

  // ─── API fetch ───────────────────────────────────────────────────────────────
  async function fetchData() {
    if (!apiKey) return;
    try {
      const url  = `https://api.torn.com/user/?selections=cooldowns,refills,personalstats&key=${apiKey}&comment=TDH-overlay`;
      const res  = await fetch(url);
      const json = await res.json();
      if (json.error) {
        renderError(`API: ${json.error.error}`);
        return;
      }
      lastData  = json;
      fetchedAt = Date.now();
      renderCards();
    } catch (e) {
      renderError("Network error");
    }
  }

  function schedulePoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(fetchData, POLL_MS);
  }

  function startTick() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      if (lastData) renderCards();
    }, 1000);
  }

  // ─── DOM: build overlay shell ────────────────────────────────────────────────
  function buildOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement("div");
    overlayEl.id = "tdh-overlay";
    document.body.appendChild(overlayEl);
  }

  // ─── Render: setup banner ────────────────────────────────────────────────────
  function renderSetup() {
    buildOverlay();
    overlayEl.innerHTML = `
      <div id="tdh-setup">
        <span>Torn Data Hub — enter API key:</span>
        <input id="tdh-key-input" type="password" placeholder="Your Torn API key" />
        <button id="tdh-key-save">Save</button>
      </div>
    `;
    const input = overlayEl.querySelector("#tdh-key-input");
    overlayEl.querySelector("#tdh-key-save").addEventListener("click", () => {
      const k = input.value.trim();
      if (!k) return;
      saveKey(k);
      overlayEl.innerHTML = "";
      fetchData();
      schedulePoll();
      startTick();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") overlayEl.querySelector("#tdh-key-save").click();
    });
  }

  // ─── Render: error ───────────────────────────────────────────────────────────
  function renderError(msg) {
    buildOverlay();
    overlayEl.innerHTML = `<div class="tdh-error">⚠ ${msg}</div>`;
  }

  // ─── Render: main cards ───────────────────────────────────────────────────────
  function renderCards() {
    if (!lastData) return;
    buildOverlay();

    const elapsed   = fetchedAt ? Math.floor((Date.now() - fetchedAt) / 1000) : 0;

    // ── Xanax ──
    const rawCd     = lastData.cooldowns?.drug ?? 0;
    const cdLeft    = Math.max(0, rawCd - elapsed);
    const cdPct     = XANAX_CD_MAX > 0 ? Math.min(100, ((XANAX_CD_MAX - cdLeft) / XANAX_CD_MAX) * 100) : 0;
    const cdReady   = rawCd > 0 && cdLeft === 0;
    const hasCd     = rawCd > 0;

    const xanTotal  = lastData.personalstats?.xantaken;
    const todayXan  = getXanaxToday(xanTotal);  // null if no history
    const xanCount  = todayXan ?? 0;
    const metGoal   = xanCount >= XAN_GOAL;

    const countCls  = metGoal         ? "green"
                    : xanCount >= 2   ? "amber"
                    : xanCount >= 1   ? "orange"
                    : "dim";

    const cdLabel   = !hasCd       ? '<span class="tdh-xan-cd" style="color:#444">No drug taken</span>'
                    : cdReady      ? '<span class="tdh-xan-cd ready">Ready</span>'
                    : `<span class="tdh-xan-cd active">${fmtTime(cdLeft)}</span>`;

    const goalLabel = todayXan !== null
      ? `${xanCount} / ${XAN_GOAL} today`
      : `— / ${XAN_GOAL} today`;

    // ── Refills ──
    const refills   = lastData.refills ?? {};
    const energyUsed  = refills.energy_refill_used  ?? true;
    const nerveUsed   = refills.nerve_refill_used   ?? true;
    const casinoUsed  = refills.token_refill_used   ?? true;

    function pill(label, used, type) {
      const cls = used ? "used" : `available ${type}`;
      return `<a class="tdh-pill ${cls}" href="https://www.torn.com/points.php" title="${used ? "Used" : "Available!"}">${label}</a>`;
    }

    overlayEl.innerHTML = `
      <div class="tdh-card" id="tdh-xanax">
        <span class="tdh-xan-count ${countCls}">${todayXan !== null ? xanCount : "—"}</span>
        <div class="tdh-xan-meta">
          <span class="tdh-label">Xanax</span>
          <span class="tdh-xan-goal">${goalLabel}</span>
          ${cdLabel}
        </div>
      </div>
      <div class="tdh-card" id="tdh-refills">
        <div class="tdh-xan-meta">
          <span class="tdh-label">Refills</span>
          <div class="tdh-refill-pills">
            ${pill("Energy", energyUsed, "energy")}
            ${pill("Nerve",  nerveUsed,  "nerve")}
            ${pill("Casino", casinoUsed, "casino")}
          </div>
        </div>
      </div>
      <button id="tdh-dismiss" title="Hide overlay">✕</button>
    `;

    overlayEl.querySelector("#tdh-dismiss").addEventListener("click", () => {
      overlayEl.style.display = "none";
      if (pollTimer) clearInterval(pollTimer);
      if (tickTimer) clearInterval(tickTimer);
    });
  }

  // ─── Boot ────────────────────────────────────────────────────────────────────
  function init() {
    apiKey = getKey();
    buildOverlay();

    if (!apiKey) {
      renderSetup();
      return;
    }

    fetchData();
    schedulePoll();
    startTick();
  }

  // Wait for body to be ready, then go
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
