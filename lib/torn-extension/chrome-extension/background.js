// Torn Data Hub — live toolbar icon
// Repaints the action icon so the 4 bars reflect live Energy / Nerve / Happy / Life.

const KEY_STORE = "tdh_api_key";
const ALARM = "tdh-icon-refresh";
const REFRESH_MINUTES = 1;

const COLORS = {
  energy: "#22c55e",
  nerve: "#dc2626",
  happy: "#eab308",
  life: "#3b82f6",
};
const TRACK = "#3a3a3a";
const BG = "#191919";

function drawIcon(size, pcts) {
  const c = new OffscreenCanvas(size, size);
  const ctx = c.getContext("2d");

  // rounded dark background
  const r = size * 0.19;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, r);
  ctx.fillStyle = BG;
  ctx.fill();

  const pad = Math.max(1, size * 0.15);
  const gap = Math.max(1, size * 0.09);
  const innerW = size - pad * 2;
  const innerH = size - pad * 2;
  const barH = (innerH - gap * 3) / 4;
  const order = ["energy", "nerve", "happy", "life"];

  order.forEach((k, i) => {
    const y = pad + i * (barH + gap);
    // track
    ctx.fillStyle = TRACK;
    ctx.fillRect(pad, y, innerW, barH);
    // fill
    const p = pcts ? Math.max(0, Math.min(1, pcts[k] ?? 0)) : 1;
    const w = innerW * p;
    if (w > 0) {
      ctx.fillStyle = COLORS[k];
      ctx.fillRect(pad, y, w, barH);
    }
  });

  return ctx.getImageData(0, 0, size, size);
}

function setIcon(pcts) {
  const imageData = {};
  for (const size of [16, 32]) imageData[size] = drawIcon(size, pcts);
  return chrome.action.setIcon({ imageData });
}

async function refreshIcon() {
  try {
    const { [KEY_STORE]: apiKey } = await chrome.storage.local.get(KEY_STORE);
    if (!apiKey) return; // keep static full-bars icon until a key is set
    const res = await fetch(
      `https://api.torn.com/user/?selections=bars&key=${apiKey}&comment=TDH-icon`
    );
    const d = await res.json();
    if (d.error) return; // keep last drawn icon on API errors

    const pct = (b) => (b && b.maximum > 0 ? b.current / b.maximum : 0);
    const pcts = {
      energy: pct(d.energy),
      nerve: pct(d.nerve),
      happy: pct(d.happy),
      life: pct(d.life),
    };
    await setIcon(pcts);
    await chrome.action.setTitle({
      title:
        `Torn Data Hub\n` +
        `Energy ${d.energy.current}/${d.energy.maximum}\n` +
        `Nerve ${d.nerve.current}/${d.nerve.maximum}\n` +
        `Happy ${d.happy.current}/${d.happy.maximum}\n` +
        `Life ${d.life.current}/${d.life.maximum}`,
    });
  } catch (_) {
    // network hiccup — leave the current icon alone
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM, { periodInMinutes: REFRESH_MINUTES });
  refreshIcon();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM, { periodInMinutes: REFRESH_MINUTES });
  refreshIcon();
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) refreshIcon();
});

// refresh immediately when the API key changes or popup asks for it
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[KEY_STORE]) refreshIcon();
});
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "tdh-refresh-icon") refreshIcon();
});
