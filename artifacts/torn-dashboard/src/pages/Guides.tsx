import { useMemo, useState } from "react";
import { BookOpen, Search, Clock, Sprout, Sword, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GUIDES, CATEGORIES, AUDIENCES, type GuideCategory, type GuideAudience } from "@/lib/guides";

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
  const [category, setCategory] = useState<GuideCategory | null>(null);
  const [audience, setAudience] = useState<GuideAudience | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return GUIDES.filter((g) => {
      if (category && g.category !== category) return false;
      if (audience && g.audience !== audience && g.audience !== "all") return false;
      if (query) {
        const q = query.toLowerCase();
        if (!g.title.toLowerCase().includes(q) && !g.summary.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [category, audience, query]);

  const hasFilters = category !== null || audience !== null || query !== "";
  const catLabel = (id: GuideCategory) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          Guides
        </h1>
        <p className="text-muted-foreground mt-1">
          Practical Torn guides — from your first day out of the tutorial to running faction wars.
        </p>
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
      {filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((g) => (
            <Card key={g.slug} className="hover:border-primary/40 transition-colors cursor-pointer">
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
                <p className="text-sm text-muted-foreground">{g.summary}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                  {g.minutes ? (
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {g.minutes} min read</span>
                  ) : null}
                  <span>Updated {new Date(g.updated).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/50" />
            {GUIDES.length === 0 ? (
              <>
                <div className="font-medium">No guides yet — they're coming soon.</div>
                <p className="text-sm text-muted-foreground">
                  This is where you'll find guides for new players, leveling, faction life, money
                  making, and more.
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
