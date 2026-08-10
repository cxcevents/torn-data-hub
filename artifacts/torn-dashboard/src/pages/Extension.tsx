import { useEffect, useState } from "react";
import {
  Chrome, Download, FolderOpen, ToggleRight, Puzzle, CheckCircle2,
  RefreshCw, ChevronDown, ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const STORE_URL =
  "https://chromewebstore.google.com/detail/torn-data-hub/jhnmhkifckfklnmacpedegggjaolfllg";

const FALLBACK_VERSION = "3.3.4";
const MANIFEST_URL =
  "https://raw.githubusercontent.com/cxcevents/torn-data-hub/main/lib/torn-extension/chrome-extension/manifest.json";

function zipUrl(version: string) {
  return `https://raw.githubusercontent.com/cxcevents/torn-data-hub/main/lib/torn-extension/torn-data-hub-extension-v${version}.zip`;
}

const STEPS: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <Download className="w-4 h-4" />,
    title: "Download the zip",
    body: "Use the download link above. Remember where it saves (usually your Downloads folder).",
  },
  {
    icon: <FolderOpen className="w-4 h-4" />,
    title: "Unzip it",
    body: "Right-click the .zip file and choose \"Extract All…\" (Windows) or double-click it (Mac). You'll end up with a folder containing the extension files.",
  },
  {
    icon: <Puzzle className="w-4 h-4" />,
    title: "Open Chrome's extensions page",
    body: "In Chrome, type chrome://extensions into the address bar and press Enter.",
  },
  {
    icon: <ToggleRight className="w-4 h-4" />,
    title: "Turn on Developer mode",
    body: "Flip the \"Developer mode\" switch in the top-right corner of the extensions page.",
  },
  {
    icon: <CheckCircle2 className="w-4 h-4" />,
    title: "Load the extension",
    body: "Click \"Load unpacked\" and select the folder you unzipped (the one containing manifest.json). Torn Data Hub will appear in your list — open torn.com and the enhancements kick in automatically.",
  },
  {
    icon: <RefreshCw className="w-4 h-4" />,
    title: "Updating later",
    body: "Manual installs don't auto-update. Download the new zip, unzip it over the old folder, then hit the refresh icon on the extension's card at chrome://extensions. (Web Store installs update automatically.)",
  },
];

export default function Extension() {
  const [version, setVersion] = useState<string>(FALLBACK_VERSION);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    fetch(MANIFEST_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (m?.version) setVersion(m.version);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Chrome className="w-6 h-6 text-primary" />
          Chrome Extension
        </h1>
        <p className="text-muted-foreground mt-1">
          Torn Data Hub's browser extension adds live enhancements directly on torn.com — effective
          battle stats, gym efficiency scoring, xanax cooldown alerts, and more.
        </p>
      </div>

      {/* Web Store install — the main path */}
      <Card className="border-primary/30">
        <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="font-semibold">Install from the Chrome Web Store</div>
            <div className="text-sm text-muted-foreground">
              One click, updates automatically. Works with Google Chrome and other Chromium browsers
              (Edge, Brave).
            </div>
          </div>
          <Button asChild size="lg" data-testid="button-webstore">
            <a href={STORE_URL} target="_blank" rel="noopener noreferrer">
              <Chrome className="w-4 h-4 mr-2" />
              Add to Chrome
              <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-70" />
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Manual install — fallback, collapsed by default */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <button
            onClick={() => setManualOpen((o) => !o)}
            className="w-full flex items-center gap-2 text-left"
            data-testid="button-toggle-manual"
          >
            <motion.span animate={{ rotate: manualOpen ? 0 : -90 }} transition={{ duration: 0.15 }}>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </motion.span>
            <div className="flex-1">
              <div className="font-medium text-sm">Manual install (advanced)</div>
              <div className="text-xs text-muted-foreground">
                Install the zip directly — useful if you can't use the Web Store or want a specific
                version.
              </div>
            </div>
          </button>

          <AnimatePresence initial={false}>
            {manualOpen && (
              <motion.div
                key="manual"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div className="pt-4 space-y-5">
                  <div className="flex items-center justify-between rounded-md border border-border/60 px-4 py-3">
                    <div className="text-sm">
                      <span className="font-medium">Torn Data Hub v{version}</span>
                      <span className="text-muted-foreground"> · .zip</span>
                    </div>
                    <Button asChild variant="outline" size="sm" data-testid="button-download-extension">
                      <a href={zipUrl(version)}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </a>
                    </Button>
                  </div>

                  <ol className="space-y-5">
                    {STEPS.map((s, i) => (
                      <li key={i} className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">
                          {i + 1}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {s.icon}
                            {s.title}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{s.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <p className="text-xs text-muted-foreground">
                    Chrome may warn about extensions in Developer mode — that's normal for
                    extensions installed outside the Web Store.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
