import { useApiKey } from "@/hooks/use-api-key";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function Settings() {
  const { apiKey, setApiKey } = useApiKey();
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
    </div>
  );
}
