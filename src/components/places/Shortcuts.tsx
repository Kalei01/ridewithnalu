import { TEST_REGION_POPULAR, activeRegion, regionContains } from "@/lib/region";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BriefcaseBusiness,
  Check,
  House,
  Dumbbell,
  GraduationCap,
  MapPin,
  Pencil,
  Plus,
  History,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { searchPlaces, type PlaceSuggestion } from "@/lib/geocode.functions";
import {
  findByKind,
  kindLabel,
  makeSavedPlace,
  upsertPlace,
  PLACE_KINDS,
  type PlaceKind,
  type SavedPlace,
} from "@/lib/saved-places";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  POPULAR_PLACES,
  clearRecents,
  readRecents,
  removeRecent,
  type RecentPlace,
} from "@/lib/places/recents";
import { PointLike } from "@/lib/commute-model";

export const SHORTCUTS_KEY = "nalu-shortcuts-v1";
export const DEFAULT_SHORTCUTS = ["home", "work"];
export const MAX_SHORTCUTS = 4;

/** A shortcut slot is a place kind (home/work/school/gym) or a saved place id. */
/** Recent destinations (this phone only, each removable) and popular Oahu places. */
export function QuickPlaces({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (place: PointLike) => void;
}) {
  const region = activeRegion();
  const findPlaces = useServerFn(searchPlaces);
  const [looking, setLooking] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentPlace[]>([]);
  useEffect(
    () => setRecents(readRecents().filter((place) => regionContains(region, place.lat, place.lon))),
    [region],
  );
  // Test-region places are looked up live, so a tap fills in the real spot.
  async function pickByName(name: string) {
    setLooking(name);
    try {
      const { results } = await findPlaces({ data: { query: name, region: region.id } });
      const top = results[0];
      if (top)
        onPick({ name: top.name, address: top.address, lat: top.lat, lon: top.lon } as PointLike);
      else toast.error(`Couldn't find ${name}. Try typing it.`);
    } catch {
      toast.error("Search isn't available right now.");
    } finally {
      setLooking(null);
    }
  }
  const chip =
    "flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3 text-sm font-medium text-foreground";
  return (
    <div className="grid gap-3">
      {recents.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Recent</p>
            <button
              type="button"
              className="min-h-11 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              onClick={() => {
                clearRecents();
                setRecents([]);
              }}
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recents.map((place) => (
              <span key={`${place.lat},${place.lon}`} className={chip}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(place)}
                  className="flex min-w-0 items-center gap-1.5"
                >
                  <History className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{place.name}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${place.name} from recents`}
                  onClick={() => {
                    removeRecent(place);
                    setRecents(readRecents());
                  }}
                  className="-mr-2 flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
          {region.id === "oahu" ? "Popular on Oʻahu" : `Popular in ${region.name}`}
        </p>
        <div className="flex flex-wrap gap-2">
          {region.id !== "oahu" &&
            TEST_REGION_POPULAR[region.id].map((name) => (
              <button
                key={name}
                type="button"
                disabled={disabled || looking !== null}
                onClick={() => void pickByName(name)}
                className={chip}
              >
                <span className="truncate">
                  {looking === name ? "Finding…" : name.replace(/ San Francisco$/, "")}
                </span>
              </button>
            ))}
          {region.id === "oahu" &&
            POPULAR_PLACES.map((place) => (
              <button
                key={place.name}
                type="button"
                disabled={disabled}
                onClick={() => onPick(place)}
                className={chip}
              >
                <span className="truncate">{place.name}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

export function resolveShortcut(places: SavedPlace[], slot: string): SavedPlace | null {
  if ((PLACE_KINDS as string[]).includes(slot) && slot !== "custom") {
    return findByKind(places, slot as PlaceKind);
  }
  return places.find((place) => place.id === slot) ?? null;
}
export function shortcutLabel(places: SavedPlace[], slot: string): string {
  if ((PLACE_KINDS as string[]).includes(slot)) return kindLabel(slot as PlaceKind);
  return places.find((place) => place.id === slot)?.label ?? "Saved place";
}
export function shortcutIcon(slot: string) {
  if (slot === "home") return House;
  if (slot === "work") return BriefcaseBusiness;
  if (slot === "school") return GraduationCap;
  if (slot === "gym") return Dumbbell;
  return MapPin;
}

export function ShortcutGrid({
  places,
  onStart,
  onPlacesChange,
}: {
  places: SavedPlace[];
  onStart: (slot: string) => void;
  onPlacesChange: (next: SavedPlace[]) => void;
}) {
  const [slots, setSlots] = useState<string[]>(DEFAULT_SHORTCUTS);
  const [quickEdit, setQuickEdit] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SHORTCUTS_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (
        Array.isArray(parsed) &&
        parsed.every((item) => typeof item === "string") &&
        parsed.length
      ) {
        setSlots(parsed.slice(0, MAX_SHORTCUTS));
      }
    } catch {
      // Keep defaults when storage is unreadable.
    }
  }, []);
  function update(next: string[]) {
    setSlots(next);
    window.localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(next));
  }
  const choices = [
    ...(["home", "work", "school", "gym"] as const).map((kind) => ({
      value: kind as string,
      label: kindLabel(kind),
    })),
    ...places
      .filter((place) => place.kind === "custom")
      .map((place) => ({ value: place.id, label: place.label })),
  ];
  const unused = choices.filter((choice) => !slots.includes(choice.value));

  return (
    <div className="mt-2">
      <div className="grid grid-cols-2 gap-2" aria-label="Saved place shortcuts">
        {slots.map((slot, index) => {
          const place = resolveShortcut(places, slot);
          const Icon = shortcutIcon(slot);
          const label = shortcutLabel(places, slot);
          if (editing) {
            return (
              <div
                key={`${slot}-${index}`}
                className="glass-panel flex h-14 items-center gap-1 rounded-md border border-primary/30 px-2"
              >
                <Select
                  value={slot}
                  onValueChange={(value) => {
                    const next = [...slots];
                    const swapIndex = next.indexOf(value);
                    // Picking a slot already pinned elsewhere swaps the two.
                    if (swapIndex >= 0) next[swapIndex] = slot;
                    next[index] = value;
                    update(next);
                  }}
                >
                  <SelectTrigger
                    className="h-10 min-w-0 flex-1 bg-transparent"
                    aria-label={`Shortcut ${index + 1}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {choices.map((choice) => (
                      <SelectItem key={choice.value} value={choice.value}>
                        {choice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0"
                  aria-label={`Remove ${label} shortcut`}
                  disabled={slots.length <= 1}
                  onClick={() => update(slots.filter((_, i) => i !== index))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            );
          }
          return (
            <div key={`${slot}-${index}`} className="relative min-w-0">
              <Button
                variant="outline"
                onClick={() => onStart(slot)}
                className="glass-panel h-14 w-full min-w-0 justify-start gap-3 border-primary/30 bg-primary/5 pl-3 pr-9 text-foreground hover:bg-primary/10"
                aria-label={place ? `Start a trip to ${label}` : `Set your ${label} location`}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block truncate text-sm font-bold">{label}</span>
                  <span className="block truncate text-xs font-medium text-muted-foreground">
                    {place ? place.name : "Set location"}
                  </span>
                </span>
              </Button>
              <button
                type="button"
                onClick={() => setQuickEdit(slot)}
                aria-label={`Change ${label} address`}
                className="absolute right-0 top-0 grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          );
        })}
        {editing && slots.length < MAX_SHORTCUTS && unused.length > 0 && (
          <Button
            variant="outline"
            className="h-14 gap-2 border-dashed border-primary/40 bg-transparent text-muted-foreground"
            onClick={() => update([...slots, unused[0]!.value])}
          >
            <Plus className="size-4" /> Add shortcut
          </Button>
        )}
      </div>
      <div className="mt-1 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-11 gap-1.5 text-xs text-muted-foreground"
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
          {editing ? "Done" : "Edit shortcuts"}
        </Button>
      </div>
      <QuickPlaceDialog
        slot={quickEdit}
        places={places}
        onClose={() => setQuickEdit(null)}
        onSave={(next) => {
          onPlacesChange(next);
          setQuickEdit(null);
        }}
      />
    </div>
  );
}

/** Search and replace one shortcut's address in place, without opening Settings. */
export function QuickPlaceDialog({
  slot,
  places,
  onClose,
  onSave,
}: {
  slot: string | null;
  places: SavedPlace[];
  onClose: () => void;
  onSave: (next: SavedPlace[]) => void;
}) {
  const findPlaces = useServerFn(searchPlaces);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    setQuery("");
    setDebounced("");
  }, [slot]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  const { data: results = [], isFetching } = useQuery({
    queryKey: ["place-search", debounced],
    enabled: Boolean(slot) && debounced.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (await findPlaces({ data: { query: debounced, region: activeRegion().id } })).results,
  });
  const current = slot ? resolveShortcut(places, slot) : null;
  const label = slot ? shortcutLabel(places, slot) : "";

  function choose(hit: PlaceSuggestion) {
    if (!slot) return;
    const kind: PlaceKind =
      current?.kind ?? ((PLACE_KINDS as string[]).includes(slot) ? (slot as PlaceKind) : "custom");
    const place = makeSavedPlace({
      ...(current
        ? {
            id: current.id,
            label: current.label,
            typicalArrivalSeconds: current.typicalArrivalSeconds,
          }
        : {}),
      kind,
      name: hit.name,
      address: hit.address,
      lat: hit.lat,
      lon: hit.lon,
    });
    onSave(upsertPlace(places, place));
    toast(`${label} updated`, { description: hit.address || hit.name });
  }

  return (
    <Dialog open={Boolean(slot)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change {label}</DialogTitle>
          <DialogDescription>
            {current ? `Now: ${current.address}` : "Search for a place or street address."}
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a place or address"
          aria-label={`New ${label} address`}
        />
        <ul className="max-h-72 space-y-1 overflow-y-auto" aria-live="polite">
          {isFetching && <li className="px-2 py-2 text-sm text-muted-foreground">Searching…</li>}
          {!isFetching && debounced.length >= 2 && results.length === 0 && (
            <li className="px-2 py-2 text-sm text-muted-foreground">No places found on Oʻahu.</li>
          )}
          {results.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => choose(hit)}
                className="w-full rounded-md px-3 py-2 text-left hover:bg-primary/10"
              >
                <span className="block truncate text-sm font-bold text-foreground">{hit.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{hit.address}</span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
