import { Link } from "@tanstack/react-router";
import { MapPin, Settings } from "lucide-react";
import { AccountButton } from "@/components/account/AccountDialog";
import { Button } from "@/components/ui/button";
import { WaveMark } from "@/components/commute/NaluPersonalityStrip";

export function CommuteHeader({
  heading,
  timeText,
  onAccount,
  onSettings,
  onBrowse,
}: {
  heading: string;
  timeText: string;
  onAccount: () => void;
  onSettings: () => void;
  /** Opens the Browse view; replaces the separate Nalu/Browse row on the trip screen. */
  onBrowse?: () => void;
}) {
  return (
    <header className="mt-4 flex min-h-11 items-center justify-between gap-3">
      <div className="min-w-0">
        <Link to="/welcome" className="nalu-brand flex min-h-11 items-center gap-2.5" aria-label="About Nalu">
          <WaveMark className="nalu-honu h-8 w-12" />
          <span className="nalu-brand-title text-lg font-semibold tracking-wide">Nalu</span>
        </Link>
        <p className="text-xs font-semibold uppercase text-muted-foreground">{heading}</p>
        <p className="text-sm text-foreground">{timeText}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onBrowse && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Browse nearby transit"
            onClick={onBrowse}
            className="size-11 rounded-full text-muted-foreground hover:text-foreground"
          >
            <MapPin className="size-5" />
          </Button>
        )}
        <AccountButton onClick={onAccount} />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open settings"
          onClick={onSettings}
          className="size-11 rounded-full text-muted-foreground hover:text-foreground"
        >
          <Settings className="size-5" />
        </Button>
      </div>
    </header>
  );
}
