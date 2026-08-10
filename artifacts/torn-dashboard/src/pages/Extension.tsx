import { useEffect, useState } from "react";
import { Chrome, Download, FolderOpen, ToggleRight, Puzzle, CheckCircle2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const FALLBACK_VERSION = "3.3.4";
const MANIFEST_URL =
  "https://raw.githubusercontent.com/cxcevents/torn-data-hub/main/lib/torn-extension/chrome-extension/manifest.json";

function zipUrl(version: string) {
  return `https://raw.githubusercontent.com/cxcevents/torn-data-hub/main/lib/torn-extension/torn-data-hub-extension-v${version}.zip`;
}

const STEPS: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <Download className="w-4 h-4" />,
    title: "Download the extension",
    body: "Click the download button above. You'll get a .zip file — remember where it saves (usually your Downloads folder).",
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
    body: "Click \"Load unpacked\" and select the folder you unzipped (the one containing manifest.json). Torn Data Hub will appear in your list — you're done! Open torn.com and the enhancements kick in automatically.",
  },
  {
    icon: <RefreshCw className="w-4 h-4" />,
    title: "Updating later",
    body: "When a new version comes out, download the new zip, unzip it over the old folder (or a new one), then hit the refresh icon on the extension's card at chrome://extensions.",
  },
];

export default function Extension() {
  const [version, setVersion] = useState<string>(FALLBACK_VERSION);

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

      {/* Download card */}
      <Card className="border-primary/30">
        <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="font-semibold">Torn Data Hub Extension</div>
            <div className="text-sm text-muted-foreground">
              Version {version} · works with Google Chrome and other Chromium browsers (Edge, Brave)
            </div>
          </div>
          <Button asChild size="lg" data-testid="button-download-extension">
            <a href={zipUrl(version)}>
              <Download className="w-4 h-4 mr-2" />
              Download v{version} (.zip)
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Install steps */}
      <Card>
        <CardHeader>
          <CardTitle>How to install</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Chrome may warn about extensions in Developer mode — that's normal for extensions installed
        outside the Web Store. A Chrome Web Store listing is in review, and once approved you'll be
        able to install with one click instead.
      </p>
    </div>
  );
}
