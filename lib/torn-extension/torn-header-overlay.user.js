// ==UserScript==
// @name         Torn Data Hub — Home Overlay
// @namespace    https://github.com/cxcevents/torn-data-hub
// @version      2.5.0
// @description  Injects Xanax, Refills, and Effective Battle Stats cards around the Battle Stats card on the Torn homepage, styled to match Torn Data Hub dashboard
// @author       Torn Data Hub
// @match        https://www.torn.com/index.php
// @updateURL    https://raw.githubusercontent.com/cxcevents/torn-data-hub/main/lib/torn-extension/torn-header-overlay.user.js
// @downloadURL  https://raw.githubusercontent.com/cxcevents/torn-data-hub/main/lib/torn-extension/torn-header-overlay.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // ─── Constants ───────────────────────────────────────────────────────────────
  const POLL_MS      = 2 * 60 * 1000;  // 2 min refresh
  const XANAX_CD_MAX = 6 * 3600;       // 6-hour xanax cooldown (seconds)
  const KEY_STORE    = "tdh_api_key";
  const XAN_GOAL     = 3;              // daily goal (matches dashboard)

  // ─── Styles — matches Torn Data Hub dashboard (dark card, crimson accent) ────
  GM_addStyle(`
    #tdh-panel {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      font-family: Arial, sans-serif;
    }
    .tdh-card {
      flex: 1;
      background: #191919;
      border: 1px solid #333;
      border-radius: 5px;
      overflow: hidden;
      min-width: 0;
    }
    .tdh-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      background: linear-gradient(180deg, #222 0%, #1a1a1a 100%);
      border-bottom: 1px solid #333;
    }
    .tdh-card-title {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #888;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tdh-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: #dc2626;
      display: inline-block;
    }
    .tdh-live {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(220,38,38,0.6);
    }
    .tdh-card-body { padding: 8px 10px; }

    /* ── xanax ── */
    .tdh-xan-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .tdh-xan-count {
      font-size: 24px;
      font-weight: 900;
      font-family: Consolas, Monaco, monospace;
      line-height: 1;
    }
    .tdh-xan-count .tdh-goal-frac {
      font-size: 12px;
      font-weight: 700;
      color: #777;
      font-family: Arial, sans-serif;
    }
    .tdh-c-green  { color: #4ade80; }
    .tdh-c-amber  { color: #fbbf24; }
    .tdh-c-orange { color: #fb923c; }
    .tdh-c-dim    { color: #666; }
    .tdh-badge {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 3px;
      border: 1px solid;
    }
    .tdh-badge.met {
      color: #4ade80;
      border-color: rgba(74,222,128,0.3);
      background: rgba(74,222,128,0.08);
    }
    .tdh-badge.togo {
      color: #888;
      border-color: #3a3a3a;
      background: #222;
    }
    .tdh-track {
      height: 5px;
      border-radius: 99px;
      background: #2a2a2a;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .tdh-fill {
      height: 100%;
      border-radius: 99px;
      transition: width 0.5s ease-out;
    }
    .tdh-fill.green  { background: #22c55e; }
    .tdh-fill.amber  { background: #fbbf24; }
    .tdh-fill.orange { background: #f97316; }
    .tdh-fill.red    { background: rgba(239,68,68,0.5); }
    .tdh-cd-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .tdh-cd-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #666;
    }
    .tdh-cd-val {
      font-size: 11px;
      font-weight: 700;
      font-family: Consolas, Monaco, monospace;
      color: #999;
    }
    .tdh-cd-val.ready {
      color: #4ade80;
      animation: tdh-blink 1s ease-in-out infinite;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 10px;
    }
    .tdh-fill.cd      { background: rgba(220,38,38,0.7); }
    .tdh-fill.cd-warm { background: #fbbf24; }
    .tdh-fill.cd-done { background: #22c55e; }

    /* ── refills ── */
    .tdh-refill-grid {
      display: flex;
      gap: 6px;
    }
    .tdh-refill {
      flex: 1;
      text-align: center;
      padding: 8px 4px;
      border-radius: 4px;
      border: 1px solid;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-decoration: none;
      display: block;
      cursor: pointer;
      transition: filter 0.15s;
    }
    .tdh-refill:hover { filter: brightness(1.25); }
    .tdh-refill.avail.energy {
      background: rgba(34,197,94,0.12);
      color: #4ade80;
      border-color: rgba(34,197,94,0.4);
      box-shadow: 0 0 10px rgba(34,197,94,0.25);
      animation: tdh-blink 1.6s ease-in-out infinite;
    }
    .tdh-refill.avail.nerve {
      background: rgba(239,68,68,0.12);
      color: #f87171;
      border-color: rgba(239,68,68,0.4);
      box-shadow: 0 0 10px rgba(239,68,68,0.25);
      animation: tdh-blink 1.6s ease-in-out infinite;
    }
    .tdh-refill.avail.casino {
      background: rgba(161,161,170,0.1);
      color: #d4d4d8;
      border-color: rgba(161,161,170,0.35);
    }
    .tdh-refill.used {
      background: #1f1f1f;
      color: #4a4a4a;
      border-color: #2e2e2e;
      text-decoration: line-through;
    }

    /* ── setup / error ── */
    .tdh-setup-body {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .tdh-setup-body input {
      flex: 1;
      background: #222;
      border: 1px solid #3a3a3a;
      border-radius: 3px;
      color: #ccc;
      font-size: 11px;
      padding: 5px 8px;
      outline: none;
      min-width: 0;
    }
    .tdh-setup-body input:focus { border-color: #dc2626; }
    .tdh-setup-body button {
      background: #dc2626;
      border: none;
      border-radius: 3px;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 5px 12px;
      cursor: pointer;
    }
    .tdh-setup-body button:hover { background: #b91c1c; }
    .tdh-error-text {
      color: #ef4444;
      font-size: 10px;
      padding: 4px 0;
    }

    /* ── effective battle stats ── */
    #tdh-eff {
      background: #191919;
      border: 1px solid #333;
      border-radius: 5px;
      overflow: hidden;
      margin-top: 10px;
      margin-bottom: 10px;
      font-family: Arial, sans-serif;
    }
    .tdh-eff-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 10px;
      border-bottom: 1px solid #262626;
    }
    .tdh-eff-row:last-child { border-bottom: none; }
    .tdh-eff-name {
      font-size: 11px;
      font-weight: 700;
      color: #aaa;
    }
    .tdh-eff-vals {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .tdh-eff-mod {
      font-size: 9px;
      font-weight: 700;
      font-family: Consolas, Monaco, monospace;
    }
    .tdh-eff-mod.pos { color: #4ade80; }
    .tdh-eff-mod.neg { color: #f87171; }
    .tdh-eff-mod.zero { color: #555; }
    .tdh-eff-val {
      font-size: 12px;
      font-weight: 700;
      font-family: Consolas, Monaco, monospace;
      color: #ddd;
      min-width: 110px;
      text-align: right;
    }
    .tdh-eff-row.total {
      background: #1f1f1f;
      border-top: 1px solid #333;
    }
    .tdh-eff-row.total .tdh-eff-name { color: #ddd; }
    .tdh-eff-row.total .tdh-eff-val { color: #4ade80; }

    @keyframes tdh-blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.45; }
    }
  `);

  // ─── State ───────────────────────────────────────────────────────────────────
  let apiKey    = GM_getValue(KEY_STORE, "");
  let lastData  = null;   // { cooldowns, refills }
  let xanToday  = null;   // number | null — from log API
  let fetchedAt = null;
  let panelEl   = null;
  let effEl     = null;
  let pollTimer = null;
  let tickTimer = null;

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function pad(n) { return String(n).padStart(2, "0"); }

  // TCT (Torn City Time) = UTC; Torn's daily reset runs on it.
  function todayStr() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  function fmtTime(s) {
    if (s <= 0) return "0s";
    const h  = Math.floor(s / 3600);
    const m  = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${ss}s`;
    return `${ss}s`;
  }

  // Midnight TCT (UTC), matching Torn's daily reset.
  function midnightUnix() {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }

  // ─── Find injection point: above the Battle Stats card ───────────────────────
  function findBattleStatsBox() {
    const titles = document.querySelectorAll("h5.box-title");
    for (const t of titles) {
      if (t.textContent.trim().toLowerCase() === "battle stats") {
        // Walk up to the outer widget wrapper Torn uses on the home page
        let el = t;
        for (let i = 0; i < 6 && el.parentElement; i++) {
          el = el.parentElement;
          const cls = el.className || "";
          if (typeof cls === "string" && /sortable|box-wrap|msg-wrap|column/i.test(cls)) {
            // stop before grabbing a whole column container
            if (/column/i.test(cls)) break;
            return el;
          }
        }
        // Fallback: two levels up from the title usually wraps the whole card
        return t.closest("div[class]")?.parentElement ?? t.parentElement;
      }
    }
    return null;
  }

  function mountPanel() {
    if (panelEl && document.contains(panelEl)) return true;
    const anchor = findBattleStatsBox();
    if (!anchor || !anchor.parentElement) return false;
    panelEl = document.createElement("div");
    panelEl.id = "tdh-panel";
    anchor.parentElement.insertBefore(panelEl, anchor);
    return true;
  }

  // ─── API calls ───────────────────────────────────────────────────────────────
  async function tornApi(selections, extra = "") {
    const url = `https://api.torn.com/user/?selections=${selections}${extra}&key=${apiKey}&comment=TDH-overlay`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) throw new Error(json.error.error);
    return json;
  }

  async function fetchMain() {
    if (!apiKey) return;
    try {
      lastData  = await tornApi("cooldowns,refills,battlestats");
      fetchedAt = Date.now();
      render();
      renderEff();
    } catch (e) {
      renderError(String(e.message || e));
    }
  }

  // Same source of truth as the dashboard: count xanax entries in the activity log
  async function fetchXanaxLog() {
    if (!apiKey) return;
    try {
      // Torn's log API caps at ~100 entries per call, so paginate back to midnight
      // TCT. Log record IDs (object keys) are unique; timestamps can repeat within
      // a second, so use inclusive `to=oldest` and dedupe by ID.
      const from = midnightUnix();
      const seen = new Set();
      let count = 0;
      let to = null;
      let prevOldest = Infinity;
      for (let page = 0; page < 10; page++) {
        // log=2290 = "Item use xanax" server-side filter (avoids the 100-entry all-types cap)
        const json    = await tornApi("log", `&log=2290&from=${from}${to !== null ? `&to=${to}` : ""}`);
        const entries = Object.entries(json.log ?? {});
        if (entries.length === 0) break;
        let added = 0;
        for (const [id, e] of entries) {
          if (seen.has(id)) continue;
          seen.add(id); added++;
          if (e.title && e.title.toLowerCase().includes("xanax")) count++;
        }
        const oldest = Math.min(...entries.map(([, e]) => e.timestamp));
        if (entries.length < 100 || oldest <= from) break;
        to = (added === 0 || oldest >= prevOldest) ? oldest - 1 : oldest;
        prevOldest = oldest;
      }
      xanToday = count;
      render();
    } catch (_) {
      // Log access may be blocked for limited keys — leave xanToday as null ("—")
    }
  }

  function refreshAll() {
    fetchMain();
    fetchXanaxLog();
  }

  // ─── Render: setup form ──────────────────────────────────────────────────────
  function renderSetup() {
    if (!mountPanel()) return;
    panelEl.innerHTML = `
      <div class="tdh-card">
        <div class="tdh-card-head">
          <span class="tdh-card-title"><span class="tdh-dot"></span>Torn Data Hub</span>
        </div>
        <div class="tdh-card-body">
          <div class="tdh-setup-body">
            <input id="tdh-key" type="password" placeholder="Enter your Torn API key (Limited Access or higher)" />
            <button id="tdh-save">Save</button>
          </div>
        </div>
      </div>
    `;
    const input = panelEl.querySelector("#tdh-key");
    const save  = () => {
      const k = input.value.trim();
      if (!k) return;
      GM_setValue(KEY_STORE, k);
      apiKey = k;
      refreshAll();
      schedule();
    };
    panelEl.querySelector("#tdh-save").addEventListener("click", save);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
  }

  // ─── Render: error ───────────────────────────────────────────────────────────
  function renderError(msg) {
    if (!mountPanel()) return;
    panelEl.innerHTML = `
      <div class="tdh-card">
        <div class="tdh-card-head">
          <span class="tdh-card-title"><span class="tdh-dot"></span>Torn Data Hub</span>
        </div>
        <div class="tdh-card-body">
          <div class="tdh-error-text">⚠ ${msg}</div>
        </div>
      </div>
    `;
  }

  // ─── Render: main cards ──────────────────────────────────────────────────────
  function render() {
    if (!lastData) return;
    if (!mountPanel()) return;

    const elapsed = fetchedAt ? Math.floor((Date.now() - fetchedAt) / 1000) : 0;

    // ── Xanax card ──
    const rawCd   = lastData.cooldowns?.drug ?? 0;
    const cdLeft  = Math.max(0, rawCd - elapsed);
    const hasCd   = rawCd > 0;
    const cdReady = hasCd && cdLeft === 0;
    const cdPct   = hasCd ? Math.min(100, ((XANAX_CD_MAX - cdLeft) / XANAX_CD_MAX) * 100) : 0;

    const count    = xanToday ?? 0;
    const haveLog  = xanToday !== null;
    const metGoal  = count >= XAN_GOAL;
    const countCls = !haveLog ? "tdh-c-dim"
                   : metGoal  ? "tdh-c-green"
                   : count >= 2 ? "tdh-c-amber"
                   : count >= 1 ? "tdh-c-orange"
                   : "tdh-c-dim";
    const fillCls  = metGoal ? "green" : count >= 2 ? "amber" : count >= 1 ? "orange" : "red";
    const goalPct  = Math.min(100, (count / XAN_GOAL) * 100);

    const badge = metGoal
      ? `<span class="tdh-badge met">Goal Met</span>`
      : `<span class="tdh-badge togo">${haveLog ? `${XAN_GOAL - count} to go` : "log n/a"}</span>`;

    const cdValHtml = !hasCd
      ? `<span class="tdh-cd-val">—</span>`
      : cdReady
        ? `<span class="tdh-cd-val ready">Ready</span>`
        : `<span class="tdh-cd-val">${fmtTime(cdLeft)}</span>`;

    const cdFillCls = cdReady ? "cd-done" : cdPct > 75 ? "cd-warm" : "cd";

    // ── Refills card ──
    const r = lastData.refills ?? {};
    const refill = (label, used, type) => {
      const cls = used ? "used" : `avail ${type}`;
      return `<a class="tdh-refill ${cls}" href="https://www.torn.com/points.php" title="${used ? "Already used today" : "Available — click to use"}">${label}</a>`;
    };

    panelEl.innerHTML = `
      <div class="tdh-card">
        <div class="tdh-card-head">
          <span class="tdh-card-title"><span class="tdh-dot"></span>Xanax</span>
          ${haveLog ? '<span class="tdh-live">Live</span>' : ""}
        </div>
        <div class="tdh-card-body">
          <div class="tdh-xan-row">
            <span class="tdh-xan-count ${countCls}">${haveLog ? count : "—"}<span class="tdh-goal-frac"> / ${XAN_GOAL} today</span></span>
            ${badge}
          </div>
          <div class="tdh-track"><div class="tdh-fill ${fillCls}" style="width:${haveLog ? goalPct : 0}%"></div></div>
          <div class="tdh-cd-row">
            <span class="tdh-cd-label">Cooldown</span>
            ${cdValHtml}
          </div>
          <div class="tdh-track" style="margin-bottom:0"><div class="tdh-fill ${cdFillCls}" style="width:${cdPct}%"></div></div>
        </div>
      </div>
      <div class="tdh-card">
        <div class="tdh-card-head">
          <span class="tdh-card-title"><span class="tdh-dot"></span>Refills</span>
        </div>
        <div class="tdh-card-body">
          <div class="tdh-refill-grid">
            ${refill("Energy", r.energy_refill_used ?? true, "energy")}
            ${refill("Nerve",  r.nerve_refill_used  ?? true, "nerve")}
            ${refill("Casino", r.token_refill_used  ?? true, "casino")}
          </div>
        </div>
      </div>
    `;
  }

  // ─── Render: effective battle stats (under the Battle Stats card) ───────────
  function mountEff() {
    if (effEl && document.contains(effEl)) return true;
    const anchor = findBattleStatsBox();
    if (!anchor || !anchor.parentElement) return false;
    effEl = document.createElement("div");
    effEl.id = "tdh-eff";
    anchor.parentElement.insertBefore(effEl, anchor.nextSibling);
    return true;
  }

  function fmtNum(n) { return Math.floor(n).toLocaleString("en-US"); }

  function renderEff() {
    if (!lastData || lastData.strength === undefined) return;
    if (!mountEff()) return;

    const stats = [
      ["Strength",  lastData.strength,  lastData.strength_modifier  ?? 0],
      ["Defense",   lastData.defense,   lastData.defense_modifier   ?? 0],
      ["Speed",     lastData.speed,     lastData.speed_modifier     ?? 0],
      ["Dexterity", lastData.dexterity, lastData.dexterity_modifier ?? 0],
    ];
    let total = 0;
    const rows = stats.map(([name, base, mod]) => {
      const eff = Math.floor(base * (1 + mod / 100));
      total += eff;
      const modCls = mod > 0 ? "pos" : mod < 0 ? "neg" : "zero";
      const modTxt = mod > 0 ? `+${mod}%` : mod < 0 ? `${mod}%` : "±0%";
      return `
        <div class="tdh-eff-row">
          <span class="tdh-eff-name">${name}</span>
          <span class="tdh-eff-vals">
            <span class="tdh-eff-mod ${modCls}">${modTxt}</span>
            <span class="tdh-eff-val">${fmtNum(eff)}</span>
          </span>
        </div>`;
    }).join("");

    effEl.innerHTML = `
      <div class="tdh-card-head">
        <span class="tdh-card-title"><span class="tdh-dot"></span>Effective Battle Stats</span>
        <span class="tdh-live">Live</span>
      </div>
      ${rows}
      <div class="tdh-eff-row total">
        <span class="tdh-eff-name">Total</span>
        <span class="tdh-eff-vals">
          <span class="tdh-eff-val">${fmtNum(total)}</span>
        </span>
      </div>
    `;
  }

  // ─── Timers ──────────────────────────────────────────────────────────────────
  function schedule() {
    if (pollTimer) clearInterval(pollTimer);
    if (tickTimer) clearInterval(tickTimer);
    pollTimer = setInterval(refreshAll, POLL_MS);
    tickTimer = setInterval(() => { if (lastData) render(); }, 1000);
  }

  // ─── Boot — wait for the Battle Stats box to exist (Torn loads content async) ─
  function boot() {
    if (findBattleStatsBox()) {
      if (!apiKey) { renderSetup(); return; }
      refreshAll();
      schedule();
      return;
    }
    // Watch for it
    const obs = new MutationObserver(() => {
      if (findBattleStatsBox()) {
        obs.disconnect();
        if (!apiKey) { renderSetup(); return; }
        refreshAll();
        schedule();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 20000); // give up after 20s
  }

  boot();
})();
