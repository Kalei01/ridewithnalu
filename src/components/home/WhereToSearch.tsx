import { useEffect, useId, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Search } from "lucide-react";
import { searchPlaces } from "@/lib/geocode.functions";
import { markWelcomeSeen } from "@/lib/welcome-seen";
import { plannerHref } from "@/lib/home/planner-link";

type Suggestion = { id: string; name: string; address: string; lat: number; lon: number };

/**
 * The home page's "Where to?" box: type a place, pick it, and the planner
 * opens with that trip started from where you are. Nothing is saved.
 */
export function WhereToSearch({
  inputRef,
  onPick,
}: {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Handle the chosen place instead of opening the planner (the Browse sheet uses this for "start from here"). */
  onPick?: (place: Suggestion) => void;
}) {
  const findPlaces = useServerFn(searchPlaces);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "none" | "error">("idle");
  const [active, setActive] = useState(0);
  const listId = useId();
  const latest = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const ticket = ++latest.current;
    setStatus("searching");
    const timer = window.setTimeout(() => {
      findPlaces({ data: { query: text } })
        .then((answer) => {
          if (ticket !== latest.current) return;
          const found = (answer.results ?? []).slice(0, 6) as Suggestion[];
          setResults(found);
          setActive(0);
          setStatus(found.length ? "idle" : "none");
        })
        .catch(() => {
          if (ticket === latest.current) setStatus("error");
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, findPlaces]);

  const go = (place: Suggestion) => {
    if (onPick) {
      onPick(place);
      return;
    }
    markWelcomeSeen();
    window.location.assign(plannerHref(place));
  };

  const open = results.length > 0 || status === "none" || status === "error";
  return (
    <form
      role="search"
      className="nh-search"
      onSubmit={(event) => {
        event.preventDefault();
        const pick = results[active] ?? results[0];
        if (pick) go(pick);
      }}
    >
      <label className="nh-search-field">
        <Search aria-hidden="true" className="size-6 shrink-0 text-[var(--nh-car)]" />
        <span className="sr-only">Where to? Search for a place on Oʻahu</span>
        <input
          ref={inputRef}
          className="nh-search-input min-h-14"
          type="search"
          inputMode="search"
          enterKeyHint="go"
          autoComplete="off"
          placeholder="Where to?"
          value={query}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (!results.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((i) => Math.min(results.length - 1, i + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (event.key === "Escape") {
              setResults([]);
            }
          }}
        />
        {status === "searching" && (
          <span aria-hidden="true" className="mr-3 text-sm font-semibold text-muted-foreground">
            …
          </span>
        )}
      </label>
      {open && (
        <ul id={listId} role="listbox" aria-label="Places" className="nh-suggestions">
          {results.map((place, index) => (
            <li
              key={place.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
            >
              <button
                type="button"
                onClick={() => go(place)}
                className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left ${
                  index === active ? "bg-white/[0.07]" : ""
                }`}
              >
                <MapPin aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate text-base font-semibold">{place.name}</span>
                  {place.address && place.address !== place.name && (
                    <span className="block truncate text-sm text-muted-foreground">
                      {place.address}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {status === "none" && (
            <li className="px-4 py-3 text-base text-muted-foreground">
              No places on Oʻahu match that yet.
            </li>
          )}
          {status === "error" && (
            <li className="px-4 py-3 text-base text-muted-foreground">
              Search isn’t answering right now. Try a chip below, or try again in a moment.
            </li>
          )}
        </ul>
      )}
    </form>
  );
}
