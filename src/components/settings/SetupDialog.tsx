import { activeRegion } from "@/lib/region";
import { Tagline } from "@/components/brand/Tagline";
import { VoiceSection } from "@/components/settings/VoiceSection";
import { readVoiceLabel } from "@/lib/best-voice";
import { APP_VERSION } from "@/lib/site";
import { readPushPrefs } from "@/lib/push-client";
import { Link } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronRight,
  MapPin,
  LocateFixed,
  Navigation,
  Settings,
  UserRound,
  X,
  Bell,
  ChevronLeft,
  Info,
  ShieldCheck,
  Vibrate,
  Volume2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { reverseGeocode, searchPlaces } from "@/lib/geocode.functions";
import { SettingsExpiryBanner } from "@/components/commute/DataExpiry";
import { playChime, type AlertPrefs } from "@/lib/approach";
import { isPermissionDeniedError, queryLocationPermission } from "@/lib/location-permission";
import {
  clockInputValue,
  commutePresets,
  findByKind,
  kindLabel,
  hasValidCoordinates,
  parseClockInput,
  removePlace,
  swapHomeWork,
  upsertPlace,
  PLACE_KINDS,
  type PlaceKind,
  type SavedPlace,
} from "@/lib/saved-places";
import { WaveMark } from "@/components/commute/NaluPersonalityStrip";
import { AccountSection } from "@/components/account/AccountSection";
import { useAuth } from "@/hooks/use-auth";
import { NotificationsSection } from "@/components/account/NotificationsSection";
import { PrivacySection } from "@/components/account/PrivacySection";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TellNaluForm } from "@/components/TellNalu";
import { addRecent } from "@/lib/places/recents";
import { formatDistance, stationLabel } from "@/lib/commute-formatting";
import { LOCATION_DENIED_KEY, PointLike, Setup, profileFirstName } from "@/lib/commute-model";
import { QuickPlaces, shortcutIcon } from "@/components/places/Shortcuts";
import { useRailStations } from "@/hooks/use-rail-stations";
import { LocationBlockedCard } from "@/components/LocationBlockedCard";

export type SetupDialogProps = {
  open: boolean;
  firstRun: boolean;
  setup: Setup;
  onClose: () => void;
  onSave: (next: Setup) => void;
  alertPrefs: AlertPrefs;
  onAlertPrefsChange: (next: AlertPrefs) => void;
  savedPlaces: SavedPlace[];
  onPlacesChange: (next: SavedPlace[]) => void;
  /** Open straight to one Settings page (from a hint), not the list. */
  initialPage?: SettingsPageId | null;
};

/** Settings-only controls for how the stop alert announces itself. */
export function AlertPrefsSection({
  prefs,
  onChange,
}: {
  prefs: AlertPrefs;
  onChange: (next: AlertPrefs) => void;
}) {
  const rows: { id: keyof AlertPrefs; label: string; hint: string }[] = [
    { id: "sound", label: "Sound alert", hint: "A soft chime when your stop is next." },
    { id: "haptics", label: "Haptic vibration", hint: "Buzz your phone when your stop is next." },
    {
      id: "keepOnTransfer",
      label: "Keep alerts while changing rides",
      hint: "Keep showing alerts when you switch to another bus or train.",
    },
  ];
  return (
    <section className="space-y-2 border-t border-border pt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Stop alerts
      </p>
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex items-center justify-between gap-4 rounded-lg bg-surface-raised px-4 py-3"
        >
          <Label htmlFor={`alert-${row.id}`} className="leading-snug">
            {row.label}
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              {row.hint}
            </span>
          </Label>
          <Switch
            id={`alert-${row.id}`}
            checked={prefs[row.id]}
            onCheckedChange={(checked) => {
              onChange({ ...prefs, [row.id]: checked });
              if (row.id === "sound" && checked) playChime();
            }}
          />
        </div>
      ))}
    </section>
  );
}

