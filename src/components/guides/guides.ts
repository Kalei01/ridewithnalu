/**
 * The guide pages under /guides, in one place so the hub, the related-guide
 * links and the metadata test all read the same titles and descriptions.
 *
 * Facts in the guides were checked in October 2026 against TheBus's GTFS
 * timetable (feed valid Sept 28 to Dec 5, 2026), thebus.org, the City and
 * County of Honolulu, HDOT, the University of Hawaiʻi and local news. Update
 * LAST_UPDATED and the affected pages when the timetable or fares change.
 */

export const LAST_UPDATED = "October 2026";

export type GuideMeta = {
  path: GuidePath;
  /** The <title>, under 60 characters including " | Nalu". */
  seoTitle: string;
  /** Meta description, 140 to 160 characters. */
  description: string;
  /** Short name for breadcrumbs, links and og:title. */
  name: string;
  /** One line for the hub and related-guide cards. */
  summary: string;
};

export type GuidePath =
  | "/guides/kapolei-to-downtown"
  | "/guides/ewa-beach-to-downtown"
  | "/guides/mililani-to-town"
  | "/guides/honolulu-airport-without-driving"
  | "/guides/uh-manoa-without-parking"
  | "/guides/skyline-rail-guide"
  | "/guides/skyline-park-and-ride"
  | "/guides/late-night-commuting"
  | "/guides/honolulu-marathon-traffic-2026"
  | "/guides/nalu-vs-google-maps"
  | "/guides/about-nalu";

export type GuideSlug =
  | "kapolei"
  | "ewa"
  | "mililani"
  | "airport"
  | "uh"
  | "skyline"
  | "parking"
  | "lateNight"
  | "marathon"
  | "compare"
  | "about";

