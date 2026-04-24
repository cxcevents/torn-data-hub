const ALL_PANELS = [
  { id: "vitals", label: "Vitals (Energy / Nerve / Happy / Life)" },
  { id: "cooldowns", label: "Cooldowns (Drug / Medical / Booster)" },
  { id: "travel", label: "Travel (when in transit)" },
  { id: "wallet", label: "Wallet (Cash / Bank / Vault)" },
  { id: "alerts", label: "Alerts (Messages / Events / Awards)" },
  { id: "education", label: "Education (when course active)" },
];

const DEFAULT_PANELS = ["vitals", "cooldowns", "travel", "wallet", "alerts"];
const DEFAULT_DASHBOARD = "https://557b2076-808b-4c51-aa18-38e299a801a2-00-s43xyexshz2h.worf.replit.dev/";

const $ = (s) => document.querySelector(s);

let currentOrder = [];
let enabled = new Set();

document.addEventListener("DOMContentLoaded", async () => {
  const s = await chrome.storage.sync.get(["apiKey", "panels", "badgeMode", "dashboardUrl"]);
  $("#apiKey").value = s.apiKey || "";
  $("#badgeMode").value = s.badgeMode || "energy";
  $("#dashboardUrl").value = s.dashboardUrl || DEFAULT_DASHBOARD;

  const saved = s.panels && s.panels.length ? s.panels : DEFAULT_PANELS;
  enabled = new Set(saved);
  currentOrder = [...saved, ...ALL_PANELS.map((p) => p.id).filter((id) => !saved.includes(id))];
  renderPanels();

  $("#save").addEventListener("click", save);
});

function renderPanels() {
  const wrap = $("#panels-list");
  wrap.innerHTML = "";
  currentOrder.forEach((id, idx) => {
    const def = ALL_PANELS.find((p) => p.id === id);
    if (!def) return;
    const row = document.createElement("div");
    row.className = "panel-item";
    row.innerHTML = `
      <input type="checkbox" id="pn-${id}" ${enabled.has(id) ? "checked" : ""} />
      <label for="pn-${id}">${def.label}</label>
      <span class="order-btns">
        <button data-act="up" ${idx === 0 ? "disabled" : ""}>↑</button>
        <button data-act="down" ${idx === currentOrder.length - 1 ? "disabled" : ""}>↓</button>
      </span>
    `;
    row.querySelector(`#pn-${id}`).addEventListener("change", (e) => {
      if (e.target.checked) enabled.add(id);
      else enabled.delete(id);
    });
    row.querySelectorAll(".order-btns button").forEach((b) => {
      b.addEventListener("click", () => {
        const act = b.dataset.act;
        const i = currentOrder.indexOf(id);
        if (act === "up" && i > 0) {
          [currentOrder[i - 1], currentOrder[i]] = [currentOrder[i], currentOrder[i - 1]];
        } else if (act === "down" && i < currentOrder.length - 1) {
          [currentOrder[i + 1], currentOrder[i]] = [currentOrder[i], currentOrder[i + 1]];
        }
        renderPanels();
      });
    });
    wrap.appendChild(row);
  });
}

async function save() {
  const apiKey = $("#apiKey").value.trim();
  const badgeMode = $("#badgeMode").value;
  const dashboardUrl = $("#dashboardUrl").value.trim() || DEFAULT_DASHBOARD;
  const panels = currentOrder.filter((id) => enabled.has(id));
  await chrome.storage.sync.set({ apiKey, badgeMode, dashboardUrl, panels });
  const status = $("#status");
  status.textContent = "Saved.";
  setTimeout(() => (status.textContent = ""), 1500);
}
