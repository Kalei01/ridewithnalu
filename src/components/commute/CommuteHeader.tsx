import { Settings } from "lucide-react";
import { AccountButton } from "@/components/account/AccountDialog";
import { Button } from "@/components/ui/button";
import { WaveMark } from "@/components/commute/NaluPersonalityStrip";

export function CommuteHeader({
  heading,
  timeText,
  onAccount,
  onSettings,
}: {
  heading: string;
  timeText: string;
  onAccount: () => void;
  onSettings: () => void;
}) {
  return (
    <header className="mt-5 flex min-h-11 items-center justify-between">
      <div>
        <div className="flex items-center gap-1.5">
          <div className="nalu-brand flex items-center gap-2.5">
            <WaveMark className="nalu-honu h-8 w-12" />
            <p className="nalu-brand-title text-lg font-semibold tracking-wide">Nalu</p>
          </div>
        </div>
        <div className="mt-1.5 h-px bg-border/70" />
        <p className="mt-1 text-xs font-semibold uppercase text-muted-foreground">{heading}</p>
        <p className="mt-1 text-[15px] font-medium text-foreground">{timeText}</p>
      </div>
      <div className="flex items-center gap-1">
        <AccountButton onClick={onAccount} />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open settings"
          onClick={onSettings}
          className="rounded-full text-muted-foreground hover:text-foreground"
        >
          <Settings className="size-5" />
        </Button>
      </div>
    </header>
  );
}
