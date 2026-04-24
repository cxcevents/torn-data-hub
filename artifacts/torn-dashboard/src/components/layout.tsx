import { Link, useLocation } from "wouter";
import { useApiKey } from "@/hooks/use-api-key";
import { Settings, Code, Moon, Sun, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useTornUser } from "@/hooks/use-torn-user";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

interface NavIconProps {
  href: string;
  icon: React.ReactNode;
  currentPath: string;
  navigate: (to: string) => void;
}

function NavIcon({ href, icon, currentPath, navigate }: NavIconProps) {
  const isActive = currentPath === href;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isActive) {
      navigate("/");
    } else {
      navigate(href);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "h-9 w-9 flex items-center justify-center rounded-md transition-colors",
        isActive
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {icon}
    </button>
  );
}

export function Layout({ children }: LayoutProps) {
  const { apiKey } = useApiKey();
  const { theme, setTheme } = useTheme();
  const { data, refetch, isFetching } = useTornUser(apiKey);
  const [nextRefresh, setNextRefresh] = useState(30);
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!apiKey) return;
    const interval = setInterval(() => {
      setNextRefresh((prev) => {
        if (prev <= 1) {
          refetch();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [apiKey, refetch]);

  const handleManualRefresh = () => {
    refetch();
    setNextRefresh(30);
  };

  const maskedKey = apiKey ? `••••••••${apiKey.slice(-4)}` : "";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
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
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {apiKey && (
              <div className="hidden md:flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{maskedKey}</span>
                <div className="flex items-center gap-2">
                  <span>Auto-refresh in {nextRefresh}s</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleManualRefresh}
                    disabled={isFetching}
                    className="h-8 w-8"
                  >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin text-primary" : ""}`} />
                  </Button>
                </div>
              </div>
            )}

            <nav className="flex items-center gap-1">
              <NavIcon href="/raw" icon={<Code className="h-4 w-4" />} currentPath={location} navigate={navigate} />
              <NavIcon href="/settings" icon={<Settings className="h-4 w-4" />} currentPath={location} navigate={navigate} />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
