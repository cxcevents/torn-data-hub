// Torn Data Hub — Chrome extension content script (torn.com homepage)
// Port of the Tampermonkey userscript; storage via chrome.storage.local.
(function () {
  "use strict";

  // ─── Constants ───────────────────────────────────────────────────────────────
  const POLL_MS      = 2 * 60 * 1000;  // 2 min refresh
  const XANAX_CD_MAX = 6 * 3600;       // 6-hour xanax cooldown (seconds)
  const KEY_STORE    = "tdh_api_key";
  const XAN_GOAL     = 3;              // daily goal (matches dashboard)
  const UPDATE_MANIFEST_URL =
    "https://raw.githubusercontent.com/cxcevents/torn-data-hub/main/lib/torn-extension/chrome-extension/manifest.json";
  const UPDATE_ZIP_URL =
    "https://raw.githubusercontent.com/cxcevents/torn-data-hub/main/lib/torn-extension/torn-data-hub-extension.zip";

  // ─── State ───────────────────────────────────────────────────────────────────
  let apiKey    = "";
  let lastData  = null;   // { cooldowns, refills, battlestats fields }
  let xanToday  = null;   // number | null — from log API
  let fetchedAt = null;
  let panelEl   = null;
  let effEl     = null;
  let updateUrl = null;   // set when a newer version exists
  let pollTimer = null;
  let tickTimer = null;

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function pad(n) { return String(n).padStart(2, "0"); }

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

  function fmtNum(n) { return Math.floor(n).toLocaleString("en-US"); }

  // ─── Update check (unpacked extensions can't auto-update) ───────────────────
  function cmpVersions(a, b) {
    const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  }

  async function checkForUpdate() {
    try {
      const res = await fetch(UPDATE_MANIFEST_URL, { cache: "no-store" });
      const remote = await res.json();
      const local = chrome.runtime.getManifest().version;
      if (remote.version && cmpVersions(remote.version, local) > 0) {
        updateUrl = UPDATE_ZIP_URL;
        render();
      }
    } catch (_) { /* offline or rate-limited — ignore */ }
  }

  // ─── Find injection point: the Battle Stats card ─────────────────────────────
  function findBattleStatsBox() {
    const titles = document.querySelectorAll("h5.box-title");
    for (const t of titles) {
      if (t.textContent.trim().toLowerCase() === "battle stats") {
        let el = t;
        for (let i = 0; i < 6 && el.parentElement; i++) {
          el = el.parentElement;
          const cls = el.className || "";
          if (typeof cls === "string" && /sortable|box-wrap|msg-wrap|column/i.test(cls)) {
            if (/column/i.test(cls)) break;
            return el;
          }
        }
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

  function mountEff() {
    if (effEl && document.contains(effEl)) return true;
    const anchor = findBattleStatsBox();
    if (!anchor || !anchor.parentElement) return false;
    effEl = document.createElement("div");
    effEl.id = "tdh-eff";
    anchor.parentElement.insertBefore(effEl, anchor.nextSibling);
    return true;
  }

  // ─── API calls ───────────────────────────────────────────────────────────────
  async function tornApi(selections, extra = "") {
    const url = `https://api.torn.com/user/?selections=${selections}${extra}&key=${apiKey}&comment=TDH-ext`;
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

  // Same source of truth as the dashboard: xanax-use entries in the activity log.
  async function fetchXanaxLog() {
    if (!apiKey) return;
    try {
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
      chrome.storage.local.set({ [KEY_STORE]: k });
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

    const updateHtml = updateUrl
      ? `<a class="tdh-update" href="${updateUrl}" target="_blank" rel="noreferrer" title="A newer version is available — download and reload the extension">Update available ↓</a>`
      : "";

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
          ${updateHtml || (haveLog ? '<span class="tdh-live">Live</span>' : "")}
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
  function start() {
    if (!apiKey) { renderSetup(); return; }
    refreshAll();
    schedule();
    checkForUpdate();
  }

  function boot() {
    if (findBattleStatsBox()) { start(); return; }
    const obs = new MutationObserver(() => {
      if (findBattleStatsBox()) {
        obs.disconnect();
        start();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 20000); // give up after 20s
  }

  chrome.storage.local.get(KEY_STORE, (v) => {
    apiKey = v[KEY_STORE] || "";
    boot();
  });
})();
