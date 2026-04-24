const DEFAULT_PANELS = ["vitals", "cooldowns", "travel", "wallet", "alerts"];
const DASHBOARD_URL_DEFAULT = "https://557b2076-808b-4c51-aa18-38e299a801a2-00-s43xyexshz2h.worf.replit.dev/";

const $ = (sel) => document.querySelector(sel);
const main = $("#main");

let tickHandle = null;

document.addEventListener("DOMContentLoaded", async () => {
  const settings = await chrome.storage.sync.get(["apiKey", "panels", "dashboardUrl"]);
  $("#dashboard-link").href = settings.dashboardUrl || DASHBOARD_URL_DEFAULT;
  $("#settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("#refresh").addEventListener("click", async () => {
    main.innerHTML = `<div class="empty">Refreshing…</div>`;
    await chrome.runtime.sendMessage({ type: "refresh" });
    render(await getSnapshot(), settings);
  });

  if (!settings.apiKey) {
    main.innerHTML = `<div class="empty">
      No Torn API key set.
      <br/><button id="setup">Open settings</button>
    </div>`;
    $("#setup").addEventListener("click", () => chrome.runtime.openOptionsPage());
    return;
  }

  const snap = await getSnapshot();
  render(snap, settings);
  startTick(snap, settings);
});

async function getSnapshot() {
  return new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: "get-snapshot" }, (snap) => resolve(snap))
  );
}

function startTick(snap, settings) {
  if (tickHandle) clearInterval(tickHandle);
  if (!snap?.data) return;
  tickHandle = setInterval(() => render(snap, settings, true), 1000);
}

function render(snap, settings, tickOnly = false) {
  if (!snap) {
    main.innerHTML = `<div class="empty">Loading…</div>`;
    return;
  }
  if (snap.error) {
    main.innerHTML = `<div class="error">Error: ${snap.error}</div>`;
    return;
  }
  const data = snap.data;
  const panels = settings.panels?.length ? settings.panels : DEFAULT_PANELS;
  const elapsed = Math.floor((Date.now() - (snap.fetchedAt || Date.now())) / 1000);

  main.innerHTML = panels
    .map((p) => renderPanel(p, data, elapsed))
    .filter(Boolean)
    .join("");
}

function renderPanel(name, data, elapsed) {
  switch (name) {
    case "vitals": return panelVitals(data, elapsed);
    case "cooldowns": return panelCooldowns(data, elapsed);
    case "travel": return panelTravel(data, elapsed);
    case "wallet": return panelWallet(data);
    case "alerts": return panelAlerts(data);
    case "education": return panelEducation(data, elapsed);
    default: return "";
  }
}

function panelVitals(data, elapsed) {
  const bars = [
    { key: "energy", label: "Energy", cls: "bar-energy", obj: data.energy },
    { key: "nerve", label: "Nerve", cls: "bar-nerve", obj: data.nerve },
    { key: "happy", label: "Happy", cls: "bar-happy", obj: data.happy },
    { key: "life", label: "Life", cls: "bar-life", obj: data.life },
  ];
  const rows = bars.map(({ label, cls, obj }) => {
    if (!obj) return "";
    const pct = obj.maximum ? Math.min(100, (obj.current / obj.maximum) * 100) : 0;
    const tickRem = obj.ticktime ? Math.max(0, obj.ticktime - elapsed) : 0;
    const tickStr = tickRem > 0 ? `<span class="bar-tick">+1 in ${fmtTime(tickRem)}</span>` : "";
    return `<div class="bar-row">
      <div class="bar-label">${label}</div>
      <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
      <div class="bar-val">${obj.current}/${obj.maximum} ${tickStr}</div>
    </div>`;
  }).join("");
  return `<div class="panel"><h3>Vitals</h3>${rows}</div>`;
}

function panelCooldowns(data, elapsed) {
  if (!data.cooldowns) return "";
  const cds = [
    { k: "drug", label: "Drug" },
    { k: "medical", label: "Medical" },
    { k: "booster", label: "Booster" },
  ];
  const cells = cds.map(({ k, label }) => {
    const v = Math.max(0, (data.cooldowns[k] || 0) - elapsed);
    const cls = v > 0 ? "active" : "idle";
    const val = v > 0 ? fmtTime(v) : "Ready";
    return `<div class="cd-cell ${cls}"><div class="lbl">${label}</div><div class="val">${val}</div></div>`;
  }).join("");
  return `<div class="panel"><h3>Cooldowns</h3><div class="cooldown-grid">${cells}</div></div>`;
}

function panelTravel(data, elapsed) {
  if (!data.travel || !data.travel.destination || data.travel.destination === "Torn") return "";
  const left = Math.max(0, (data.travel.time_left || 0) - elapsed);
  return `<div class="panel"><h3>Travel</h3>
    <div class="travel-banner">
      <div><span class="dest">→ ${data.travel.destination}</span></div>
      <div class="eta">${left > 0 ? `Lands in ${fmtTime(left)}` : "Landed"}</div>
    </div>
  </div>`;
}

function panelWallet(data) {
  const rows = [
    ["On Hand", data.money_onhand],
    ["City Bank", data.city_bank?.amount],
    ["Property Vault", data.vault_amount],
    ["Cayman", data.cayman_bank],
    ["Points", data.points, true],
  ];
  const html = rows.filter(([, v]) => v != null).map(([k, v, isInt]) =>
    `<div class="kv-row"><span class="k">${k}</span><span class="v">${isInt ? v : fmtMoney(v)}</span></div>`
  ).join("");
  return `<div class="panel"><h3>Wallet</h3>${html}</div>`;
}

function panelAlerts(data) {
  if (!data.notifications) return "";
  const items = [
    ["Messages", data.notifications.messages, "https://www.torn.com/messages.php"],
    ["Events", data.notifications.events, "https://www.torn.com/events.php"],
    ["Awards", data.notifications.awards, "https://www.torn.com/awards.php"],
    ["Comps", data.notifications.competition, "https://www.torn.com/competition.php"],
  ];
  const cells = items.map(([lbl, n, href]) =>
    `<a href="${href}" target="_blank" class="alert-cell ${n > 0 ? "has" : ""}"><div class="lbl">${lbl}</div><div class="val">${n || 0}</div></a>`
  ).join("");
  return `<div class="panel"><h3>Alerts</h3><div class="alert-grid">${cells}</div></div>`;
}

function panelEducation(data, elapsed) {
  if (!data.education_current) return "";
  const left = Math.max(0, (data.education_timeleft || 0) - elapsed);
  return `<div class="panel"><h3>Education</h3>
    <div class="kv-row"><span class="k">In Progress</span><span class="v">${fmtTime(left)}</span></div>
  </div>`;
}

function fmtTime(s) {
  if (s <= 0) return "0s";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

function fmtMoney(n) {
  if (n == null) return "—";
  return "$" + Math.round(n).toLocaleString();
}
