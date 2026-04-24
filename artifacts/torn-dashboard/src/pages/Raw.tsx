import { useApiKey } from "@/hooks/use-api-key";
import { useTornUser } from "@/hooks/use-torn-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { TORN_SELECTIONS } from "@/hooks/use-torn-user";

export default function Raw() {
  const { apiKey } = useApiKey();
  const { data } = useTornUser(apiKey);
  const [selectedKey, setSelectedKey] = useState<string>("profile");

  if (!apiKey) {
    return <div>Requires API Key. Go to Settings.</div>;
  }

  const displayData = selectedKey === "all" ? data : { [selectedKey]: data?.[selectedKey] };

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Raw Explorer</h1>
        <Select value={selectedKey} onValueChange={setSelectedKey}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select endpoint" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everything</SelectItem>
            {TORN_SELECTIONS.map((sel) => (
              <SelectItem key={sel} value={sel}>{sel}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="py-3 bg-muted/50 border-b">
          <CardTitle className="text-sm font-mono flex items-center justify-between">
            <span>GET /user/?selections={selectedKey === "all" ? "..." : selectedKey}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-auto bg-black/90">
          <pre className="p-4 text-xs font-mono text-green-400">
            {JSON.stringify(displayData, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
