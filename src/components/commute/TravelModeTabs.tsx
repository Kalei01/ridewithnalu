import { Bus, Car, Footprints, TrainFront } from "lucide-react";
import { Button } from "@/components/ui/button";

type TravelModeTabsProps = {
  selectedMode: "drive" | "transit";
  commitment: boolean;
  transitLabel: string;
  transitUsesRail: boolean;
  transitUsesBus: boolean;
  transitMinutes: number | null;
  driveMinutes: number | null;
  arriveByActive: boolean;
  bestTransitMinutes: number | null;
  transitWinner: boolean;
  driveWinner: boolean;
  lockedMode: "drive" | "transit" | null;
  formatMinutes: (minutes: number) => string;
  onModeChange: (mode: "drive" | "transit") => void;
};

export function TravelModeTabs({
  selectedMode, commitment, transitLabel, transitUsesRail, transitUsesBus, transitMinutes,
  driveMinutes, arriveByActive, bestTransitMinutes, transitWinner, driveWinner, lockedMode,
  formatMinutes, onModeChange,
}: TravelModeTabsProps) {
  const selected = "bg-recommended text-recommended-foreground hover:bg-recommended";
  const inactive = "text-muted-foreground";
  return (
    <div role="group" aria-label="Travel mode" className="glass-panel grid grid-cols-2 gap-1 rounded-lg p-1">
      <Button type="button" aria-pressed={selectedMode === "transit"} disabled={commitment} variant="ghost"
        onClick={() => onModeChange("transit")}
        className={`relative h-14 disabled:opacity-100 ${selectedMode === "transit" ? selected : commitment ? "opacity-35" : inactive}`}>
        {transitUsesRail ? <TrainFront /> : transitUsesBus ? <Bus /> : <Footprints />}{" "}
        {transitLabel}{" "}
        {arriveByActive && bestTransitMinutes !== null ? `· ${bestTransitMinutes} min` : transitMinutes !== null ? `· ${formatMinutes(transitMinutes)}` : ""}
        {!commitment && transitWinner && <span className="mode-winner-badge">Faster than driving</span>}
        {lockedMode === "transit" && <span className="mode-winner-badge">On this trip</span>}
      </Button>
      <Button type="button" aria-pressed={selectedMode === "drive"} disabled={commitment} variant="ghost"
        onClick={() => onModeChange("drive")}
        className={`relative h-14 disabled:opacity-100 ${selectedMode === "drive" ? selected : commitment ? "opacity-35" : inactive}`}>
        <Car /> Drive {driveMinutes !== null ? `· ${formatMinutes(driveMinutes)}` : ""}
        {!commitment && driveWinner && <span className="mode-winner-badge">Faster than transit</span>}
        {lockedMode === "drive" && <span className="mode-winner-badge">On this trip</span>}
      </Button>
    </div>
  );
}