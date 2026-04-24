import { useState } from "react";
import { useApiKey } from "@/hooks/use-api-key";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, ExternalLink, ShieldAlert, Info } from "lucide-react";

export function Onboarding() {
  const { setApiKey } = useApiKey();
  const [inputKey, setInputKey] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputKey.trim().length > 0) {
      setApiKey(inputKey.trim());
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-md border-primary/20 shadow-2xl">
        <CardHeader className="space-y-1 text-center pb-8 pt-8">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Connect Torn API</CardTitle>
          <CardDescription className="text-base">
            Enter your API key to activate the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Paste your 16-character API key"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="font-mono text-center h-12"
              />
            </div>
            <Button type="submit" className="w-full h-12 text-md font-medium" disabled={!inputKey.trim()}>
              Save & Connect
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-3 text-sm text-muted-foreground pt-4 pb-8">
          <a
            href="https://www.torn.com/preferences.php#tab=api"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-primary transition-colors"
          >
            Get your key from Torn Preferences <ExternalLink className="h-3 w-3" />
          </a>
          <div className="flex items-start gap-2 bg-muted/50 p-3 rounded-md w-full">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              A <span className="text-foreground font-semibold">Default</span> or <span className="text-foreground font-semibold">Full</span> access key is recommended for the best experience — it unlocks all panels including battle stats, networth, job points, and faction data. Limited keys will work but some panels may show no data.
            </p>
          </div>
          <div className="flex items-start gap-2 bg-muted/50 p-3 rounded-md w-full">
            <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              Your key is never sent to any server. It's stored only in your browser's local storage, and all API calls go directly from your browser to api.torn.com.
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
