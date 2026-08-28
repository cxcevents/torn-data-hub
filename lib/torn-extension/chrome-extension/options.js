const KEY_STORE = "tdh_api_key";
const FEAT_STORE = "tdh_features";
const DEFAULTS = {
  popupVitals: true,
  xanax: true,
  nag: true,
  refills: true,
  effstats: true,
  barlinks: true,
  gym: true,
  warOnline: true,
  warOkay: true,
  warGlow: true,
};

const toggles = [...document.querySelectorAll("[data-feature]")];
const saved = document.getElementById("saved");
let savedTimer;

function flashSaved() {
  saved.classList.add("show");
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => saved.classList.remove("show"), 1400);
}

chrome.storage.local.get([KEY_STORE, FEAT_STORE], (stored) => {
  const features = Object.assign({}, DEFAULTS, stored[FEAT_STORE] || {});
  toggles.forEach((toggle) => { toggle.checked = features[toggle.dataset.feature] !== false; });
  if (stored[KEY_STORE]) {
    document.getElementById("key").value = stored[KEY_STORE];
    document.getElementById("key-status").textContent = "API key saved";
    document.getElementById("key-status").className = "status ok";
  }
});

toggles.forEach((toggle) => {
  toggle.addEventListener("change", () => {
    const features = {};
    toggles.forEach((item) => { features[item.dataset.feature] = item.checked; });
    chrome.storage.local.set({ [FEAT_STORE]: features }, flashSaved);
  });
});

document.getElementById("save-key").addEventListener("click", () => {
  const key = document.getElementById("key").value.trim();
  const status = document.getElementById("key-status");
  if (!key) {
    status.textContent = "Enter an API key first.";
    status.className = "status";
    return;
  }
  chrome.storage.local.set({ [KEY_STORE]: key }, () => {
    status.textContent = "API key saved";
    status.className = "status ok";
    flashSaved();
  });
});

document.getElementById("nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-target]");
  if (!button) return;
  document.querySelectorAll("#nav button").forEach((item) => item.classList.toggle("active", item === button));
  document.getElementById(button.dataset.target).scrollIntoView({ behavior: "smooth" });
});

document.getElementById("version").textContent = `v${chrome.runtime.getManifest().version}`;