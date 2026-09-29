import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountSection } from "./AccountSection";

export type PlacesSyncStatus = "idle" | "loading" | "saving" | "synced" | "error";

export function AccountButton({ onClick }: { onClick: () => void }) {
  const { user, loading } = useAuth();
  const name =
    typeof user?.user_metadata?.["full_name"] === "string"
      ? (user.user_metadata["full_name"] as string)
      : (user?.email ?? "Nalu rider");
  return (
    <Button
      variant={user ? "outline" : "default"}
      size="sm"
      onClick={onClick}
      disabled={loading}
      aria-label={user ? "Open your account" : "Sign in"}
      className={user ? "size-10 shrink-0 rounded-full p-0 font-bold" : "shrink-0 rounded-full"}
    >
      {loading ? "Checking…" : user ? name[0]?.toUpperCase() : "Sign in"}
    </Button>
  );
}

export function AccountDialog({
  open,
  onClose,
  restoreLabel,
  restored,
  syncStatus,
  onRetry,
  onSearch,
  onStart,
  placeLabels,
}: {
  open: boolean;
  onClose: () => void;
  restoreLabel: string | null;
  restored: boolean;
  syncStatus: PlacesSyncStatus;
  onRetry: () => void;
  onSearch: () => void;
  onStart: () => void;
  placeLabels: string[];
}) {
  const { user, loading } = useAuth();
  const syncing = syncStatus === "idle" || syncStatus === "loading" || syncStatus === "saving";
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle>
            {user ? "Your account" : restoreLabel ? `Set your ${restoreLabel}` : "Sign in to Nalu"}
          </DialogTitle>
          <DialogDescription>
            {user
              ? "Your saved places, ready when you need them."
              : restoreLabel
                ? "Sign in to restore saved places, or search for an address to save on this device."
                : "Restore your Home and Work and keep your saved places across devices."}
          </DialogDescription>
        </DialogHeader>
        {loading ? <p role="status">Checking your session…</p> : <AccountSection compact />}
        {user && (
          <div className="space-y-2 text-sm" role="status">
            <p>
              {syncStatus === "synced"
                ? "Saved places synced to your account."
                : syncStatus === "error"
                  ? "Saved places could not sync. Your places on this device are still available."
                  : "Syncing your saved places…"}
            </p>
            {syncStatus === "synced" && (
              <p className="text-muted-foreground">
                {placeLabels.length
                  ? placeLabels.join(" · ")
                  : "No saved places yet. Add Home or Work to get started."}
              </p>
            )}
            {syncStatus === "error" && (
              <Button variant="outline" onClick={onRetry}>
                Retry sync
              </Button>
            )}
          </div>
        )}
        {restoreLabel && (
          <div className="space-y-2 border-t border-border pt-3">
            {restored && (
              <Button className="w-full" onClick={onStart}>
                Plan a trip to {restoreLabel}
              </Button>
            )}
            {!restored && (
              <Button
                className="w-full"
                variant="outline"
                disabled={loading || Boolean(user && syncing)}
                onClick={onSearch}
              >
                {user ? `Set ${restoreLabel} address` : "Search an address on this device"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
