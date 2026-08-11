import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import Raw from "@/pages/Raw";
import Extension from "@/pages/Extension";
import PdaPlugin from "@/pages/PdaPlugin";
import Guides from "@/pages/Guides";
import GuideSubmit from "@/pages/GuideSubmit";
import GuideDetail from "@/pages/GuideDetail";
import PiMarriageScout from "@/pages/tools/PiMarriageScout";
import LevelingTargets from "@/pages/tools/LevelingTargets";
import MeritScout from "@/pages/tools/MeritScout";
import Admin from "@/pages/Admin";
import { Layout } from "@/components/layout";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/settings" component={Settings} />
        <Route path="/raw" component={Raw} />
        <Route path="/chrome-extension" component={Extension} />
        <Route path="/pda-plugin" component={PdaPlugin} />
        <Route path="/guides" component={Guides} />
        <Route path="/guides/submit" component={GuideSubmit} />
        <Route path="/guides/:slug" component={GuideDetail} />
        <Route path="/tools/pi-scout" component={PiMarriageScout} />
        <Route path="/tools/leveling-targets" component={LevelingTargets} />
        <Route path="/tools/merit-scout" component={MeritScout} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
