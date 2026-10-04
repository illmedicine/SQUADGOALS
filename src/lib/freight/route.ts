// Route geometry + time model for driver journeys.
//
// Trucks follow a polyline through gazetteer cities. Time is modelled with an
// hours-of-service cycle (11h driving at highway pace, then a 10h rest), so ETAs
// look like real long-haul schedules and trucks visibly park overnight.
import { haversine, type LatLng } from '../geo';
import { CITY_BY_ID, type City } from './cities';

export const ROAD_FACTOR = 1.18;           // straight-line → road miles
export const MPH = 55;
export const DRIVE_H = 11;
export const REST_H = 10;
const H = 3_600_000;
const MILES_PER_CYCLE = MPH * DRIVE_H;
const CYCLE_MS = (DRIVE_H + REST_H) * H;

export const metersToMiles = (m: number) => m / 1609.344;
export const roadMiles = (a: LatLng, b: LatLng) => metersToMiles(haversine(a, b)) * ROAD_FACTOR;

export type RoutePoint = LatLng & { mile: number };
export type RouteGeom = { stops: City[]; points: RoutePoint[]; stopMiles: number[]; totalMiles: number };

const geomCache = new Map<string, RouteGeom>();

// Densify each leg every ~15 miles so map lines and nearest-point search are smooth.
export function routeGeom(stopIds: string[]): RouteGeom {
  const key = stopIds.join('>');
  const hit = geomCache.get(key);
  if (hit) return hit;
  const stops = stopIds.map(id => CITY_BY_ID[id]).filter(Boolean);
  const points: RoutePoint[] = [];
  const stopMiles: number[] = [];
  let mile = 0;
  for (let i = 0; i < stops.length; i++) {
    const a = stops[i];
    stopMiles.push(mile);
    if (i === 0) points.push({ lat: a.lat, lng: a.lng, mile: 0 });
    const b = stops[i + 1];
    if (!b) break;
    const legMiles = roadMiles(a, b);
    const n = Math.max(1, Math.ceil(legMiles / 15));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      points.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, mile: mile + legMiles * t });
    }
    mile += legMiles;
  }
  const g = { stops, points, stopMiles, totalMiles: mile };
  geomCache.set(key, g);
  return g;
}

// Elapsed ms → miles travelled under the HOS cycle.
export function milesAfter(ms: number): number {
  if (ms <= 0) return 0;
  const cycles = Math.floor(ms / CYCLE_MS);
  const rem = ms - cycles * CYCLE_MS;
  return cycles * MILES_PER_CYCLE + Math.min(rem, DRIVE_H * H) / H * MPH;
}

// Miles → elapsed ms (inverse of milesAfter, arriving at the earliest moment).
export function msToMiles(miles: number): number {
  if (miles <= 0) return 0;
  const cycles = Math.floor(miles / MILES_PER_CYCLE);
  const rem = miles - cycles * MILES_PER_CYCLE;
  if (rem < 1e-6 && cycles > 0) return (cycles - 1) * CYCLE_MS + DRIVE_H * H;
  return cycles * CYCLE_MS + (rem / MPH) * H;
}

export function isResting(elapsedMs: number) {
  if (elapsedMs <= 0) return false;
  return elapsedMs % CYCLE_MS > DRIVE_H * H;
}

export function pointAtMile(g: RouteGeom, mile: number): LatLng & { heading: number } {
  const pts = g.points;
  if (mile <= 0) return { ...pts[0], heading: bearing(pts[0], pts[1] ?? pts[0]) };
  if (mile >= g.totalMiles) {
    const last = pts[pts.length - 1];
    return { ...last, heading: bearing(pts[pts.length - 2] ?? last, last) };
  }
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].mile <= mile) lo = mid; else hi = mid;
  }
  const a = pts[lo], b = pts[hi];
  const t = (mile - a.mile) / Math.max(1e-9, b.mile - a.mile);
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, heading: bearing(a, b) };
}

export function bearing(a: LatLng, b: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function durationMs(totalMiles: number) {
  return msToMiles(totalMiles);
}

// Nearest route point to `p`, optionally searching only after mile `afterMile`.
export function nearestOnRoute(g: RouteGeom, p: LatLng, afterMile = -1) {
  let best: RoutePoint | null = null;
  let bestMi = Infinity;
  for (const pt of g.points) {
    if (pt.mile <= afterMile) continue;
    const d = metersToMiles(haversine(pt, p));
    if (d < bestMi) { bestMi = d; best = pt; }
  }
  return best ? { point: best, offRouteMiles: bestMi } : null;
}

export const fmtDuration = (ms: number) => {
  const h = Math.round(ms / H);
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))} min`;
  if (h < 36) return `${h} hr`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d} days`;
};

export const fmtWhen = (t: number) => {
  const d = new Date(t);
  const now = new Date();
  const dayDiff = Math.round((new Date(d.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / 86_400_000);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === 1) return `Tomorrow ${time}`;
  if (dayDiff === -1) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
};
