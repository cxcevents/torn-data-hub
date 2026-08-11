import { useState } from "react";
import { Smartphone, Copy, Check, Settings2, Plus, Link2, CheckCircle2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SCRIPT_URL =
  "https://raw.githubusercontent.com/cxcevents/torn-data-hub/main/lib/torn-extension/torn-data-hub.pda.user.js";

const STEPS: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <Copy className="w-4 h-4" />,
    title: "Copy the script link",
    body: "Tap the copy button above to put the script URL on your clipboard.",
  },
  {
    icon: <Settings2 className="w-4 h-4" />,
    title: "Open TornPDA's userscripts settings",
    body: "In TornPDA, open the side menu → Settings → scroll to the Browser section → tap \"Userscripts\".",
  },
  {
    icon: <Plus className="w-4 h-4" />,
    title: "Add a new script",
    body: "Tap the + button to add a script, then choose the option to load it from a URL (remote load).",
  },
  {
    icon: <Link2 className="w-4 h-4" />,
    title: "Paste the link",
    body: "Paste the copied URL and save. TornPDA fetches the script and fills in your Torn API key automatically — no key setup needed.",
  },
  {
    icon: <CheckCircle2 className="w-4 h-4" />,
    title: "Done — open the home page",
    body: "Browse to the Torn home page inside TornPDA. The Torn Data Hub cards (xanax tracker, refills, effective battle stats, gym efficiency) appear just like on desktop.",
  },
  {
    icon: <RefreshCw className="w-4 h-4" />,
    title: "Updating later",
    body: "When we ship a new version, just tap the refresh/update icon next to the script in TornPDA's userscripts list — it re-downloads the latest from the same URL.",
  },
];

export default function PdaPlugin() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SCRIPT_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-primary" />
          PDA Plugin
        </h1>
        <p className="text-muted-foreground mt-1">
          Get Torn Data Hub on your phone inside{" "}
          <a
            href="https://github.com/Manuito83/torn-pda"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            TornPDA
          </a>{" "}
          — the popular mobile app for Torn (Android &amp; iOS). Same features as the Chrome
          extension: xanax tracker, refills, effective battle stats, and gym efficiency.
        </p>
      </div>

      {/* Script URL card */}
      <Card className="border-primary/30">
        <CardContent className="pt-6 space-y-3">
          <div className="font-semibold">Userscript link</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2.5 break-all select-all">
              {SCRIPT_URL}
            </code>
            <Button onClick={copy} size="sm" className="sm:self-center" data-testid="button-copy-script-url">
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied!" : "Copy link"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Always points at the latest version — TornPDA inserts your Torn API key for you
            automatically.
          </p>
        </CardContent>
      </Card>

      {/* Install steps */}
      <Card>
        <CardHeader>
          <CardTitle>How to install in TornPDA</CardTitle>
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
        Don't have TornPDA yet? It's free on the{" "}
        <a
          href="https://play.google.com/store/apps/details?id=com.manuito.tornpda"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Play Store
        </a>{" "}
        and the{" "}
        <a
          href="https://apps.apple.com/us/app/torn-pda/id1510046592"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          App Store
        </a>
        . The same userscript also works in Tampermonkey on any desktop browser.
      </p>
    </div>
  );
}
