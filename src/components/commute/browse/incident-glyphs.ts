/** Map incident glyphs (24 px, filled with currentColor), shared by the map pins and the Layers legend. */
export type IncidentGlyphKind = "crash" | "police" | "closure" | "roadwork" | "other";

const ALERT_GLYPH =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 22 20H2L12 2.5Zm-1 7v5h2v-5h-2Zm0 6.5v2h2v-2h-2Z"/></svg>';
// Incident glyphs: a car with impact rays, a police shield with a star, a cone, a wrench.
const CRASH_GLYPH =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 20v-1.6H4A1.5 1.5 0 0 1 2.5 17v-3.4a1.5 1.5 0 0 1 1.1-1.45L5 8.6A2 2 0 0 1 6.9 7.2h6.2A2 2 0 0 1 15 8.6l1.4 3.55a1.5 1.5 0 0 1 1.1 1.45V17a1.5 1.5 0 0 1-1.5 1.4h-1.2V20h-2.1v-1.6H7.3V20H5.2Zm2.6-10.9-.9 2.3h7.2l-.9-2.3H7.8Zm-.3 4.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Zm7 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z"/><path d="M19 3.5v3M16.6 4.6l1.6 2M21.4 4.6l-1.6 2M22 8.5h-2.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
const POLICE_GLYPH =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M12 2 4.5 5v6c0 4.9 3.2 9.2 7.5 11 4.3-1.8 7.5-6.1 7.5-11V5L12 2Zm0 5.4 1.2 2.6 2.8.3-2.1 1.9.6 2.8L12 13.5l-2.5 1.5.6-2.8L8 10.3l2.8-.3L12 7.4Z"/></svg>';
const CONE_GLYPH =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2c.5 0 .9.3 1.1.8l3.2 11H7.7L10.9 4c.2-.5.6-.8 1.1-.8Z"/><rect x="4.5" y="16.5" width="15" height="3.6" rx="1.2"/><path d="M9.4 9.4h5.2" fill="none" stroke="rgb(0 0 0 / 35%)" stroke-width="1.4"/></svg>';
const WORK_ROAD_GLYPH =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 3.3a4.7 4.7 0 0 0-4.4 6.4l-6.7 6.7a1.8 1.8 0 0 0 0 2.5l1.1 1.1a1.8 1.8 0 0 0 2.5 0l6.7-6.7a4.7 4.7 0 0 0 6.4-4.4c0-.5-.1-.9-.2-1.3l-2.9 2.9-2.4-.5-.5-2.4 2.9-2.9c-.4-.1-.9-.2-1.3-.2-.4-.1-.8-.2-1.2-.2Z"/></svg>';
export const INCIDENT_GLYPH: Record<IncidentGlyphKind, string> = {
  crash: CRASH_GLYPH,
  police: POLICE_GLYPH,
  closure: CONE_GLYPH,
  roadwork: WORK_ROAD_GLYPH,
  other: ALERT_GLYPH,
};
