import { useEffect, useState, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, ThumbsUp, ThumbsDown, MessageSquare, Send, Trash2, Sprout, Sword, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApiKey } from "@/hooks/use-api-key";
import { useTornUser } from "@/hooks/use-torn-user";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { CATEGORIES, AUDIENCES } from "@/lib/guides";
import {
  fetchGuide, voteGuide, commentGuide, adminDeleteComment,
  type GuideDetail as GuideData, type GuideComment,
} from "@/lib/guides-api";


// Guide bodies are sanitized HTML from the server (rich text editor).
// Legacy plain-text guides fall back to paragraph splitting.
function GuideBody({ text }: { text: string }) {
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return <div className="guide-prose" dangerouslySetInnerHTML={{ __html: text }} />;
  }
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">{block}</p>
      ))}
    </div>
  );
}

export default function GuideDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/guides/:slug");
  const slug = params?.slug ?? "";
  const { apiKey } = useApiKey();
  const { data: user } = useTornUser(apiKey);
  const { isAdmin } = useIsAdmin(apiKey);

  const [guide, setGuide] = useState<GuideData | null>(null);
  const [comments, setComments] = useState<GuideComment[]>([]);
  const [myVote, setMyVote] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchGuide(slug, apiKey)
      .then((d) => { setGuide(d.guide); setComments(d.comments); setMyVote(d.myVote); })
      .catch((e) => setError(e.message));
  }, [slug, apiKey]);

  useEffect(() => { if (slug) load(); }, [slug, load]);

  const vote = async (value: 1 | -1) => {
    if (!apiKey || !guide) { setActionError("Set your Torn API key on the dashboard to vote."); return; }
    const next = myVote === value ? 0 : value;
    try {
      const r = await voteGuide(guide.id, apiKey, next);
      setMyVote(r.myVote);
      setGuide({ ...guide, score: r.score });
      setActionError(null);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const postComment = async () => {
    if (!apiKey || !guide) { setActionError("Set your Torn API key on the dashboard to comment."); return; }
    setBusy(true);
    try {
      const r = await commentGuide(guide.id, apiKey, commentText);
      setComments((c) => [...c, r.comment]);
      setCommentText("");
      setActionError(null);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deleteComment = async (id: number) => {
    if (!apiKey) return;
    try {
      await adminDeleteComment(id, apiKey);
      setComments((c) => c.filter((x) => x.id !== id));
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  if (error) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <button onClick={() => navigate("/guides")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Guides
        </button>
        <Card><CardContent className="py-8 text-center text-sm text-destructive">{error}</CardContent></Card>
      </div>
    );
  }
  if (!guide) {
    return <div className="max-w-3xl mx-auto text-sm text-muted-foreground py-8 text-center">Loading guide…</div>;
  }

  const catLabel = CATEGORIES.find((c) => c.id === guide.category)?.label ?? guide.category;
  const audLabel = AUDIENCES.find((a) => a.id === guide.audience)?.label;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <button onClick={() => navigate("/guides")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
          <ArrowLeft className="w-4 h-4" /> Guides
        </button>
        <div className="flex items-center gap-2 text-xs mb-2">
          <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">{catLabel}</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            {guide.audience === "new" ? <Sprout className="w-3 h-3" /> : guide.audience === "established" ? <Sword className="w-3 h-3" /> : null}
            {audLabel}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{guide.title}</h1>
          {(user?.player_id === guide.authorId || isAdmin) && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/guides/${guide.slug}/edit`)} data-testid="button-edit-guide">
              <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          by{" "}
          <a href={`https://www.torn.com/profiles.php?XID=${guide.authorId}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {guide.authorName} [{guide.authorId}]
          </a>
          {guide.publishedAt && <> · {new Date(guide.publishedAt).toLocaleDateString()}</>}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <GuideBody text={guide.body} />
        </CardContent>
      </Card>

      {/* Vote bar */}
      <div className="flex items-center gap-3">
        <Button variant={myVote === 1 ? "default" : "outline"} size="sm" onClick={() => vote(1)} data-testid="button-vote-up">
          <ThumbsUp className="w-4 h-4 mr-2" /> Helpful
        </Button>
        <Button variant={myVote === -1 ? "destructive" : "outline"} size="sm" onClick={() => vote(-1)} data-testid="button-vote-down">
          <ThumbsDown className="w-4 h-4" />
        </Button>
        <span className={cn("text-sm font-medium", guide.score > 0 && "text-green-500", guide.score < 0 && "text-red-500")} data-testid="text-guide-score">
          {guide.score > 0 ? `+${guide.score}` : guide.score}
        </span>
      </div>
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {/* Comments */}
      <div className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Comments ({comments.length})
        </h2>

        {comments.map((c) => (
          <Card key={c.id}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>
                  <a href={`https://www.torn.com/profiles.php?XID=${c.playerId}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                    {c.playerName}
                  </a>{" "}
                  · {new Date(c.createdAt).toLocaleString()}
                </span>
                {isAdmin && (
                  <button onClick={() => deleteComment(c.id)} className="text-muted-foreground hover:text-destructive" title="Delete comment" data-testid={`button-delete-comment-${c.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.body}</p>
            </CardContent>
          </Card>
        ))}
        {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet — be the first.</p>}

        <div className="flex gap-2">
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && commentText.trim().length >= 2 && !busy) postComment(); }}
            placeholder="Add a comment…"
            maxLength={2000}
            data-testid="input-comment"
            className="flex-1 bg-card border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/60 placeholder:text-muted-foreground"
          />
          <Button size="sm" onClick={postComment} disabled={busy || commentText.trim().length < 2} data-testid="button-post-comment">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
