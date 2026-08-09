const KEY_STORE = "tdh_api_key";
const UPDATE_MANIFEST_URL =
  "https://raw.githubusercontent.com/cxcevents/torn-data-hub/main/lib/torn-extension/chrome-extension/manifest.json";
const UPDATE_ZIP_URL =
  "https://raw.githubusercontent.com/cxcevents/torn-data-hub/main/lib/torn-extension/torn-data-hub-extension.zip";

const vitalsEl = document.getElementById("vitals");
const keyInput = document.getElementById("key");
const statusEl = document.getElementById("status");

let apiKey = "";

function fmt(n) { return Number(n).toLocaleString("en-US"); }

function fmtTime(s) {
  if (s <= 0) return "0s";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const ss = s % 60;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

function bar(name, cls, cur, max) {
  const pct = max > 0 ? Math.min(100, (cur / max) * 100) : 0;
  return `
    <div class="vital">
      <div class="vital-row">
        <span class="vital-name">${name}</span>
        <span class="vital-val">${fmt(cur)}<span class="max"> / ${fmt(max)}</span></span>
      </div>
      <div class="track"><div class="fill ${cls}" style="width:${pct}%"></div></div>
    </div>`;
}

async function loadVitals() {
  if (!apiKey) {
    document.body.classList.add("show-settings");
    return;
  }
  try {
    const res = await fetch(
      `https://api.torn.com/user/?selections=bars,cooldowns&key=${apiKey}&comment=TDH-popup`
    );
    const d = await res.json();
    if (d.error) throw new Error(d.error.error);

    const drugCd = d.cooldowns?.drug ?? 0;
    const cdMax = 6 * 3600;
    const cdPct = drugCd > 0 ? Math.max(3, ((cdMax - Math.min(drugCd, cdMax)) / cdMax) * 100) : 100;

    vitalsEl.innerHTML = `
      ${bar("Energy", "energy", d.energy?.current ?? 0, d.energy?.maximum ?? 0)}
      ${bar("Nerve",  "nerve",  d.nerve?.current  ?? 0, d.nerve?.maximum  ?? 0)}
      ${bar("Happy",  "happy",  d.happy?.current  ?? 0, d.happy?.maximum  ?? 0)}
      ${bar("Life",   "life",   d.life?.current   ?? 0, d.life?.maximum   ?? 0)}
      <div class="section">
        <div class="cd-row">
          <span class="cd-label">Drug Cooldown</span>
          ${drugCd > 0
            ? `<span class="cd-val">${fmtTime(drugCd)}</span>`
            : `<span class="cd-val ready">Ready</span>`}
        </div>
        <div class="track" style="height:5px"><div class="fill ${drugCd > 0 ? "cd" : "cd-done"}" style="width:${cdPct}%"></div></div>
      </div>
    `;
    chrome.runtime.sendMessage({ type: "tdh-refresh-icon" }).catch(() => {});
  } catch (e) {
    vitalsEl.innerHTML = `<div class="muted">⚠ ${e.message || e}</div>`;
  }
}

chrome.storage.local.get(KEY_STORE, (v) => {
  apiKey = v[KEY_STORE] || "";
  if (apiKey) {
    keyInput.value = apiKey;
    statusEl.textContent = "Key saved ✓";
    statusEl.className = "status ok";
  }
  loadVitals();
});

document.getElementById("gear").addEventListener("click", () => {
  document.body.classList.toggle("show-settings");
});

document.getElementById("save").addEventListener("click", () => {
  const k = keyInput.value.trim();
  if (!k) return;
  chrome.storage.local.set({ [KEY_STORE]: k }, () => {
    apiKey = k;
    statusEl.textContent = "Key saved ✓";
    statusEl.className = "status ok";
    document.body.classList.remove("show-settings");
    loadVitals();
  });
});

// Version + update check
const local = chrome.runtime.getManifest().version;
document.getElementById("ver").textContent = `v${local}`;

function cmpVersions(a, b) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

fetch(UPDATE_MANIFEST_URL, { cache: "no-store" })
  .then((r) => r.json())
  .then((remote) => {
    if (remote.version && cmpVersions(remote.version, local) > 0) {
      const a = document.getElementById("update");
      a.href = UPDATE_ZIP_URL;
      a.style.display = "inline";
      a.textContent = `Update to v${remote.version} ↓`;
    }
  })
  .catch(() => {});
