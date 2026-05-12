import { TrendingUp, Construction } from "lucide-react";

export default function LevelingTargets() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Leveling Targets</h1>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
            N00b T00ls
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Find optimal targets to fight for maximum battle experience gain.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center">
          <Construction className="w-6 h-6 text-muted-foreground/60" />
        </div>
        <div>
          <p className="text-lg font-bold">Work in Progress</p>
          <p className="text-sm text-muted-foreground mt-1">
            This tool is under construction. Check back soon.
          </p>
        </div>
      </div>
    </div>
  );
}
