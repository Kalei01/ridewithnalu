/**
 * Douglas–Peucker for [lat, lon] paths, so a drive route travels to the home
 * page as a few dozen points instead of a thousand. Tolerance in metres.
 */
export function simplifyPath(
  points: ReadonlyArray<{ lat: number; lon: number }>,
  toleranceM: number,
): Array<[number, number]> {
  if (points.length < 3) return points.map((p) => [round(p.lat), round(p.lon)]);
  const latM = 111_320;
  const lonM = 111_320 * Math.cos(((points[0]?.lat ?? 21.4) * Math.PI) / 180);
  const xy = points.map((p) => [p.lon * lonM, p.lat * latM] as const);
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = xy[a]!;
    const [bx, by] = xy[b]!;
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    let worst = -1;
    let worstDistance = 0;
    for (let i = a + 1; i < b; i += 1) {
      const [px, py] = xy[i]!;
      const distance =
        length === 0
          ? Math.hypot(px - ax, py - ay)
          : Math.abs(dy * px - dx * py + bx * ay - by * ax) / length;
      if (distance > worstDistance) {
        worstDistance = distance;
        worst = i;
      }
    }
    if (worst > 0 && worstDistance > toleranceM) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  const out: Array<[number, number]> = [];
  points.forEach((p, i) => {
    if (keep[i]) out.push([round(p.lat), round(p.lon)]);
  });
  return out;
}

const round = (value: number) => Math.round(value * 100_000) / 100_000;