export function PlacePills({
  places,
  disabled,
  onPick,
}: {
  places: SavedPlace[];
  disabled: boolean;
  onPick: (place: SavedPlace) => void;
}) {
  if (!places.length) return null;
  return (
    <div className="flex flex-wrap gap-2" aria-label="Saved places">
      {places.map((place) => {
        const Icon = shortcutIcon(place.kind);
        return (
          <Button
            key={place.id}
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => onPick(place)}
            className="h-9 gap-1.5 rounded-full px-3"
          >
            <Icon className="size-3.5" /> {place.label}
          </Button>
        );
      })}
    </div>
  );
}

export type SettingsPageId =
  "trip" | "places" | "voice" | "alerts" | "notifications" | "privacy" | "account" | "about";

/** Which Settings page is open; null shows the main list. */
export const SettingsPageContext = createContext<SettingsPageId | null>(null);

/**
 * One Settings page. On first run (trip setup) it shows inline; otherwise it
 * shows only while its row in the Settings list is open.
 */
export function SettingsGroup({
  id,
  children,
}: {
  id: SettingsPageId;
  title?: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const page = useContext(SettingsPageContext);
  if (page !== id) return null;
  // The page title already names the section, so hide each section's own
  // first heading and top divider here (they still show where used elsewhere).
  return (
    <div className="min-w-0 [&>*:first-child]:border-t-0 [&>*:first-child]:pt-0 [&>section:first-child>h3:first-child]:hidden [&>section:first-child>p:first-child]:hidden">
      {children}
    </div>
  );
}

/** A tappable row in the Settings list: icon, name, current status, chevron. */
export function SettingsRow({
  icon: Icon,
  title,
  status,
  onOpen,
}: {
  icon: typeof Settings;
  title: string;
  status?: string | null;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-foreground">{title}</span>
          {status && <span className="block truncate text-sm text-muted-foreground">{status}</span>}
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

export function SettingsList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background/30">
        {children}
      </ul>
    </section>
  );
}

export const SETTINGS_PAGES: Record<SettingsPageId, { title: string; description: string }> = {
  trip: { title: "Current trip", description: "Change where you’re starting or going." },
  places: { title: "Saved places", description: "Home, Work, School, Gym, and your own places." },
  voice: { title: "Voice", description: "Choose the voice Nalu speaks with." },
  alerts: {
    title: "Stop alerts",
    description: "Sound, vibration, and transfer alerts during a trip.",
  },
  notifications: { title: "Notifications", description: "Alerts that tell you when to leave." },
  privacy: { title: "Privacy & data", description: "Analytics and trip diagnostics." },
  account: { title: "Account", description: "Sign in, sign out, or manage your account." },
  about: { title: "About Nalu", description: "App information, data sources, and feedback." },
};

export function SetupDialog({
  open,
  firstRun,
  setup,
  onClose,
  onSave,
  alertPrefs,
  onAlertPrefsChange,
  savedPlaces,
  onPlacesChange,
  initialPage = null,
}: SetupDialogProps) {
  const findPlaces = useServerFn(searchPlaces);
  const lookupAddress = useServerFn(reverseGeocode);
  const [draft, setDraft] = useState<Setup>(setup);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  // Whether the browser currently blocks location, so recovery steps can be shown.
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [saveKind, setSaveKind] = useState<PlaceKind>("work");
  const [saveTime, setSaveTime] = useState("");
  const [originLabel, setOriginLabel] = useState("Current location");
  // Distance to the best boarding station; decides walk vs park-and-ride.
  const [stationDistanceM, setStationDistanceM] = useState<number | null>(null);
  const [page, setPage] = useState<SettingsPageId | null>(null);
  const { user } = useAuth();
  const sheetRef = useRef<HTMLDivElement>(null);
  // Each Settings page opens at its top, not where the list was scrolled to.
  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0 });
  }, [page]);

  useEffect(() => {
    if (open) {
      setPage(initialPage);
      setDraft(setup);
      setStatus(null);
      setOriginLabel(setup.homeLat !== null ? "Your starting point" : "Current location");
      setPlaceQuery("");
      setDebouncedQuery("");
    }
    if (!open) return;
    let cancelled = false;
    if (window.localStorage.getItem(LOCATION_DENIED_KEY) === "1") setPermissionBlocked(true);
    queryLocationPermission()
      .then((state) => {
        if (cancelled) return;
        if (state === "denied") {
          setPermissionBlocked(true);
          window.localStorage.setItem(LOCATION_DENIED_KEY, "1");
        } else if (state === "granted" || state === "prompt") {
          setPermissionBlocked(false);
          window.localStorage.removeItem(LOCATION_DENIED_KEY);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, setup]);

  // "Where to?" starts from where you are: find it automatically each time it
  // opens (the phone asks first if it needs to). Picking another start still
  // works, and a start picked before GPS answers is never overwritten.
  const originPicked = useRef(false);
  useEffect(() => {
    if (!open) return;
    originPicked.current = false;
    if (!firstRun && setup.homeLat !== null) return;
    void queryLocationPermission().then((state) => {
      if (state !== "denied") void locateMe({ auto: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 300ms debounce so typing does not fire a search per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(placeQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [placeQuery]);

  const { data: suggestions = [], isFetching: searching } = useQuery({
    queryKey: ["place-search", debouncedQuery],
    enabled: open && debouncedQuery.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const result = await findPlaces({
        data: { query: debouncedQuery, region: activeRegion().id },
      });
      return result.results;
    },
  });

  const { data: stations = [] } = useRailStations(open);

  async function locateMe(options: { auto?: boolean } = {}) {
    if (!options.auto) originPicked.current = false;
    if (!navigator.geolocation) {
      setStatus("This device cannot share its location. Pick a saved place below.");
      return;
    }
    // Check without prompting first: if it is already blocked, skip the request
    // and show the recovery steps right away.
    const permission = await queryLocationPermission();
    if (permission === "denied") {
      setPermissionBlocked(true);
      window.localStorage.setItem(LOCATION_DENIED_KEY, "1");
      setStatus(
        "Location is blocked in your browser. Follow the steps below to allow it, or pick a saved place.",
      );
      return;
    }
    setBusy(true);
    setStatus("Finding where you are…");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        // The person chose another start while GPS was answering: keep theirs.
        if (options.auto && originPicked.current) {
          setBusy(false);
          setStatus(null);
          return;
        }
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const { data } = await supabase.rpc("nearest_stop", {
          p_lat: lat,
          p_lon: lon,
          p_rail_only: true,
        });
        setBusy(false);
        // No station nearby (or off Oʻahu): still plan from here, by car and on foot.
        const nearest = data?.[0] ?? null;
        setDraft((current) => ({
          ...current,
          homeLat: lat,
          homeLon: lon,
          homeStopId: nearest?.stop_id ?? "",
          homeStopName: nearest?.stop_name ?? "",
        }));
        setOriginLabel("Current location");
        setStationDistanceM(nearest ? Number(nearest.distance_m) : null);
        const accuracy = position.coords.accuracy;
        const precision = Number.isFinite(accuracy)
          ? ` Accurate to about ${formatDistance(accuracy)}.`
          : "";
        setStatus(`Using your current location.${precision}`);
        // Confirm the exact spot in plain words, so a wrong pin is obvious.
        const address = await lookupAddress({ data: { lat, lon } }).catch(() => null);
        if (address?.label) {
          setStatus(`Detected: ${address.label}.${precision}`);
        }
      },
      (error) => {
        setBusy(false);
        if (isPermissionDeniedError(error)) {
          setPermissionBlocked(true);
          window.localStorage.setItem(LOCATION_DENIED_KEY, "1");
          setStatus(
            "Location is blocked in your browser. Follow the steps below to allow it, or pick a saved place.",
          );
          return;
        }
        setStatus("Location was not shared. Pick a saved place below.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  /** Use a point as the starting side: remember the door and derive its station. */
  async function applyOrigin(place: PointLike, label?: string) {
    originPicked.current = true;
    setBusy(true);
    setOriginLabel(label ?? place.name);
    setStatus(null);
    try {
      const { data } = await supabase.rpc("nearest_stop", {
        p_lat: place.lat,
        p_lon: place.lon,
        p_rail_only: true,
      });
      const nearest = data?.[0];
      setDraft((current) => ({
        ...current,
        homeLat: place.lat,
        homeLon: place.lon,
        homeStopId: nearest?.stop_id ?? current.homeStopId,
        homeStopName: nearest?.stop_name ?? current.homeStopName,
      }));
      if (nearest) setStationDistanceM(Number(nearest.distance_m));
    } finally {
      setBusy(false);
    }
  }

  async function applyPreset(from: PointLike, to: PointLike) {
    await applyOrigin(from);
    await selectPlace(to);
  }

  function savePlace(kind: PlaceKind, point: PointLike, arriveBySeconds: number | null) {
    const label = kind === "custom" ? point.name : kindLabel(kind);
    onPlacesChange(
      upsertPlace(savedPlaces, {
        id: `${kind}-${Date.now()}`,
        kind,
        label,
        name: point.name,
        address: point.address || point.name,
        lat: point.lat,
        lon: point.lon,
        typicalArrivalSeconds: arriveBySeconds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
    setStatus(`Saved ${label}: ${point.name}.`);
  }

  async function selectPlace(place: PointLike) {
    setBusy(true);
    setStatus("Finding the stops on each side of that place…");
    try {
      // A stop serves one direction only, so resolve the arriving stop and the
      // stop heading back toward the rail line separately, from the data.
      const [arriving, boarding, fallback] = await Promise.all([
        supabase.rpc("directional_dest_stop", {
          p_lat: place.lat,
          p_lon: place.lon,
          p_toward_rail: false,
        }),
        supabase.rpc("directional_dest_stop", {
          p_lat: place.lat,
          p_lon: place.lon,
          p_toward_rail: true,
        }),
        supabase.rpc("nearest_stop", { p_lat: place.lat, p_lon: place.lon, p_rail_only: false }),
      ]);
      const near = fallback.data?.[0];
      const out = arriving.data?.[0] ?? near;
      const back = boarding.data?.[0] ?? near;
      if (!out || !back) {
        setStatus("No stop found near that place.");
        return;
      }
      setDraft((current) => ({
        ...current,
        destinationName: place.name,
        destinationAddress: place.address || place.name,
        destLat: place.lat,
        destLon: place.lon,
        destStopId: out?.stop_id ?? "",
        destStopName: out?.stop_name ?? "",
        destStopWalkM: Number(out?.distance_m ?? 0),
        destReturnStopId: back?.stop_id ?? "",
        destReturnStopName: back?.stop_name ?? "",
        destReturnWalkM: Number(back?.distance_m ?? 0),
      }));
      setPlaceQuery("");
      setDebouncedQuery("");
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Place search failed.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    // A commute requires exact places. A station is transit access metadata,
    // never a substitute for the rider's Home coordinates.
    const home = findByKind(savedPlaces, "home");
    if (draft.destinationName && draft.destLat !== null && draft.destLon !== null) {
      addRecent({
        name: draft.destinationName,
        address: draft.destinationAddress,
        lat: draft.destLat,
        lon: draft.destLon,
      });
    }
    onSave({
      ...draft,
      // Walk when the station is close; otherwise plan park-and-ride driving.
      allowDrive: stationDistanceM === null ? draft.allowDrive : stationDistanceM > 1200,
      homeLat: draft.homeLat ?? home?.lat ?? null,
      homeLon: draft.homeLon ?? home?.lon ?? null,
    });
  }

  const canSave =
    hasValidCoordinates({ lat: draft.homeLat, lon: draft.homeLon }) &&
    hasValidCoordinates({ lat: draft.destLat, lon: draft.destLon });
  const presets = commutePresets(savedPlaces);
  const originPoint: PointLike | null =
    draft.homeLat !== null && draft.homeLon !== null
      ? {
          name: draft.homeStopName
            ? `Near ${stationLabel(draft.homeStopName)}`
            : "My starting point",
          address: draft.homeStopName ? `${stationLabel(draft.homeStopName)} area` : "",
          lat: draft.homeLat,
          lon: draft.homeLon,
        }
      : null;
  const destinationPoint: PointLike | null =
    draft.destLat !== null && draft.destLon !== null
      ? {
          name: draft.destinationName,
          address: draft.destinationAddress,
          lat: draft.destLat,
          lon: draft.destLon,
        }
      : null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        ref={sheetRef}
        className="bottom-0 left-0 top-auto max-h-[90dvh] w-full max-w-none translate-x-0 translate-y-0 gap-6 overflow-y-auto rounded-t-lg border-x-0 border-b-0 bg-background p-6 sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg"
      >
        <SettingsExpiryBanner />
        <DialogHeader className="text-left">
          {!firstRun && page && (
            <button
              type="button"
              onClick={() => setPage(null)}
              className="-ml-1 mb-1 flex min-h-11 w-fit items-center gap-1 rounded-lg pr-2 text-base font-semibold text-primary"
            >
              <ChevronLeft className="size-5" /> Settings
            </button>
          )}
          <DialogTitle className="text-2xl">
            {firstRun ? "WHERE TO?" : page ? SETTINGS_PAGES[page].title : "Settings"}
          </DialogTitle>
          <DialogDescription>
            {firstRun
              ? "Where you’re starting and where you’re going. Nalu picks the best station and route for you."
              : page
                ? SETTINGS_PAGES[page].description
                : "Tap what you’d like to change."}
          </DialogDescription>
        </DialogHeader>

        <SettingsPageContext.Provider value={firstRun ? "trip" : page}>
          {!firstRun && page === null && (
            <div className="grid min-w-0 grid-cols-1 gap-5">
              {permissionBlocked && (
                <LocationBlockedCard onDismiss={() => setPermissionBlocked(false)} />
              )}
              <SettingsList label="Your trips">
                <SettingsRow
                  icon={Navigation}
                  title="Current trip"
                  status={draft.destinationName ? `To ${draft.destinationName}` : "No trip set"}
                  onOpen={() => setPage("trip")}
                />
                <SettingsRow
                  icon={MapPin}
                  title="Saved places"
                  status={
                    savedPlaces.length
                      ? savedPlaces
                          .map((place) => place.label)
                          .slice(0, 4)
                          .join(", ")
                      : "None yet"
                  }
                  onOpen={() => setPage("places")}
                />
              </SettingsList>
              <SettingsList label="Alerts & voice">
                <SettingsRow
                  icon={Volume2}
                  title="Voice"
                  status={readVoiceLabel() ?? "Phone’s voice"}
                  onOpen={() => setPage("voice")}
                />
                <SettingsRow
                  icon={Vibrate}
                  title="Stop alerts"
                  status={
                    alertPrefs.sound && alertPrefs.haptics
                      ? "Sound and vibration"
                      : alertPrefs.sound
                        ? "Sound only"
                        : alertPrefs.haptics
                          ? "Vibration only"
                          : "Off"
                  }
                  onOpen={() => setPage("alerts")}
                />
                <SettingsRow
                  icon={Bell}
                  title="Notifications"
                  status={readPushPrefs().token ? "On for this phone" : "Off"}
                  onOpen={() => setPage("notifications")}
                />
              </SettingsList>
              <SettingsList label="Account & more">
                <SettingsRow
                  icon={UserRound}
                  title="Account"
                  status={user?.email ?? "Not signed in"}
                  onOpen={() => setPage("account")}
                />
                <SettingsRow
                  icon={ShieldCheck}
                  title="Privacy & data"
                  status="Analytics and diagnostics"
                  onOpen={() => setPage("privacy")}
                />
                <SettingsRow
                  icon={Info}
                  title="About Nalu"
                  status="Data sources and feedback"
                  onOpen={() => setPage("about")}
                />
              </SettingsList>
            </div>
          )}
          <div className="grid gap-5">
            <SettingsGroup
              id="trip"
              title={firstRun ? "Trip setup" : "Current trip"}
              description={
                firstRun
                  ? "Choose where you’re starting and going."
                  : "Change where you’re starting or going."
              }
              defaultOpen={firstRun}
            >
              {/* grid-cols-1 = minmax(0, 1fr): long addresses truncate instead of widening the sheet. */}
              <div className="grid min-w-0 grid-cols-1 gap-5">
                <div className="grid min-w-0 grid-cols-1 gap-2">
                  <Label>From</Label>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-raised px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <LocateFixed className="size-4 shrink-0 text-primary" />
                      <p className="truncate font-medium">{originLabel}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      disabled={busy}
                      onClick={() => void locateMe()}
                    >
                      <LocateFixed className="size-4" /> Locate
                    </Button>
                  </div>
                  <PlacePills
                    places={savedPlaces}
                    disabled={busy}
                    onPick={(place) => void applyOrigin(place, place.label)}
                  />
                  {permissionBlocked && (
                    <LocationBlockedCard onDismiss={() => setPermissionBlocked(false)} />
                  )}
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-2">
                  <Label htmlFor="destination">To</Label>
                  {draft.destinationName ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-raised px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{draft.destinationName}</p>
                        {draft.destinationAddress !== draft.destinationName && (
                          <p className="truncate text-xs text-muted-foreground">
                            {draft.destinationAddress}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        className="shrink-0"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            destinationName: "",
                            destinationAddress: "",
                            destLat: null,
                            destLon: null,
                            destStopId: "",
                            destStopName: "",
                            destStopWalkM: 0,
                            destReturnStopId: "",
                            destReturnStopName: "",
                            destReturnWalkM: 0,
                          }))
                        }
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <>
                      <PlacePills places={savedPlaces} disabled={busy} onPick={selectPlace} />
                      <Input
                        id="destination"
                        className="h-12 bg-surface-raised"
                        placeholder="Search for a place or address"
                        autoFocus={firstRun}
                        autoComplete="off"
                        value={placeQuery}
                        onChange={(event) => setPlaceQuery(event.target.value)}
                      />
                      {placeQuery.trim() === "" && (
                        <QuickPlaces disabled={busy} onPick={(place) => void selectPlace(place)} />
                      )}
                      {searching && <p className="text-sm text-muted-foreground">Searching…</p>}
                      {suggestions.length > 0 && (
                        <ul className="divide-y divide-border overflow-hidden rounded-lg bg-surface-raised">
                          {suggestions.map((place) => (
                            <li key={place.id}>
                              <button
                                type="button"
                                onClick={() => selectPlace(place)}
                                disabled={busy}
                                className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/40"
                              >
                                <span className="block truncate font-medium">{place.name}</span>
                                {place.address && place.address !== place.name && (
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {place.address}
                                  </span>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {!searching && debouncedQuery.length >= 2 && suggestions.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No places matched. Try a different name.
                        </p>
                      )}
                    </>
                  )}
                </div>

                <Button
                  onClick={save}
                  disabled={!canSave || busy}
                  className="h-12 w-full shadow-none"
                >
                  GO
                </Button>
              </div>
            </SettingsGroup>

            {!firstRun && (
              <SettingsGroup id="voice">
                <VoiceSection />
              </SettingsGroup>
            )}

            {!firstRun && (
              <SettingsGroup
                id="places"
                title="Saved places"
                description="Home, Work, School, Gym, and custom places."
                defaultOpen={false}
              >
                <section className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm">Saved places</Label>
                    {findByKind(savedPlaces, "home") && findByKind(savedPlaces, "work") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPlacesChange(swapHomeWork(savedPlaces))}
                      >
                        Swap Home &amp; Work
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Save Home, Work, School, Gym or anywhere else once, then start a trip with one
                    tap.
                  </p>

                  {presets.length > 0 && (
                    <div className="flex flex-wrap gap-2" aria-label="Commute presets">
                      {presets.map((preset) => (
                        <Button
                          key={preset.id}
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => applyPreset(preset.from, preset.to)}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  )}

                  {savedPlaces.length > 0 && (
                    <ul className="grid gap-3">
                      {savedPlaces.map((place) => (
                        <li key={place.id} className="grid gap-2 rounded-lg bg-surface-raised p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <Input
                                aria-label={`Label for ${place.name}`}
                                value={place.label}
                                onChange={(event) =>
                                  onPlacesChange(
                                    upsertPlace(savedPlaces, {
                                      ...place,
                                      label: event.target.value,
                                    }),
                                  )
                                }
                                className="h-9 bg-background/60 font-semibold"
                              />
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {place.name}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove ${place.label}`}
                              onClick={() => onPlacesChange(removePlace(savedPlaces, place.id))}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Label
                              htmlFor={`arrive-${place.id}`}
                              className="text-xs text-muted-foreground"
                            >
                              Typical arrival
                            </Label>
                            <Input
                              id={`arrive-${place.id}`}
                              type="time"
                              value={clockInputValue(place.typicalArrivalSeconds)}
                              onChange={(event) =>
                                onPlacesChange(
                                  upsertPlace(savedPlaces, {
                                    ...place,
                                    typicalArrivalSeconds: parseClockInput(event.target.value),
                                  }),
                                )
                              }
                              className="h-9 w-32 bg-background/60 tabular-nums"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => applyOrigin(place)}
                            >
                              Start here
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => selectPlace(place)}
                            >
                              Go here
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <Select
                      value={saveKind}
                      onValueChange={(value) => setSaveKind(value as PlaceKind)}
                    >
                      <SelectTrigger className="h-10 w-32 bg-surface-raised">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLACE_KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {kind === "custom" ? "Custom" : kindLabel(kind)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="time"
                      aria-label="Typical arrival time for the place you are saving"
                      value={saveTime}
                      onChange={(event) => setSaveTime(event.target.value)}
                      className="h-10 w-32 bg-surface-raised tabular-nums"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!originPoint}
                      onClick={() =>
                        originPoint && savePlace(saveKind, originPoint, parseClockInput(saveTime))
                      }
                    >
                      Save start
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!destinationPoint}
                      onClick={() =>
                        destinationPoint &&
                        savePlace(saveKind, destinationPoint, parseClockInput(saveTime))
                      }
                    >
                      Save destination
                    </Button>
                  </div>
                </section>
              </SettingsGroup>
            )}

            {!firstRun && (
              <SettingsGroup
                id="alerts"
                title="Stop alerts"
                description="Sound, vibration, and transfer alerts during an active trip."
                defaultOpen={false}
              >
                <AlertPrefsSection prefs={alertPrefs} onChange={onAlertPrefsChange} />
              </SettingsGroup>
            )}

            {!firstRun && (
              <SettingsGroup
                id="notifications"
                title="Notifications"
                description="Optional commute alerts and quiet hours."
                defaultOpen={false}
              >
                <NotificationsSection places={savedPlaces} />
              </SettingsGroup>
            )}

            {!firstRun && (
              <SettingsGroup
                id="privacy"
                title="Privacy & data"
                description="Analytics consent and trip diagnostics."
                defaultOpen={false}
              >
                <PrivacySection />
              </SettingsGroup>
            )}

            {!firstRun && (
              <SettingsGroup
                id="account"
                title="Account"
                description="Sign in, sign out, or manage your Nalu account."
                defaultOpen={false}
              >
                <AccountSection />
              </SettingsGroup>
            )}

            {!firstRun && (
              <SettingsGroup
                id="about"
                title="About Nalu"
                description="App information, data sources, feedback, and the Welcome page."
                defaultOpen={false}
              >
                <AboutSection />
              </SettingsGroup>
            )}

            {status && <p className="text-sm text-muted-foreground">{status}</p>}
          </div>
        </SettingsPageContext.Provider>
      </DialogContent>
    </Dialog>
  );
}

export const DATA_SOURCES = [
  {
    label: "Bus and Skyline times: TheBus / Oahu Transit Services (thebus.org)",
    href: "https://www.thebus.org",
  },
  { label: "Live bus arrivals: TheBus HEA API", href: "https://hea.thebus.org" },
  { label: "Traffic and drive times: TomTom (tomtom.com)", href: "https://www.tomtom.com" },
  {
    label: "Weather: National Weather Service / NOAA (weather.gov)",
    href: "https://www.weather.gov",
  },
  { label: "Air quality: AirNow / US EPA (airnow.gov)", href: "https://www.airnow.gov" },
];

export const ABOUT_FEATURES = [
  "Compares driving, TheBus and Skyline for the whole trip, walking and parking included, with live traffic.",
  "Tells you when to leave, and can alert you before it’s time to go.",
  "Turn-by-turn voice directions for drives.",
  "Live bus locations, and an alert when your stop is next.",
  "Scheduled roadwork on your route, in plain road names.",
  "Late at night: the last bus home, or a ride with Uber or Lyft.",
];

export function AboutSection() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <div className="border-t border-border pt-8">
      <div className="flex flex-col items-center pb-7 text-center">
        <WaveMark className="nalu-honu h-16 w-24" />
        <p className="nalu-brand-title mt-3 text-2xl font-bold tracking-wide">Nalu</p>
        <p className="mt-1 text-sm text-muted-foreground">Version {APP_VERSION}</p>
        <Tagline className="mt-3" />
        <p className="mt-2 text-sm italic text-muted-foreground">
          Hawaiian for wave, and to think deeply.
        </p>
      </div>
      <div className="h-px bg-border/60" />

      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        What Nalu does
      </p>
      <p className="mt-2 text-base leading-7 text-foreground">
        Tell Nalu where you’re going. It finds the fastest way there, by car, TheBus or Skyline, and
        tells you when to leave.
      </p>
      <ul className="mt-3 grid gap-2.5 text-base leading-7 text-muted-foreground">
        {ABOUT_FEATURES.map((feature) => (
          <li key={feature} className="flex gap-2.5">
            <Check className="mt-1.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Who it’s for
      </p>
      <p className="mt-2 text-base leading-7 text-muted-foreground">
        Anyone getting around Oʻahu: daily commuters, students, visitors and late-night shifts. Made
        in Hawaiʻi. The core answer and safety features are free.
      </p>
      <div className="mt-4 grid gap-2">
        <Link
          to="/welcome"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-background/40 px-4 text-base font-semibold text-foreground transition-colors hover:bg-accent"
        >
          View Welcome page
        </Link>
        <Link
          to="/oahu-commute"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-base font-semibold text-primary underline-offset-4 hover:underline"
        >
          Oʻahu commute guide
        </Link>
      </div>
      <div className="mt-6 h-px bg-border/60" />

      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Data sources
      </p>
      <ul className="mt-1">
        {DATA_SOURCES.map((source) => (
          <li key={source.href} className="border-b border-border/50 last:border-b-0">
            <a
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>{source.label}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-6 h-px bg-border/60" />

      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Privacy
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Guest trips and saved places can remain on this device. If you choose to sign in, your
        profile, saved places, and preferences can sync across your devices. A note you send with Tell
        Nalu something is stored as plain text for review, with no name or account. To know how
        many people use Nalu each week, each phone is counted once a day under a random number, with
        no name or location. Crash reports go to our error service without your searches or
        location.
      </p>
      <div className="mt-6 h-px bg-border/60" />

      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Contact
      </p>
      <a
        href="mailto:hello@ridenalu.com"
        className="mt-2 inline-block text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
      >
        hello@ridenalu.com
      </a>
      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full shadow-none"
        onClick={() => {
          setFeedbackOpen(true);
        }}
      >
        Tell Nalu something
      </Button>
      {feedbackOpen && (
        <div className="mt-3">
          <TellNaluForm onDone={() => setFeedbackOpen(false)} />
        </div>
      )}
    </div>
  );
}