export const GUIDES: Record<GuideSlug, GuideMeta> = {
  kapolei: {
    path: "/guides/kapolei-to-downtown",
    seoTitle: "Kapolei to Downtown Honolulu: Drive or Skyline? | Nalu",
    description:
      "Kapolei and East Kapolei to downtown Honolulu: driving H-1 compared with Skyline plus TheBus, with train times, park-and-ride lots and the CountryExpress C bus.",
    name: "Kapolei to downtown Honolulu",
    summary: "Driving H-1 compared with Skyline plus a bus, train times and where to park.",
  },
  ewa: {
    path: "/guides/ewa-beach-to-downtown",
    seoTitle: "ʻEwa Beach to Downtown Honolulu: Bus, Rail or Drive | Nalu",
    description:
      "ʻEwa Beach to downtown Honolulu by car, the E and 91 express buses, Route 42, or a bus to Skyline, with scheduled times from TheBus timetable and how to choose.",
    name: "ʻEwa Beach to downtown Honolulu",
    summary: "The E, 91 and 42 buses, bus connections to Skyline, and driving.",
  },
  mililani: {
    path: "/guides/mililani-to-town",
    seoTitle: "Mililani to Downtown Honolulu: Bus, Rail or Drive | Nalu",
    description:
      "Mililani and Central Oʻahu to town: Routes 51 and 52, weekday express buses, Skyline from Waiawa (Pearl Highlands), and when driving H-2 makes sense.",
    name: "Mililani and Central Oʻahu to town",
    summary: "Routes 51 and 52, weekday express buses and the nearest Skyline stations.",
  },
  airport: {
    path: "/guides/honolulu-airport-without-driving",
    seoTitle: "Get to Honolulu Airport by Skyline or TheBus | Nalu",
    description:
      "How to reach Honolulu airport (HNL) without driving: Skyline's Lelepaua station, the W Line from Waikīkī, late-night Routes 40, 42 and 51, and luggage rules.",
    name: "Honolulu airport (HNL) without driving",
    summary: "Skyline's airport station, the W Line from Waikīkī, and what luggage you can bring.",
  },
  uh: {
    path: "/guides/uh-manoa-without-parking",
    seoTitle: "UH Mānoa Without Parking: U-Pass, Bus and Skyline | Nalu",
    description:
      "Getting to UH Mānoa without parking: how the student U-Pass works on TheBus and Skyline, the A and U Lines from Āhua station, and Routes 4, 6 and 13 to campus.",
    name: "UH Mānoa without parking",
    summary: "The U-Pass, the A and U Lines from Skyline, and the bus routes to campus.",
  },
  skyline: {
    path: "/guides/skyline-rail-guide",
    seoTitle: "Skyline Rail Guide: Hours, Stations and Fares | Nalu",
    description:
      "Skyline rail on Oʻahu: 13 stations from East Kapolei to Kalihi, trains every 10 minutes most of the day, HOLO fares, park-and-ride lots and airport access.",
    name: "Skyline rail guide",
    summary: "Hours, all 13 stations with travel times, fares, HOLO cards, parking and luggage.",
  },
  parking: {
    path: "/guides/skyline-park-and-ride",
    seoTitle: "Skyline Station Parking: All 4 Park-and-Ride Lots | Nalu",
    description:
      "Free Skyline park-and-ride lots at Keoneʻae, Honouliuli, Hālawa and Kahauiki: how many stalls each has, where to enter, the 24-hour limit and the train times.",
    name: "Skyline station parking",
    summary: "All four free park-and-ride lots: stalls, entrances and train times from each one.",
  },
  lateNight: {
    path: "/guides/late-night-commuting",
    seoTitle: "Late-Night and Early-Morning Buses on Oʻahu | Nalu",
    description:
      "Late-night and early-morning commuting on Oʻahu: which TheBus routes run overnight, Skyline's first and last trains, and practical tips for shift workers.",
    name: "Late-night and early-morning commuting",
    summary: "Overnight bus routes, first and last trains, and tips for shift workers.",
  },
  marathon: {
    path: "/guides/honolulu-marathon-traffic-2026",
    seoTitle: "Honolulu Marathon 2026 Traffic and Road Closures | Nalu",
    description:
      "Honolulu Marathon traffic on Sunday, December 13, 2026: start time, the course, what closed in 2025, when 2026 closures usually appear, and how to get around.",
    name: "Honolulu Marathon traffic, December 13, 2026",
    summary: "Race-day timing, the roads that closed last year, and how to plan around it.",
  },
  compare: {
    path: "/guides/nalu-vs-google-maps",
    seoTitle: "Nalu vs Google Maps, Apple Maps, Moovit and Transit | Nalu",
    description:
      "An honest comparison of Nalu with Google Maps, Apple Maps, Moovit and the Transit app on Oʻahu: what each does best, and why Nalu decides first, then hands off.",
    name: "Nalu compared with Google Maps and transit apps",
    summary: "What Nalu does, what the map and transit apps do better, and how they fit together.",
  },
  about: {
    path: "/guides/about-nalu",
    seoTitle: "About Nalu: FAQ, Key Facts and Press Information | Nalu",
    description:
      "About Nalu, the free Oʻahu commute app: what it does, who it is for, where its data comes from, privacy, iPhone alerts, accounts, press facts and contact.",
    name: "About Nalu: FAQ and press facts",
    summary: "What Nalu is, cost, data sources, privacy, alerts, and facts for press.",
  },
};

/** Hub page metadata, kept with the guides so the test checks it too. */
export const GUIDES_HUB = {
  path: "/guides",
  seoTitle: "Oʻahu Commute Guides: Skyline, TheBus and Driving | Nalu",
  description:
    "Fact-checked Oʻahu commute guides: Skyline rail, TheBus, the airport, UH Mānoa, Kapolei, ʻEwa Beach, Mililani, late-night trips and Honolulu Marathon traffic.",
  name: "Oʻahu commute guides",
} as const;

/** Display order on the hub. */
export const GUIDE_ORDER: GuideSlug[] = [
  "skyline",
  "parking",
  "kapolei",
  "ewa",
  "mililani",
  "airport",
  "uh",
  "lateNight",
  "marathon",
  "compare",
  "about",
];
