// Torn Data Hub — Chrome extension content script (torn.com homepage)
// Port of the Tampermonkey userscript; storage via chrome.storage.local.
(function () {
  "use strict";

  // ─── Constants ───────────────────────────────────────────────────────────────
  const POLL_MS      = 2 * 60 * 1000;  // 2 min refresh
  const XANAX_CD_MAX = 6 * 3600;       // 6-hour xanax cooldown (seconds)
  const KEY_STORE    = "tdh_api_key";
  const XAN_GOAL     = 3;              // daily goal (matches dashboard)
  const IS_HOME      = /^\/(index\.php)?$/.test(location.pathname);

  // ─── State ───────────────────────────────────────────────────────────────────
  let apiKey    = "";
  // feature toggles (popup settings) — default all on
  const feat = { xanax: true, refills: true, effstats: true, gym: true, barlinks: true, nag: true };
  let lastData  = null;   // { cooldowns, refills, battlestats fields }
  let xanToday  = null;   // number | null — from log API
  let fetchedAt = null;
  let panelEl   = null;
  let effEl     = null;
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

  // ─── theme (match Torn's dark/light mode) ────────────────────────────────────
  function tornIsDark() {
    return document.body.classList.contains("dark-mode");
  }

  function applyTheme() {
    const light = !tornIsDark();
    for (const el of [panelEl, effEl]) {
      if (el) el.classList.toggle("tdh-light", light);
    }
  }

  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  function mountPanel() {
    if (panelEl && document.contains(panelEl)) return true;
    const anchor = findBattleStatsBox();
    if (!anchor || !anchor.parentElement) return false;
    panelEl = document.createElement("div");
    panelEl.id = "tdh-panel";
    anchor.parentElement.insertBefore(panelEl, anchor);
    applyTheme();
    return true;
  }

  function mountEff() {
    if (effEl && document.contains(effEl)) return true;
    const anchor = findBattleStatsBox();
    if (!anchor || !anchor.parentElement) return false;
    effEl = document.createElement("div");
    effEl.id = "tdh-eff";
    anchor.parentElement.insertBefore(effEl, anchor.nextSibling);
    applyTheme();
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
    chrome.storage.local.get("tdh_energy_full_since", (v) => {
      energyFullSince = v.tdh_energy_full_since || null;
    });
  }

  // ─── Wasted-energy nag (energy sitting at full — data from background worker) ─
  let energyFullSince = null;

  function energyFullNagHtml() {
    if (!energyFullSince) return "";
    const mins = Math.floor((Date.now() - energyFullSince) / 60000);
    if (mins < 10) return "";
    const wasted = Math.floor(mins / 10) * 5; // +5 energy per 10 min regen
    return `<div class="tdh-nag">⚠ Energy full for ${mins >= 60 ? Math.floor(mins / 60) + "h " + (mins % 60) + "m" : mins + "m"} — ~${wasted}E regen wasted. <a href="https://www.torn.com/gym.php">Go train →</a></div>`;
  }

  // ─── Gym Efficiency (gym page): 30-day energy utilization score ─────────────
  const GYM_DAYS      = 30;
  const REGEN_PER_DAY = 720;          // +5 energy / 10 min
  const XANAX_ENERGY  = 250;
  const GYMEFF_CACHE  = "tdh_gymeff_cache_v1";
  const GYMEFF_TTL    = 6 * 3600 * 1000;

  // Paginated, server-filtered log fetch (same to= cursor pattern as xanax)
  async function fetchLogEntries(logIds, from) {
    const seen = new Set();
    const out = [];
    let to = null;
    let prevOldest = Infinity;
    for (let page = 0; page < 40; page++) {
      const json = await tornApi("log", `&log=${logIds}&from=${from}${to !== null ? `&to=${to}` : ""}`);
      const entries = Object.entries(json.log ?? {});
      if (entries.length === 0) break;
      let added = 0;
      for (const [id, e] of entries) {
        if (seen.has(id)) continue;
        seen.add(id); added++;
        out.push(e);
      }
      const oldest = Math.min(...entries.map(([, e]) => e.timestamp));
      if (entries.length < 100 || oldest <= from) break;
      to = (added === 0 || oldest >= prevOldest) ? oldest - 1 : oldest;
      prevOldest = oldest;
      await new Promise((r) => setTimeout(r, 700));
    }
    return out;
  }

  async function computeGymEff() {
    const from = Math.floor(Date.now() / 1000) - GYM_DAYS * 86400;
    const bars = await tornApi("bars");
    const maxE = bars.energy?.maximum ?? 150;

    const gymLogs = await fetchLogEntries("5300,5301,5302,5303", from);
    const trained = gymLogs.reduce((s, e) => s + (e.data?.energy_used ?? 0), 0);
    const sessions = gymLogs.length;

    const xanLogs = await fetchLogEntries("2290", from);
    const refillLogs = await fetchLogEntries("4900", from);

    const acquired =
      GYM_DAYS * REGEN_PER_DAY +
      xanLogs.length * XANAX_ENERGY +
      refillLogs.length * maxE;

    const score = acquired > 0 ? trained / acquired : 0;
    return {
      at: Date.now(),
      trained,
      sessions,
      acquired,
      xanax: xanLogs.length,
      refills: refillLogs.length,
      maxE,
      score,
    };
  }

  function gymGrade(score) {
    if (score >= 0.95) return ["A+", "tdh-c-green"];
    if (score >= 0.90) return ["A",  "tdh-c-green"];
    if (score >= 0.80) return ["B",  "tdh-c-green"];
    if (score >= 0.65) return ["C",  "tdh-c-amber"];
    if (score >= 0.50) return ["D",  "tdh-c-orange"];
    return ["F", "tdh-c-orange"];
  }

  function renderGymEff(el, s, overflow7d) {
    const pct = Math.round(s.score * 100);
    const [grade, gradeCls] = gymGrade(s.score);
    const wasted = Math.max(0, s.acquired - s.trained);
    const fillCls = s.score >= 0.8 ? "green" : s.score >= 0.65 ? "amber" : "orange";
    const overflowRow = overflow7d > 0
      ? `<div class="tdh-gym-row"><span>Time at full energy (7d)</span><span>${Math.floor(overflow7d / 60)}h ${overflow7d % 60}m ≈ ${Math.floor(overflow7d / 10) * 5}E lost</span></div>`
      : "";
    el.innerHTML = `
      <div class="tdh-card-head">
        <span class="tdh-card-title"><span class="tdh-dot"></span>Gym Efficiency — last ${GYM_DAYS} days</span>
        <span class="tdh-live">Live</span>
      </div>
      <div class="tdh-card-body">
        <div class="tdh-xan-row">
          <span class="tdh-xan-count ${gradeCls}">${grade}<span class="tdh-goal-frac"> ${pct}% of energy trained</span></span>
          <span class="tdh-badge ${s.score >= 0.8 ? "met" : "togo"}">${fmtNum(wasted)}E unaccounted</span>
        </div>
        <div class="tdh-track"><div class="tdh-fill ${fillCls}" style="width:${Math.min(100, pct)}%"></div></div>
        <div class="tdh-gym-row"><span>Trained in gym</span><span>${fmtNum(s.trained)}E · ${s.sessions} sessions</span></div>
        <div class="tdh-gym-row"><span>Energy acquired</span><span>${fmtNum(s.acquired)}E (regen ${fmtNum(GYM_DAYS * REGEN_PER_DAY)} + ${s.xanax} xanax + ${s.refills} refills)</span></div>
        ${overflowRow}
        <div class="tdh-gym-note">Unaccounted energy = spent outside the gym (attacks, items) or lost to a full bar. Overflow tracking is exact from install onward.</div>
      </div>
    `;
  }

  async function bootGymEff() {
    if (!apiKey) return;
    // mount above the gym content
    const anchor =
      document.querySelector("#gymroot") ||
      document.querySelector(".content-wrapper") ||
      document.querySelector("#mainContainer");
    if (!anchor) return;
    const el = document.createElement("div");
    el.className = "tdh-card";
    el.id = "tdh-gym";
    el.innerHTML = `
      <div class="tdh-card-head">
        <span class="tdh-card-title"><span class="tdh-dot"></span>Gym Efficiency — last ${GYM_DAYS} days</span>
      </div>
      <div class="tdh-card-body"><div class="tdh-gym-note">Crunching your last ${GYM_DAYS} days of logs…</div></div>
    `;
    anchor.parentElement.insertBefore(el, anchor);
    el.classList.toggle("tdh-light", !tornIsDark());

    // 7-day overflow minutes from background tracking
    const ov = await new Promise((r) => chrome.storage.local.get("tdh_overflow_v1", (v) => r(v.tdh_overflow_v1 || {})));
    const cutoff = Date.now() - 7 * 86400 * 1000;
    let overflow7d = 0;
    for (const [day, mins] of Object.entries(ov)) {
      if (new Date(day + "T00:00:00Z").getTime() >= cutoff) overflow7d += mins;
    }

    try {
      const cached = await new Promise((r) => chrome.storage.local.get(GYMEFF_CACHE, (v) => r(v[GYMEFF_CACHE])));
      if (cached && Date.now() - cached.at < GYMEFF_TTL) {
        renderGymEff(el, cached, overflow7d);
        return;
      }
      const s = await computeGymEff();
      chrome.storage.local.set({ [GYMEFF_CACHE]: s });
      renderGymEff(el, s, overflow7d);
    } catch (e) {
      el.querySelector(".tdh-card-body").innerHTML =
        `<div class="tdh-error-text">⚠ ${String(e.message || e)} (log access needs a Full Access key)</div>`;
    }
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

    // ── Refills card ──
    const r = lastData.refills ?? {};
    const refill = (label, used, type) => {
      const cls = used ? "used" : `avail ${type}`;
      return `<a class="tdh-refill ${cls}" href="https://www.torn.com/points.php" title="${used ? "Already used today" : "Available — click to use"}">${label}</a>`;
    };

    const xanaxCard = !feat.xanax ? "" : `
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
          ${feat.nag ? energyFullNagHtml() : ""}
        </div>
      </div>`;

    const refillsCard = !feat.refills ? "" : `
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
      </div>`;

    if (!xanaxCard && !refillsCard) { panelEl.style.display = "none"; return; }
    panelEl.innerHTML = xanaxCard + refillsCard;
  }

  // ─── Render: effective battle stats (under the Battle Stats card) ───────────
  function renderEff() {
    if (!feat.effstats) return;
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
  }

  // ─── Clickable sidebar bars: Energy → Gym, Nerve → Crimes ────────────────────
  const BAR_LINKS = [
    { name: "energy", url: "/gym.php",               title: "Go to the Gym", fullCls: "tdh-full-energy" },
    { name: "nerve",  url: "/page.php?sid=crimes#/", title: "Go to Crimes",  fullCls: "tdh-full-nerve" },
  ];

  // Flag a bar as full so CSS can pulse it. Prefer cur/max text; fall back to
  // the progress-line inline width (Torn: <div class="progress-line___…" style="width: 100%">).
  function updateBarFullState(bar, fullCls) {
    let full = null;
    const m = (bar.textContent || "").match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
    if (m) {
      const cur = parseInt(m[1].replace(/,/g, ""), 10);
      const max = parseInt(m[2].replace(/,/g, ""), 10);
      if (max > 0) full = cur >= max;
    }
    if (full === null) {
      const line = bar.querySelector('[class*="progress-line"]');
      if (line) full = parseFloat(line.style.width) >= 100;
    }
    if (full === null) { console.debug("[TDH] can't judge fullness for", fullCls); return; }
    // glow only the progress track itself (progress___xxx), not the whole block
    const target =
      bar.querySelector('[class*="progress___"]') ||
      bar.querySelector('[class*="progress-line"]')?.parentElement ||
      bar;
    // clear any stale glow left on other elements from earlier versions
    for (const el of bar.querySelectorAll("." + fullCls)) {
      if (el !== target) el.classList.remove(fullCls);
    }
    bar.classList.remove(fullCls);
    target.classList.toggle(fullCls, full);
    console.debug("[TDH]", fullCls, full ? "FULL → glow on" : "not full");
  }

  function wireBar(bar, { url, title, fullCls }) {
    if (bar.dataset.tdhLink) return;
    bar.dataset.tdhLink = "1";
    bar.classList.add("tdh-bar-link");
    bar.title = title + " — Torn Data Hub";
    bar.addEventListener("click", (e) => {
      // don't hijack Torn's own links/buttons inside the bar
      if (e.target.closest("a, button")) return;
      window.location.href = url;
    });
    updateBarFullState(bar, fullCls);
    // Torn updates the bar text live as ticks come in — keep the glow in sync
    const obs = new MutationObserver(() => updateBarFullState(bar, fullCls));
    obs.observe(bar, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["style"], // progress-line width updates live via inline style
    });
  }

  // Find the sidebar block for a vital by its label text ("Energy:", "Nerve:"),
  // then return the container that also holds the progress bar.
  function findBar(name) {
    // legacy ids first (older Torn markup)
    const legacy = document.getElementById("bar" + name[0].toUpperCase() + name.slice(1));
    if (legacy) return legacy;

    const label = name[0].toUpperCase() + name.slice(1);
    const candidates = document.querySelectorAll('[class*="bar-name"], [class*="name___"]');
    for (const el of candidates) {
      if ((el.textContent || "").trim().toLowerCase().startsWith(name)) {
        let node = el;
        for (let i = 0; i < 5 && node.parentElement; i++) {
          node = node.parentElement;
          if (node.querySelector('[class*="progress"]')) return node;
        }
      }
    }
    // last resort: walk all sidebar text for the label
    const all = document.querySelectorAll('a, p, span, div');
    for (const el of all) {
      if (el.children.length === 0 && (el.textContent || "").trim() === label + ":") {
        let node = el;
        for (let i = 0; i < 6 && node.parentElement; i++) {
          node = node.parentElement;
          if (node.querySelector('[class*="progress"]')) return node;
        }
      }
    }
    return null;
  }

  function initBarLinks() {
    let wired = 0;
    for (const cfg of BAR_LINKS) {
      const bar = findBar(cfg.name);
      if (bar) { wireBar(bar, cfg); wired++; }
      else console.debug("[TDH] sidebar bar not found:", cfg.name);
    }
    return wired === BAR_LINKS.length;
  }

  function bootBarLinks() {
    if (initBarLinks()) return;
    const obs = new MutationObserver(() => {
      if (initBarLinks()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 20000);
  }

  function boot() {
    if (feat.barlinks) bootBarLinks();
    if (feat.gym && /^\/gym\.php/.test(location.pathname)) {
      // gym content loads async — wait for the anchor
      if (document.querySelector("#gymroot, .content-wrapper, #mainContainer")) bootGymEff();
      else {
        const obs = new MutationObserver(() => {
          if (document.querySelector("#gymroot, .content-wrapper, #mainContainer")) {
            obs.disconnect();
            bootGymEff();
          }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => obs.disconnect(), 20000);
      }
    }
    if (!IS_HOME) return; // overlays only live on the homepage
    if (!feat.xanax && !feat.refills && !feat.effstats) return; // everything off
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

  chrome.storage.local.get([KEY_STORE, "tdh_features"], (v) => {
    apiKey = v[KEY_STORE] || "";
    Object.assign(feat, v.tdh_features || {});
    boot();
  });
})();
