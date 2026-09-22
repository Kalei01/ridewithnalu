/**
 * Recognized Oahu landmark anchors for key transit stops.
 *
 * Stop names themselves always come from the live GTFS data; this table only
 * adds a well-known landmark ("Near Aloha Tower Marketplace") under a stop's
 * data-derived name so kupuna and visitors can orient at a glance.
 *
 * Matching is done on normalized names (diacritics and okina stripped) so
 * Hālawa/Halawa and Kualakaʻi/Kualakai both resolve.
 */

export function landmarkFor(stopName: string | null | undefined): string | null {
  if (!stopName) return null;
  const name = normalize(stopName);

  // Order matters: "Nimitz + Bishop" must win over the generic Bishop St rule.
  if (name.includes("nimitz") && name.includes("bishop")) {
    return "Near Aloha Tower Marketplace & Topa Financial";
  }
  if (name.includes("halawa")) return "Aloha Stadium / Pearl Harbor";
  if (name.includes("airport")) return "Daniel K. Inouye International Airport (HNL)";
  if (name.includes("kualakai") || name.includes("east kapolei")) return "Near Ka Makana Aliʻi";
  if (name.includes("keoneae") || name.includes("uh west oahu") || name.includes("university of hawaii west")) {
    return "University of Hawaiʻi West Oʻahu";
  }
  if (name.includes("kalihi") && name.includes("transit")) return "Middle St Transit Hub";
  if (name.includes("middle st")) return "Middle St Transit Hub";
  if (name.includes("bishop") || name.includes("king st") || name.includes("hotel st") || name.includes("downtown")) {
    return "Downtown Financial / Chinatown / Capitol District";
  }
  return null;
}

/** Lowercase, strip diacritics/okina/punctuation, collapse whitespace. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Okina and apostrophe vanish (Kualakaʻi → kualakai); punctuation becomes
    // a separator so word boundaries stay intact.
    .replace(/[\u02bb\u02bc'’]/g, "")
    .replace(/[.,]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
