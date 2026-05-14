import { useApiKey } from "@/hooks/use-api-key";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { apiKey, setApiKey } = useApiKey();
  const { settings, setSetting } = useSettings();
  const [inputKey, setInputKey] = useState("");
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleUpdate = () => {
    if (inputKey.trim()) {
      setApiKey(inputKey.trim());
      setInputKey("");
      toast({ title: "API Key Updated", description: "Your dashboard will now reload." });
    }
  };

  const handleClear = () => {
    setApiKey(null);
    navigate("/");
  };

  const maskedKey = apiKey ? `••••••••••••${apiKey.slice(-4)}` : "No key set";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>API Key Management</CardTitle>
          <CardDescription>
            Update or remove your connected Torn API key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Current Key</Label>
            <div className="flex items-center justify-between bg-muted p-3 rounded-md border font-mono text-sm">
              <span>{maskedKey}</span>
              {apiKey && (
                <Button variant="destructive" size="sm" onClick={handleClear}>
                  Log Out
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Update Key</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Enter new 16-character key"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="font-mono"
              />
              <Button onClick={handleUpdate} disabled={!inputKey.trim()}>
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" />
            Features
          </CardTitle>
          <CardDescription>
            Toggle experimental and in-progress features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={() => setSetting("showWipFeatures", !settings.showWipFeatures)}
            className="w-full flex items-center justify-between gap-4 py-2 group"
          >
            <div className="text-left">
              <p className="text-sm font-medium">Show WIP features</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reveals sections that are still being worked on, like Active Enhancers.
              </p>
            </div>
            <div
              className={cn(
                "relative flex-shrink-0 w-10 h-6 rounded-full border transition-colors duration-200",
                settings.showWipFeatures
                  ? "bg-primary border-primary"
                  : "bg-muted border-border"
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                  settings.showWipFeatures ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </div>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
