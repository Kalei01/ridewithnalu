import type { Map as LeafletMap } from "leaflet";

/**
 * Removes a Leaflet map without the "_leaflet_pos" crash. Leaflet finishes a
 * zoom animation on a 250 ms timer; if the map is removed first (the browse map
 * making way for the trip map, say), that timer touches panes that no longer
 * exist. The timer bails out when `_animatingZoom` is false, so clear it first.
 */
export function removeMapSafely(map: LeafletMap) {
  map.stop();
  (map as unknown as { _animatingZoom?: boolean })._animatingZoom = false;
  map.off();
  map.remove();
}

/**
 * True while the map is still usable: set up, not removed, and attached to the
 * page. Delayed work (animation frames, timers) must check this before touching
 * a map, since a removed map has no panes left ("_leaflet_pos" crash).
 */
export function isMapAlive(map: LeafletMap | null | undefined): map is LeafletMap {
  if (!map) return false;
  const m = map as unknown as { _loaded?: boolean; getContainer?: () => HTMLElement };
  return m._loaded === true && !!m.getContainer?.()?.isConnected;
}
