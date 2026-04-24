// Chrome Extension API shim for previewing the popup/options pages
// in a normal browser (e.g. via the Torn Extension Preview artifact).
// In a real extension context, chrome.runtime is defined -> this file
// is a no-op. In a normal browser it polyfills the bits we use.
(function () {
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
    return; // real extension context, do nothing
  }
  const SELECTIONS = "bars,cooldowns,travel,money,icons,notifications,education";
  const ls = window.localStorage;
  const KEY_PREFIX = "torn-ext-shim:";

  function getStore(area) {
    return JSON.parse(ls.getItem(KEY_PREFIX + area) || "{}");
  }
  function setStore(area, obj) {
    ls.setItem(KEY_PREFIX + area, JSON.stringify(obj));
  }

  async function pollAndCache() {
    const sync = getStore("sync");
    const key = sync.apiKey;
    if (!key) {
      setStore("local", { snapshot: { error: "no_key" } });
      return;
    }
    try {
      const res = await fetch(`https://api.torn.com/user/?selections=${SELECTIONS}&key=${key}`);
      const json = await res.json();
      if (json.error) {
        setStore("local", { snapshot: { error: json.error.error } });
      } else {
        setStore("local", { snapshot: { data: json, fetchedAt: Date.now() } });
      }
    } catch (e) {
      setStore("local", { snapshot: { error: String(e?.message || e) } });
    }
  }

  function makeArea(name) {
    return {
      get: (keys) =>
        new Promise((resolve) => {
          const all = getStore(name);
          if (!keys) return resolve({ ...all });
          if (typeof keys === "string") return resolve({ [keys]: all[keys] });
          if (Array.isArray(keys)) {
            const out = {};
            keys.forEach((k) => (out[k] = all[k]));
            return resolve(out);
          }
          const out = {};
          Object.keys(keys).forEach((k) => (out[k] = all[k] !== undefined ? all[k] : keys[k]));
          resolve(out);
        }),
      set: (obj) =>
        new Promise((resolve) => {
          const all = getStore(name);
          Object.assign(all, obj);
          setStore(name, all);
          if (name === "sync" && (obj.apiKey !== undefined || obj.badgeMode !== undefined)) {
            pollAndCache().then(() => resolve());
            return;
          }
          resolve();
        }),
    };
  }

  window.chrome = window.chrome || {};
  window.chrome.storage = {
    sync: makeArea("sync"),
    local: makeArea("local"),
    onChanged: { addListener: () => {} },
  };
  window.chrome.runtime = {
    id: "preview",
    sendMessage: (msg, cb) => {
      if (msg?.type === "refresh") {
        pollAndCache().then(() => cb && cb({ ok: true }));
        return;
      }
      if (msg?.type === "get-snapshot") {
        // Refresh if stale (>30s) or missing
        const local = getStore("local");
        const snap = local.snapshot;
        const fresh = snap && snap.data && Date.now() - (snap.fetchedAt || 0) < 30000;
        if (fresh) {
          cb && cb(snap);
        } else {
          pollAndCache().then(() => {
            cb && cb(getStore("local").snapshot || null);
          });
        }
      }
    },
    openOptionsPage: () => {
      window.parent && window.parent.postMessage({ type: "open-options" }, "*");
    },
  };
  window.chrome.action = {
    setBadgeText: () => Promise.resolve(),
    setBadgeBackgroundColor: () => Promise.resolve(),
    setIcon: () => Promise.resolve(),
  };
  window.chrome.alarms = {
    create: () => {},
    onAlarm: { addListener: () => {} },
  };
})();
