import { useState } from "react";
import { X } from "lucide-react";
import { detectLocationPlatform } from "@/lib/location-permission";

/** Sticky, automatic alert for the stop the rider needs to get off at. */
export function LocationBlockedCard({ onDismiss }: { onDismiss: () => void }) {
  const platform = useState(() =>
    typeof navigator === "undefined"
      ? "desktop"
      : detectLocationPlatform(
          navigator.userAgent,
          typeof document !== "undefined" && "ontouchend" in document,
        ),
  )[0] as ReturnType<typeof detectLocationPlatform>;

  const steps =
    platform === "ios"
      ? {
          label: "iPhone or iPad · Safari",
          body: (
            <>
              Tap the <strong className="font-semibold">aA</strong> or page-settings icon in your
              address bar, open <strong className="font-semibold">Website Settings</strong>, change{" "}
              <strong className="font-semibold">Location</strong> to{" "}
              <strong className="font-semibold">Allow</strong>, then refresh.
            </>
          ),
        }
      : platform === "android"
        ? {
            label: "Chrome · Android",
            body: (
              <>
                Tap the <strong className="font-semibold">tune / lock</strong> icon next to the URL,
                open <strong className="font-semibold">Permissions</strong>, set{" "}
                <strong className="font-semibold">Location</strong> to{" "}
                <strong className="font-semibold">Allow</strong>, then refresh.
              </>
            ),
          }
        : {
            label: "Chrome or Edge · desktop",
            body: (
              <>
                Click the <strong className="font-semibold">lock</strong> icon in the address bar,
                open <strong className="font-semibold">Site settings</strong>, set{" "}
                <strong className="font-semibold">Location</strong> to{" "}
                <strong className="font-semibold">Allow</strong>, then reload.
              </>
            ),
          };

  return (
    <div
      className="relative rounded-lg border border-chart-4/40 bg-surface-raised p-4 pr-9"
      role="status"
    >
      <p className="text-sm font-semibold text-foreground">Location is blocked</p>
      <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">{steps.label}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground">{steps.body}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Nalu also works without location — you can always pick a station by hand.
      </p>
      <button
        type="button"
        aria-label="Dismiss location help"
        onClick={onDismiss}
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
