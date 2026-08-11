import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { PenLine, ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApiKey } from "@/hooks/use-api-key";
import { useTornUser } from "@/hooks/use-torn-user";
import { CATEGORIES, AUDIENCES, type GuideCategory, type GuideAudience } from "@/lib/guides";
import { submitGuide, editGuide, fetchGuide } from "@/lib/guides-api";

const ADMIN_PLAYER_ID = 2032555;

export default function GuideSubmit() {
  const [, navigate] = useLocation();
  const [, editParams] = useRoute("/guides/:slug/edit");
  const editSlug = editParams?.slug ?? null;
  const { apiKey } = useApiKey();
  const { data: user } = useTornUser(apiKey);

  const [guideId, setGuideId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<GuideCategory>("getting-started");
  const [audience, setAudience] = useState<GuideAudience>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "submitted" | "edited-live" | "edited-pending">(null);
  const [loadingEdit, setLoadingEdit] = useState(!!editSlug);

  // Edit mode: prefill from the existing guide.
  useEffect(() => {
    if (!editSlug) return;
    fetchGuide(editSlug)
      .then(({ guide }) => {
        setGuideId(guide.id);
        setTitle(guide.title);
        setSummary(guide.summary ?? "");
        setBody(guide.body);
        setCategory(guide.category);
        setAudience(guide.audience);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingEdit(false));
  }, [editSlug]);

  const isEdit = !!editSlug;

  const submit = async () => {
    if (!apiKey) { setError("Set your Torn API key on the dashboard first — it's how we know who wrote the guide."); return; }
    setBusy(true);
    setError(null);
    try {
      if (isEdit && guideId) {
        const r = await editGuide(guideId, { apiKey, title, summary, body, category, audience });
        setDone(r.status === "approved" ? "edited-live" : "edited-pending");
      } else {
        await submitGuide({ apiKey, title, summary, body, category, audience });
        setDone("submitted");
      }
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
            <div className="font-semibold text-lg">
              {done === "submitted" ? "Guide submitted!" : "Changes saved!"}
            </div>
            <p className="text-sm text-muted-foreground">
              {done === "edited-live"
                ? "Your changes are live."
                : done === "edited-pending"
                  ? "Your updated guide is back in the review queue — it will reappear on the Guides page once it's re-approved."
                  : "It's now in the review queue. Once it's approved it will appear on the Guides page for everyone."}
            </p>
            <Button variant="outline" onClick={() => navigate("/guides")} data-testid="button-back-to-guides">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Guides
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadingEdit) {
    return <div className="max-w-2xl mx-auto text-sm text-muted-foreground py-8 text-center">Loading guide…</div>;
  }

  const field = "w-full bg-card border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/60 placeholder:text-muted-foreground";
  const isAdmin = user?.player_id === ADMIN_PLAYER_ID;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <button onClick={() => navigate("/guides")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
          <ArrowLeft className="w-4 h-4" /> Guides
        </button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PenLine className="w-6 h-6 text-primary" />
          {isEdit ? "Edit guide" : "Write a guide"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEdit
            ? isAdmin
              ? "Your edits go live immediately."
              : "Edited guides go back through review before the changes appear."
            : "Share what you know. Submissions are reviewed before they go live."}
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
            <label className="text-sm font-medium">Short summary <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea className={cn(field, "min-h-[60px] resize-y")} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300}
              placeholder="One or two sentences shown on the guide card. Leave blank to use the start of the guide." data-testid="input-guide-summary" />
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

          <Button onClick={submit} disabled={busy || title.trim().length < 8 || body.trim().length < 100} data-testid="button-submit-guide">
            <Send className="w-4 h-4 mr-2" />
            {busy ? "Saving…" : isEdit ? "Save changes" : "Submit for review"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
