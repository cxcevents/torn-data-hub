import { useEffect, useState } from "react";

const POPUP_W = 340;
const POPUP_H = 540;
const OPTIONS_W = 720;
const OPTIONS_H = 600;

type View = "popup" | "options" | "both";

function App() {
  const base = import.meta.env.BASE_URL;
  const [view, setView] = useState<View>("both");

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "open-options") setView("options");
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0c",
        color: "#e6e6ea",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        padding: 16,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "#888894",
              fontWeight: 700,
            }}
          >
            Chrome Extension Preview
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Torn Vitals</div>
          <div style={{ fontSize: 11, color: "#888894", marginTop: 4 }}>
            Source: <code>lib/torn-extension/</code> — same files Chrome loads when
            installed unpacked.
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["popup", "options", "both"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                background: view === v ? "#c2185b" : "transparent",
                color: view === v ? "#fff" : "#e6e6ea",
                border: "1px solid #2a2a30",
                padding: "6px 12px",
                borderRadius: 4,
                fontSize: 11,
                textTransform: "uppercase",
                fontWeight: 700,
                letterSpacing: 0.5,
                cursor: "pointer",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        {(view === "popup" || view === "both") && (
          <Frame title="Toolbar Popup" width={POPUP_W} height={POPUP_H}>
            <iframe
              title="popup"
              src={`${base}ext/popup.html`}
              style={{
                width: POPUP_W,
                height: POPUP_H,
                border: "none",
                background: "#0e0e10",
                borderRadius: 4,
              }}
            />
          </Frame>
        )}

        {(view === "options" || view === "both") && (
          <Frame title="Options Page" width={OPTIONS_W} height={OPTIONS_H}>
            <iframe
              title="options"
              src={`${base}ext/options.html`}
              style={{
                width: OPTIONS_W,
                height: OPTIONS_H,
                border: "none",
                background: "#0e0e10",
                borderRadius: 4,
              }}
            />
          </Frame>
        )}
      </div>

      <footer
        style={{
          marginTop: 32,
          fontSize: 11,
          color: "#666670",
          maxWidth: 800,
          lineHeight: 1.6,
        }}
      >
        <p>
          <strong>How this preview works:</strong> the popup and options pages
          are the actual extension files served as static assets. A Chrome-API
          shim polyfills <code>chrome.storage</code>,{" "}
          <code>chrome.runtime</code>, and <code>chrome.action</code> using
          <code> localStorage</code> and direct calls to the Torn API, so the
          preview is fully interactive. Set your API key in the Options panel to
          see live data. The dynamic toolbar icon is not visible here (Chrome
          renders it in the actual browser toolbar) but the popup/options UI
          you see here is exactly what users see after installing.
        </p>
      </footer>
    </div>
  );
}

function Frame({
  title,
  width,
  children,
}: {
  title: string;
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: "#888894",
          textTransform: "uppercase",
          letterSpacing: 1,
          fontWeight: 700,
          marginBottom: 6,
          width,
        }}
      >
        {title}
      </div>
      <div
        style={{
          padding: 8,
          background: "#16161a",
          border: "1px solid #2a2a30",
          borderRadius: 6,
          display: "inline-block",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default App;
