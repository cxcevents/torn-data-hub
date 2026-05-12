import { Link } from "wouter";
import { useApiKey } from "@/hooks/use-api-key";
import { Moon, Sun, RefreshCw, Lock, LockOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useTornUser } from "@/hooks/use-torn-user";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useLayoutLock } from "@/hooks/use-layout-lock";
import { Sidebar } from "@/components/sidebar";
import { useActiveUsers } from "@/hooks/use-active-users";

function pad(n: number) { return String(n).padStart(2, "0"); }

function formatTime(date: Date, utc: boolean): string {
  if (utc) {
    return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  }
  const h24 = date.getHours();
  const h12 = h24 % 12 || 12;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${h12}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${ampm}`;
}

function NavClocks() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="hidden lg:flex items-center gap-4 border-l pl-4 ml-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70 leading-none">Torn</span>
        <span className="font-mono text-sm font-semibold tabular-nums text-foreground leading-none">
          {formatTime(now, true)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 leading-none">Local</span>
        <span className="font-mono text-sm tabular-nums text-muted-foreground leading-none">
          {formatTime(now, false)}
        </span>
      </div>
    </div>
  );
}

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { apiKey } = useApiKey();
  const { theme, setTheme } = useTheme();
  const { data, refetch, isFetching } = useTornUser(apiKey);
  const { count: activeUsers } = useActiveUsers();
  const [nextRefresh, setNextRefresh] = useState(30);
  const { locked, toggleLock } = useLayoutLock();

  useEffect(() => {
    if (!apiKey) return;
    const interval = setInterval(() => {
      setNextRefresh((prev) => {
        if (prev <= 1) { refetch(); return 30; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [apiKey, refetch]);

  const handleManualRefresh = () => { refetch(); setNextRefresh(30); };
  const maskedKey = apiKey ? `••••••••${apiKey.slice(-4)}` : "";

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">

      {/* ── Persistent Header ── */}
      <header className="flex-shrink-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
        <div className="px-4 h-full flex items-center justify-between">

          {/* Left: logo + player + clocks */}
          <div className="flex items-center gap-4">
            <Link href="/" className="font-bold text-xl text-primary flex items-center gap-2">
              <span className="bg-primary text-primary-foreground px-2 py-1 rounded-md text-sm leading-none">TORN</span>
              DASHBOARD
            </Link>
            {data?.name && (
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground border-l pl-4">
                <span className="font-medium text-foreground">{data.name}</span>
                <span>[{data.player_id}]</span>
              </div>
            )}
            <NavClocks />
          </div>

          {/* Right: active users + refresh + lock + theme */}
          <div className="flex items-center gap-2 md:gap-3">
            {activeUsers !== null && (
              <div
                className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground border border-border/50 rounded-md px-2 py-1"
                title="Anonymous count of users currently viewing the dashboard"
              >
                <Users className="h-3 w-3 text-primary/60" />
                <span className="tabular-nums font-medium">{activeUsers}</span>
                <span className="text-muted-foreground/60">online</span>
              </div>
            )}
            {apiKey && (
              <div className="hidden md:flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{maskedKey}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">Refresh in <span className="inline-block w-5 text-right tabular-nums">{nextRefresh}</span>s</span>
                  <Button variant="ghost" size="icon" onClick={handleManualRefresh} disabled={isFetching} className="h-8 w-8">
                    <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin text-primary" : ""}`} />
                  </Button>
                </div>
              </div>
            )}
            <button
              onClick={toggleLock}
              title={locked ? "Unlock layout" : "Lock layout"}
              className={cn(
                "h-9 w-9 flex items-center justify-center rounded-md transition-colors",
                !locked ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
            </button>
            <Button
              variant="ghost" size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* ── Body row: sidebar + main ── */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
