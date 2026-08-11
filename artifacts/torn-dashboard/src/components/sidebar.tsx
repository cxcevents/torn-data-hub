import { useState } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard, Settings, Code, Users, Wrench, TrendingUp,
  ChevronLeft, ChevronRight, ChevronDown, Shield, Chrome, Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const SIDEBAR_KEY = "torn_sidebar_collapsed";
const TOOLS_KEY = "torn_sidebar_tools_open";

interface SidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  indent?: boolean;
}

function SidebarLink({ href, icon, label, collapsed, indent }: SidebarLinkProps) {
  const [location, navigate] = useLocation();
  const isActive = location === href || (href !== "/" && location.startsWith(href));

  return (
    <button
      onClick={() => navigate(href)}
      title={collapsed ? label : undefined}
      className={cn(
        "w-full flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors text-left",
        indent && !collapsed && "pl-7",
        isActive
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "true"; } catch { return false; }
  });
  const [toolsOpen, setToolsOpen] = useState(() => {
    try { return localStorage.getItem(TOOLS_KEY) !== "false"; } catch { return true; }
  });

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch {}
      return next;
    });
  };

  const toggleTools = () => {
    if (collapsed) { toggleCollapse(); return; }
    setToolsOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(TOOLS_KEY, String(next)); } catch {}
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "flex-shrink-0 border-r bg-background flex flex-col transition-all duration-200 overflow-hidden",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* ── Primary nav (top) ── */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
        <SidebarLink
          href="/"
          icon={<LayoutDashboard className="w-4 h-4" />}
          label="Dashboard"
          collapsed={collapsed}
        />
        <SidebarLink
          href="/chrome-extension"
          icon={<Chrome className="w-4 h-4" />}
          label="Chrome Extension"
          collapsed={collapsed}
        />
        <SidebarLink
          href="/pda-plugin"
          icon={<Smartphone className="w-4 h-4" />}
          label="PDA Plugin"
          collapsed={collapsed}
        />

        <div className="my-2 border-t border-border/50" />

        {/* N00b T00ls collapsible section */}
        <div>
          <button
            onClick={toggleTools}
            title={collapsed ? "N00b T00ls" : undefined}
            className={cn(
              "w-full flex items-center gap-3 rounded-md px-2 py-2 text-xs font-bold uppercase tracking-widest transition-colors",
              "text-muted-foreground/70 hover:text-muted-foreground hover:bg-accent"
            )}
          >
            <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
              <Wrench className="w-3.5 h-3.5" />
            </span>
            {!collapsed && (
              <>
                <span className="flex-1 text-left truncate">N00b T00ls</span>
                <motion.span
                  animate={{ rotate: toolsOpen ? 0 : -90 }}
                  transition={{ duration: 0.15 }}
                >
                  <ChevronDown className="w-3 h-3" />
                </motion.span>
              </>
            )}
          </button>

          <AnimatePresence initial={false}>
            {(toolsOpen || collapsed) && (
              <motion.div
                key="tools"
                initial={collapsed ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div className="space-y-0.5 mt-0.5">
                  <SidebarLink
                    href="/tools/pi-scout"
                    icon={<Users className="w-4 h-4" />}
                    label="PI Marriage Scout"
                    collapsed={collapsed}
                    indent
                  />
                  <SidebarLink
                    href="/tools/leveling-targets"
                    icon={<TrendingUp className="w-4 h-4" />}
                    label="Leveling Targets"
                    collapsed={collapsed}
                    indent
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* ── Utility nav (bottom-anchored) ── */}
      <div className="p-2 border-t border-border/50 space-y-0.5">
        {isAdmin && (
          <SidebarLink
            href="/admin"
            icon={<Shield className="w-4 h-4" />}
            label="Admin"
            collapsed={collapsed}
          />
        )}
        <SidebarLink
          href="/settings"
          icon={<Settings className="w-4 h-4" />}
          label="Settings"
          collapsed={collapsed}
        />
        <SidebarLink
          href="/raw"
          icon={<Code className="w-4 h-4" />}
          label="Raw API Data"
          collapsed={collapsed}
        />

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-full flex items-center justify-center gap-2 rounded-md px-2 py-2 mt-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs font-medium">Collapse</span>
              </>
            )
          }
        </button>
      </div>
    </aside>
  );
}
