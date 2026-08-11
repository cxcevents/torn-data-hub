import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, Search, MessageSquare, PenLine, Sprout, Sword, X, ThumbsUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CATEGORIES, AUDIENCES, type GuideCategory, type GuideAudience } from "@/lib/guides";
import { fetchGuides, type GuideListItem } from "@/lib/guides-api";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        active
          ? "bg-primary/15 border-primary/50 text-primary"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

export default function Guides() {
  const [, navigate] = useLocation();
  const [category, setCategory] = useState<GuideCategory | null>(null);
  const [audience, setAudience] = useState<GuideAudience | null>(null);
  const [query, setQuery] = useState("");
  const [guides, setGuides] = useState<GuideListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGuides().then(setGuides).catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    return (guides ?? []).filter((g) => {
      if (category && g.category !== category) return false;
      if (audience && g.audience !== audience && g.audience !== "all") return false;
      if (query) {
        const q = query.toLowerCase();
        if (!g.title.toLowerCase().includes(q) && !g.summary.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [guides, category, audience, query]);

  const hasFilters = category !== null || audience !== null || query !== "";
  const catLabel = (id: GuideCategory) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Guides
          </h1>
          <p className="text-muted-foreground mt-1">
            Practical Torn guides — from your first day out of the tutorial to running faction wars.
          </p>
        </div>
        <Button onClick={() => navigate("/guides/submit")} data-testid="button-write-guide">
          <PenLine className="w-4 h-4 mr-2" />
          Write a guide
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search guides…"
          data-testid="input-guide-search"
          className="w-full bg-card border border-border rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/60 placeholder:text-muted-foreground"
        />
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs uppercase tracking-widest text-muted-foreground/70 font-bold mr-1">
            Category
          </span>
          {CATEGORIES.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(category === c.id ? null : c.id)}>
              {c.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs uppercase tracking-widest text-muted-foreground/70 font-bold mr-1">
            For
          </span>
          {AUDIENCES.filter((a) => a.id !== "all").map((a) => (
            <Chip key={a.id} active={audience === a.id} onClick={() => setAudience(audience === a.id ? null : a.id)}>
              {a.label}
            </Chip>
          ))}
          {hasFilters && (
            <button
              onClick={() => { setCategory(null); setAudience(null); setQuery(""); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-1"
              data-testid="button-clear-filters"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Guide list */}
      {error ? (
        <Card><CardContent className="py-8 text-center text-sm text-destructive">Couldn't load guides: {error}</CardContent></Card>
      ) : guides === null ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Loading guides…</CardContent></Card>
      ) : filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((g) => (
            <Card
              key={g.slug}
              className="hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => navigate(`/guides/${g.slug}`)}
              data-testid={`card-guide-${g.slug}`}
            >
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                    {catLabel(g.category)}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {g.audience === "new" ? <Sprout className="w-3 h-3" /> : g.audience === "established" ? <Sword className="w-3 h-3" /> : null}
                    {AUDIENCES.find((a) => a.id === g.audience)?.label}
                  </span>
                </div>
                <div className="font-semibold">{g.title}</div>
                <p className="text-sm text-muted-foreground line-clamp-2">{g.summary}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                  <span className={cn("flex items-center gap-1", g.score > 0 && "text-green-500", g.score < 0 && "text-red-500")}>
                    <ThumbsUp className="w-3 h-3" /> {g.score > 0 ? `+${g.score}` : g.score}
                  </span>
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {g.comments}</span>
                  <span>by {g.authorName}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/50" />
            {guides.length === 0 ? (
              <>
                <div className="font-medium">No guides yet — be the first to write one.</div>
                <p className="text-sm text-muted-foreground">
                  Guides for new players, leveling, faction life, money making, and more will live
                  here. Hit "Write a guide" to submit the first one.
                </p>
              </>
            ) : (
              <>
                <div className="font-medium">No guides match those filters.</div>
                <p className="text-sm text-muted-foreground">Try clearing a filter or changing your search.</p>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
