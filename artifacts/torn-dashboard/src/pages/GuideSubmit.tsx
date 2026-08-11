import { useState } from "react";
import { useLocation } from "wouter";
import { PenLine, ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApiKey } from "@/hooks/use-api-key";
import { CATEGORIES, AUDIENCES, type GuideCategory, type GuideAudience } from "@/lib/guides";
import { submitGuide } from "@/lib/guides-api";

export default function GuideSubmit() {
  const [, navigate] = useLocation();
  const { apiKey } = useApiKey();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<GuideCategory>("getting-started");
  const [audience, setAudience] = useState<GuideAudience>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!apiKey) { setError("Set your Torn API key on the dashboard first — it's how we know who wrote the guide."); return; }
    setBusy(true);
    setError(null);
    try {
      await submitGuide({ apiKey, title, summary, body, category, audience });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 mx-auto text-green-500" />
            <div className="font-semibold text-lg">Guide submitted!</div>
            <p className="text-sm text-muted-foreground">
              It's now in the review queue. Once it's approved it will appear on the Guides page for
              everyone.
            </p>
            <Button variant="outline" onClick={() => navigate("/guides")} data-testid="button-back-to-guides">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Guides
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const field = "w-full bg-card border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/60 placeholder:text-muted-foreground";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <button onClick={() => navigate("/guides")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
          <ArrowLeft className="w-4 h-4" /> Guides
        </button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PenLine className="w-6 h-6 text-primary" />
          Write a guide
        </h1>
        <p className="text-muted-foreground mt-1">
          Share what you know. Submissions are reviewed before they go live.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
              placeholder="e.g. Your first week in Torn: what actually matters" data-testid="input-guide-title" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Short summary</label>
            <textarea className={cn(field, "min-h-[60px] resize-y")} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300}
              placeholder="One or two sentences shown on the guide card (20–300 characters)." data-testid="input-guide-summary" />
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category</label>
              <select className={field} value={category} onChange={(e) => setCategory(e.target.value as GuideCategory)} data-testid="select-guide-category">
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Who is it for?</label>
              <select className={field} value={audience} onChange={(e) => setAudience(e.target.value as GuideAudience)} data-testid="select-guide-audience">
                {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Guide content</label>
            <textarea className={cn(field, "min-h-[300px] resize-y font-mono text-xs leading-relaxed")} value={body} onChange={(e) => setBody(e.target.value)}
              placeholder={"Write the full guide here (at least 100 characters).\n\nPlain text is fine — blank lines separate paragraphs. Lines starting with # become headings, lines starting with - become bullet points."}
              data-testid="input-guide-body" />
            <p className="text-xs text-muted-foreground">{body.length.toLocaleString()} characters (minimum 100)</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={submit} disabled={busy || title.trim().length < 8 || summary.trim().length < 20 || body.trim().length < 100} data-testid="button-submit-guide">
            <Send className="w-4 h-4 mr-2" />
            {busy ? "Submitting…" : "Submit for review"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
