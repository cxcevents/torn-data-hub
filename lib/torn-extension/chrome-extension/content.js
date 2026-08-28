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
  const rootEls = {};     // name -> injected root element (xanax, refills, eff)
  const LAYOUT_STORE = "tdh_layout_v1";
  let layout = {};        // name -> saved index within the Torn column
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

  let effEl = null; // lives inside Torn's Battle Stats card, not its own root

  function applyTheme() {
    const light = !tornIsDark();
    for (const el of [...Object.values(rootEls), effEl]) {
      if (el) el.classList.toggle("tdh-light", light);
    }
  }

  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  // ─── movable card roots (each card is its own draggable unit) ────────────────
  function mountRoot(name, position = "before") {
    const existing = rootEls[name];
    if (existing && document.contains(existing)) return existing;
    const anchor = findBattleStatsBox();
    if (!anchor || !anchor.parentElement) return null;
    const el = document.createElement("div");
    el.className = "tdh-root";
    el.id = "tdh-root-" + name;
    el.dataset.tdhRoot = name;
    if (position === "after") anchor.parentElement.insertBefore(el, anchor.nextSibling);
    else anchor.parentElement.insertBefore(el, anchor);
    rootEls[name] = el;
    applyTheme();
    scheduleRestore();
    return el;
  }

  // Torn's homepage lays cards out in several sortable columns; find them all
  // by matching elements that share the reference column's first class
  function getColumns(refParent) {
    if (!refParent) return [];
    const cls = (refParent.className || "").toString().trim().split(/\s+/)[0];
    if (!cls) return [refParent];
    try {
      const cols = Array.from(document.querySelectorAll(refParent.tagName + "." + CSS.escape(cls)));
      return cols.length ? cols : [refParent];
    } catch { return [refParent]; }
  }

  function saveLayout() {
    for (const [name, el] of Object.entries(rootEls)) {
      if (!el || !el.parentElement) continue;
      const cols = getColumns(el.parentElement);
      layout[name] = {
        c: Math.max(0, cols.indexOf(el.parentElement)),
        i: Array.prototype.indexOf.call(el.parentElement.children, el),
      };
    }
    chrome.storage.local.set({ [LAYOUT_STORE]: layout });
  }

  function layoutOf(name) {
    const v = layout[name];
    if (v === undefined) return null;
    if (typeof v === "number") return { c: null, i: v }; // old format: same column
    return v;
  }

  // restore all mounted roots as a batch, ordered by saved index — restoring
  // one at a time shifts the sibling indices the later ones rely on
  let restoreQueued = false;
  function scheduleRestore() {
    if (restoreQueued) return;
    restoreQueued = true;
    queueMicrotask(() => {
      restoreQueued = false;
      const entries = Object.entries(rootEls)
        .filter(([n, el]) => el && el.parentElement && layoutOf(n))
        .sort((a, b) => layoutOf(a[0]).i - layoutOf(b[0]).i);
      for (const [name, el] of entries) {
        const { c, i } = layoutOf(name);
        let parent = el.parentElement;
        if (c !== null) {
          const cols = getColumns(parent);
          if (cols[c]) parent = cols[c];
        }
        const others = Array.from(parent.children).filter((k) => k !== el);
        parent.insertBefore(el, others[i] ?? null);
      }
    });
  }

  // drag a whole card root among the Torn column's children (mirrors Torn's own
  // card re-ordering); grab anywhere on the card header
  function initDrag() {
    document.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const head = e.target.closest?.(".tdh-card-head");
      const root = head && head.closest(".tdh-root");
      if (!root) return;
      if (e.target.closest("a, button, input")) return;
      e.preventDefault();
      e.stopPropagation(); // keep Torn's own sortable from starting a sort on our card

      const pointerId = e.pointerId;
      const startX = e.clientX, startY = e.clientY;
      const columns = getColumns(root.parentElement); // snapshot at drag start
      let dragging = false, ghost = null, done = false;

      const move = (ev) => {
        if (ev.pointerId !== pointerId || done) return;
        if (!dragging) {
          if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < 6) return;
          dragging = true;
          ghost = root.cloneNode(true);
          ghost.classList.add("tdh-ghost");
          ghost.style.width = root.offsetWidth + "px";
          document.body.appendChild(ghost);
          root.classList.add("tdh-dragging");
        }
        ghost.style.left = ev.clientX + 12 + "px";
        ghost.style.top  = ev.clientY + 8 + "px";

        // pick the column under (or nearest to) the pointer — allows moving
        // side to side between Torn's columns, like Torn's own cards
        let target = root.parentElement;
        let best = Infinity;
        for (const col of columns) {
          const r = col.getBoundingClientRect();
          if (r.width === 0) continue;
          const dx = ev.clientX < r.left ? r.left - ev.clientX
                   : ev.clientX > r.right ? ev.clientX - r.right : 0;
          if (dx < best) { best = dx; target = col; }
        }
        if (!target) return;

        let ref = null;
        for (const sib of target.children) {
          if (sib === root) continue;
          const r = sib.getBoundingClientRect();
          if (r.height === 0) continue;
          if (ev.clientY < r.top + r.height / 2) { ref = sib; break; }
        }
        if (target !== root.parentElement || (ref !== root && ref !== root.nextSibling)) {
          target.insertBefore(root, ref);
        }
      };

      const up = (ev) => {
        if (ev && ev.pointerId !== pointerId) return;
        if (done) return;
        done = true;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        window.removeEventListener("blur", up);
        if (ghost) ghost.remove();
        root.classList.remove("tdh-dragging");
        if (dragging) saveLayout();
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      window.addEventListener("blur", up);
    }, true);
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
  const GYMEFF_CACHE  = "tdh_gymeff_cache_v3"; // v3: ranked-war window detection
  const ATTACK_ENERGY = 25;           // every outgoing hit costs 25E, win or lose
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

  // Ranked-war windows: any attack inside a war window on the enemy faction is a war hit,
  // even if the API didn't flag it (losses/stalemates/early hits often come back unflagged).
  async function fetchWarWindows(from) {
    try {
      const res = await fetch(`https://api.torn.com/faction/?selections=rankedwars&key=${apiKey}&comment=TDH-ext`);
      const json = await res.json();
      if (json.error) return [];
      return Object.values(json.rankedwars ?? {})
        .filter((w) => (w.war?.end === 0 || w.war?.end >= from))
        .map((w) => ({
          start: w.war?.start ?? 0,
          end: w.war?.end === 0 ? Infinity : w.war.end,
          factions: Object.keys(w.factions ?? {}).map(Number),
        }));
    } catch { return []; }
  }

  // Paginated attack fetch (attacks selection: last 100 per call, to= cursor)
  async function fetchAttacks(from) {
    const seen = new Set();
    const out = [];
    let to = null;
    let prevOldest = Infinity;
    for (let page = 0; page < 15; page++) {
      const json = await tornApi("attacks", `&from=${from}${to !== null ? `&to=${to}` : ""}`);
      const entries = Object.values(json.attacks ?? {});
      if (entries.length === 0) break;
      let added = 0;
      for (const a of entries) {
        if (seen.has(a.code)) continue;
        seen.add(a.code); added++;
        if ((a.timestamp_ended ?? a.timestamp_started) >= from) out.push(a);
      }
      const oldest = Math.min(...entries.map((a) => a.timestamp_ended ?? a.timestamp_started));
      if (entries.length < 100 || oldest <= from) break;
      to = (added === 0 || oldest >= prevOldest) ? oldest - 1 : oldest;
      prevOldest = oldest;
      await new Promise((r) => setTimeout(r, 700));
    }
    return out;
  }

  async function computeGymEff() {
    const from = Math.floor(Date.now() / 1000) - GYM_DAYS * 86400;
    const bars = await tornApi("bars,basic");
    const maxE = bars.energy?.maximum ?? 150;
    const myId = bars.player_id;

    const gymLogs = await fetchLogEntries("5300,5301,5302,5303", from);
    const trained = gymLogs.reduce((s, e) => s + (e.data?.energy_used ?? 0), 0);
    const sessions = gymLogs.length;

    const xanLogs = await fetchLogEntries("2290", from);
    const refillLogs = await fetchLogEntries("4900", from);

    // Outgoing attacks — result doesn't matter (win/lose/stalemate all cost 25E).
    // All attacks are credited to the score; the war/other split is informational only.
    const warWindows = await fetchWarWindows(from);
    const attacks = (await fetchAttacks(from)).filter((a) => a.attacker_id === myId);
    let warHits = 0, otherHits = 0;
    for (const a of attacks) {
      const t = a.timestamp_started ?? a.timestamp_ended ?? 0;
      const inWarWindow = warWindows.some((w) =>
        t >= w.start && t <= w.end && w.factions.includes(a.defender_faction));
      const isWar = a.ranked_war === 1 || (a.modifiers?.war ?? 1) > 1 ||
        (a.modifiers?.chain_bonus ?? 1) > 1 || (a.chain ?? 0) >= 10 || inWarWindow;
      if (isWar) warHits++; else otherHits++;
    }
    const warE   = warHits * ATTACK_ENERGY;
    const otherE = otherHits * ATTACK_ENERGY;

    const acquired =
      GYM_DAYS * REGEN_PER_DAY +
      xanLogs.length * XANAX_ENERGY +
      refillLogs.length * maxE;

    // utilized = deliberately spent energy: gym + war/chain hits + other attacks
    const utilized = trained + warE + otherE;
    const score = acquired > 0 ? utilized / acquired : 0;
    return {
      at: Date.now(),
      trained,
      sessions,
      warHits,
      warE,
      otherHits,
      otherE,
      utilized,
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
    const utilized = s.utilized ?? s.trained;
    const wasted = Math.max(0, s.acquired - utilized);
    const fillCls = s.score >= 0.8 ? "green" : s.score >= 0.65 ? "amber" : "orange";
    const warRow = s.warHits
      ? `<div class="tdh-gym-row"><span>War &amp; chain hits (credited)</span><span>${fmtNum(s.warE)}E · ${s.warHits} hits</span></div>` : "";
    const otherAtkRow = s.otherHits
      ? `<div class="tdh-gym-row"><span>Other attacks (credited)</span><span>${fmtNum(s.otherE)}E · ${s.otherHits} hits</span></div>` : "";
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
          <span class="tdh-xan-count ${gradeCls}">${grade}<span class="tdh-goal-frac"> ${pct}% of energy put to use</span></span>
          <span class="tdh-badge ${s.score >= 0.8 ? "met" : "togo"}">${fmtNum(wasted)}E unaccounted</span>
        </div>
        <div class="tdh-track"><div class="tdh-fill ${fillCls}" style="width:${Math.min(100, pct)}%"></div></div>
        <div class="tdh-gym-row"><span>Trained in gym</span><span>${fmtNum(s.trained)}E · ${s.sessions} sessions</span></div>
        ${warRow}
        ${otherAtkRow}
        <div class="tdh-gym-row"><span>Energy acquired</span><span>${fmtNum(s.acquired)}E (regen ${fmtNum(GYM_DAYS * REGEN_PER_DAY)} + ${s.xanax} xanax + ${s.refills} refills)</span></div>
        ${overflowRow}
        <div class="tdh-gym-note">Every attack is credited at 25E toward the score — war, chain, or otherwise; the split above is just for info. Unaccounted energy = items/other or regen lost to a full bar (stacking shows up there; that's expected before wars). Overflow tracking is exact from install onward.</div>
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
  function hideOtherRoots() {
    for (const [name, el] of Object.entries(rootEls)) {
      if (name !== "xanax" && el) el.style.display = "none";
    }
    if (effEl) effEl.style.display = "none";
  }

  function renderSetup() {
    const panelEl = mountRoot("xanax");
    if (!panelEl) return;
    hideOtherRoots();
    panelEl.style.display = "";
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
    const panelEl = mountRoot("xanax");
    if (!panelEl) return;
    hideOtherRoots();
    panelEl.style.display = "";
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

    const cdEmpty = cdLeft === 0; // no active drug cooldown — a xanax can be taken now
    const cdValHtml = cdEmpty
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
          ${cdEmpty ? `<a class="tdh-xan-alert" href="https://www.torn.com/item.php#drugs-items">💊 Cooldown clear — take a Xanax →</a>` : ""}
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

    const xr = mountRoot("xanax");
    if (xr) {
      xr.style.display = xanaxCard ? "" : "none";
      xr.innerHTML = xanaxCard;
    }
    const rr = mountRoot("refills");
    if (rr) {
      rr.style.display = refillsCard ? "" : "none";
      rr.innerHTML = refillsCard;
    }
  }

  // ─── Render: effective battle stats (under the Battle Stats card) ───────────
  function renderEff() {
    if (!feat.effstats) return;
    if (!lastData || lastData.strength === undefined) return;
    // mount inside Torn's Battle Stats card so it moves with it when dragged
    if (!effEl || !document.contains(effEl)) {
      const box = findBattleStatsBox();
      if (!box) return;
      effEl = document.createElement("div");
      effEl.id = "tdh-eff";
      box.appendChild(effEl);
      applyTheme();
    }
    effEl.style.display = "";

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

  // ─── Ranked war: online member counts ───────────────────────────────────────
  // Torn randomizes the suffixes on its CSS-module classes, so these selectors
  // intentionally match only the stable class-name prefixes and ARIA labels.
  function updateRankedWarOnlineCounts() {
    if (!/^\/factions\.php$/.test(location.pathname) || !location.hash.includes("/war/rank")) return;

    const war = document.querySelector(".faction-war, [class*='membersWrap___']");
    if (!war) return;

    const factionNames = Array.from(war.querySelectorAll(":scope > .faction-names > [class~='name']"));
    const memberPanels = Array.from(
      war.querySelectorAll(":scope > [class*='tabMenuCont___'], :scope > .tab-menu-cont"),
    );
    if (factionNames.length < 2 || memberPanels.length < 2) return;

    const indicators = [];
    const counts = [];

    factionNames.slice(0, 2).forEach((nameBox, index) => {
      const score = nameBox.querySelector("[class~='score'], [class*='score___']");
      const panel = memberPanels[index];
      if (!score || !panel) return;

      const online = panel.querySelectorAll('[aria-label$=" is online" i]').length;
      let indicator = nameBox.querySelector(".tdh-war-online");
      if (!indicator) {
        indicator = document.createElement("div");
        indicator.className = "tdh-war-online";
        score.insertAdjacentElement("afterend", indicator);
      }
      const label = `${online} online`;
      if (indicator.textContent !== label) indicator.textContent = label;
      indicator.setAttribute("title", `${online} faction member${online === 1 ? "" : "s"} currently online`);
      // Match Torn's rendered score color instead of assuming enemy/own colors.
      indicator.style.color = getComputedStyle(score).color;
      indicators[index] = indicator;
      counts[index] = online;
    });

    if (indicators.length === 2) {
      indicators.forEach((indicator) => indicator.classList.remove("tdh-war-online-leader"));
      if (counts[0] !== counts[1]) {
        indicators[counts[0] > counts[1] ? 0 : 1].classList.add("tdh-war-online-leader");
      }
    }
  }

  function bootRankedWarOnlineCounts() {
    let queued = false;
    const updateSoon = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        updateRankedWarOnlineCounts();
      });
    };

    updateSoon();
    // Ranked-war rows and online states are rendered/updated asynchronously.
    const obs = new MutationObserver(updateSoon);
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label"],
    });
  }

  function boot() {
    if (feat.barlinks) bootBarLinks();
    bootRankedWarOnlineCounts();
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
    initDrag();
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

  chrome.storage.local.get([KEY_STORE, "tdh_features", LAYOUT_STORE], (v) => {
    apiKey = v[KEY_STORE] || "";
    Object.assign(feat, v.tdh_features || {});
    layout = v[LAYOUT_STORE] || {};
    boot();
  });
})();
