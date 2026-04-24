const ALARM_NAME = "torn-poll";
const POLL_MINUTES = 0.5;
const SELECTIONS = "bars,cooldowns,travel,money,icons,notifications,education";

const BAR_COLORS = {
  energy: "#3aa8ff",
  nerve: "#ff4d4f",
  happy: "#ffd84a",
  life: "#7be07b",
};

async function getApiKey() {
  const { apiKey } = await chrome.storage.sync.get("apiKey");
  return apiKey || null;
}

async function fetchUser() {
  const key = await getApiKey();
  if (!key) return { error: "no_key" };
  try {
    const res = await fetch(`https://api.torn.com/user/?selections=${SELECTIONS}&key=${key}`);
    const json = await res.json();
    if (json.error) return { error: json.error.error };
    return { data: json, fetchedAt: Date.now() };
  } catch (e) {
    return { error: String(e?.message || e) };
  }
}

async function poll() {
  const result = await fetchUser();
  await chrome.storage.local.set({ snapshot: result });
  if (result.data) {
    await drawIcon(result.data);
    await updateBadge(result.data);
  } else {
    await chrome.action.setBadgeText({ text: "!" });
    await chrome.action.setBadgeBackgroundColor({ color: "#a11" });
  }
}

async function updateBadge(data) {
  const { badgeMode = "energy" } = await chrome.storage.sync.get("badgeMode");
  let text = "";
  let color = "#222";
  if (badgeMode === "energy" && data.energy) {
    text = String(data.energy.current);
    color = "#1f6fb8";
  } else if (badgeMode === "messages" && data.notifications) {
    const n = data.notifications.messages || 0;
    text = n ? String(n) : "";
    color = "#a11";
  } else if (badgeMode === "events" && data.notifications) {
    const n = data.notifications.events || 0;
    text = n ? String(n) : "";
    color = "#a11";
  } else if (badgeMode === "off") {
    text = "";
  }
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
}

async function drawIcon(data) {
  const size = 32;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  const bars = [
    { v: pct(data.energy), c: BAR_COLORS.energy },
    { v: pct(data.nerve), c: BAR_COLORS.nerve },
    { v: pct(data.happy), c: BAR_COLORS.happy },
    { v: pct(data.life), c: BAR_COLORS.life },
  ];

  const padding = 2;
  const gap = 2;
  const totalGap = gap * (bars.length - 1);
  const barH = Math.floor((size - padding * 2 - totalGap) / bars.length);
  const trackW = size - padding * 2;

  for (let i = 0; i < bars.length; i++) {
    const y = padding + i * (barH + gap);
    ctx.fillStyle = "#222";
    ctx.fillRect(padding, y, trackW, barH);
    const w = Math.max(1, Math.round(trackW * bars[i].v));
    ctx.fillStyle = bars[i].c;
    ctx.fillRect(padding, y, w, barH);
  }

  const imageData = ctx.getImageData(0, 0, size, size);
  await chrome.action.setIcon({ imageData: { 32: imageData } });
}

function pct(bar) {
  if (!bar || !bar.maximum) return 0;
  return Math.max(0, Math.min(1, bar.current / bar.maximum));
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_MINUTES });
  poll();
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_MINUTES });
  poll();
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM_NAME) poll();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "refresh") {
    poll().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "get-snapshot") {
    chrome.storage.local.get("snapshot").then((s) => sendResponse(s.snapshot || null));
    return true;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.apiKey || changes.badgeMode)) {
    poll();
  }
});
