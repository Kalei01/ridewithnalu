import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
export type PlanMode = "leave-now" | "arrive-by";
export function ArriveByControls({ mode, time, destination, onModeChange, onTimeChange, children }: { mode: PlanMode; time: string; destination: string; onModeChange: (mode: PlanMode) => void; onTimeChange: (time: string) => void; children?: React.ReactNode }) {
  return <section className="mt-4 rounded-lg border border-border bg-surface-raised p-4" aria-label="Trip time">
    <div role="tablist" aria-label="Planning mode" className="grid grid-cols-2 gap-1 rounded-full bg-background/60 p-1">
      <Button type="button" role="tab" aria-selected={mode === "leave-now"} variant="ghost" onClick={() => onModeChange("leave-now")} className={`h-11 rounded-full ${mode === "leave-now" ? "bg-recommended text-recommended-foreground" : "text-muted-foreground"}`}>Leave now</Button>
      <Button type="button" role="tab" aria-selected={mode === "arrive-by"} variant="ghost" onClick={() => onModeChange("arrive-by")} className={`h-11 rounded-full ${mode === "arrive-by" ? "bg-recommended text-recommended-foreground" : "text-muted-foreground"}`}>Arrive by</Button>
    </div>
    {mode === "arrive-by" && <div className="mt-4"><Label htmlFor="arrive-by-time" className="text-xs font-semibold uppercase text-muted-foreground">Be at {destination} by</Label><Input id="arrive-by-time" type="time" value={time} onChange={(event) => onTimeChange(event.target.value)} className="mt-2 h-12 bg-background/60 text-2xl font-bold tabular-nums" />{children}</div>}
  </section>;
}
