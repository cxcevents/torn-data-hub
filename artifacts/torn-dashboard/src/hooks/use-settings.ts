import { useState, useEffect } from "react";

const STORAGE_KEY = "torn_dashboard_settings_v1";
const EVENT_NAME = "torn_dashboard_settings_changed";

export interface DashboardSettings {
  showWipFeatures: boolean;
}

const DEFAULTS: DashboardSettings = {
  showWipFeatures: false,
};

function readSettings(): DashboardSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeSettings(settings: DashboardSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {}
}

export function useSettings() {
  const [settings, setSettingsState] = useState<DashboardSettings>(readSettings);

  useEffect(() => {
    const handler = () => setSettingsState(readSettings());
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const setSetting = <K extends keyof DashboardSettings>(key: K, value: DashboardSettings[K]) => {
    const next = { ...readSettings(), [key]: value };
    writeSettings(next);
    setSettingsState(next);
  };

  return { settings, setSetting };
}
