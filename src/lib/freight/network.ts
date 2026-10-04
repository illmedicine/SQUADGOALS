// Live network state: where each driver is right now, what's next on their
// journey, and which drivers can carry a shipment between two places.
import type { LatLng } from '../geo';
import type { Booking, BookingStatus, Driver } from './types';
import { routeGeom, durationMs, milesAfter, msToMiles, pointAtMile, nearestOnRoute, isResting, type RouteGeom } from './route';
import type { CargoSpace } from './cargo';
import { CITY_BY_ID, type City } from './cities';

export type Journey = { departAt: number; arriveAt: number; geom: RouteGeom };

export function journeyAt(d: Driver, k: number): Journey | null {
  const it = d.itinerary;
  if (!it || it.stops.length < 2) return null;
  const reverse = it.roundTrip && ((k % 2) + 2) % 2 === 1;
  const geom = routeGeom(reverse ? [...it.stops].reverse() : it.stops);
  const departAt = it.departAt + (it.repeatEveryMs ? k * it.repeatEveryMs : 0);
  return { departAt, arriveAt: departAt + durationMs(geom.totalMiles), geom };
}

// Index of the journey cycle in effect at `now` (current, or most recently finished).
function cycleIndex(d: Driver, now: number) {
  const it = d.itinerary;
  if (!it?.repeatEveryMs) return 0;
  return Math.max(0, Math.floor((now - it.departAt) / it.repeatEveryMs));
}

// Upcoming / in-progress journeys, soonest first.
export function upcomingJourneys(d: Driver, now: number, count = 3): Journey[] {
  const out: Journey[] = [];
  if (!d.itinerary) return out;
  let k = cycleIndex(d, now);
  const limit = d.itinerary.repeatEveryMs ? count + 1 : 1;
  for (let i = 0; i < limit && out.length < count; i++, k++) {
    const j = journeyAt(d, k);
    if (j && j.arriveAt > now) out.push(j);
  }
  return out;
}

export type LiveStatus = 'driving' | 'resting' | 'layover' | 'scheduled' | 'offline';

export type LiveState = {
  pos: LatLng;
  heading: number;
  status: LiveStatus;
  journey: Journey | null;
  mile: number;
  progress: number;
  nextStop: City | null;
  nextStopEta: number | null;
  lastStop: City | null;
};

export function liveState(d: Driver, now: number): LiveState {
  const home = CITY_BY_ID[d.homeBase] ?? CITY_BY_ID['kansas-city'];
  const j = journeyAt(d, cycleIndex(d, now));
  const fresh = d.live && now - d.live.at < 15 * 60_000;
  if (!j) {
    const pos = fresh ? d.live! : home;
    return { pos, heading: 90, status: d.online ? 'layover' : 'offline', journey: null, mile: 0, progress: 0, nextStop: null, nextStopEta: null, lastStop: null };
  }
  const elapsed = now - j.departAt;
  const g = j.geom;
  let mile = Math.min(g.totalMiles, milesAfter(elapsed));
  let status: LiveStatus = elapsed < 0 ? 'scheduled' : mile >= g.totalMiles ? 'layover' : isResting(elapsed) ? 'resting' : 'driving';
  if (elapsed < 0) mile = 0;
  const p = pointAtMile(g, mile);
  let pos: LatLng = p;
  if (!d.seeded && fresh) {
    pos = d.live!;
    const near = nearestOnRoute(g, pos);
    if (near) mile = near.point.mile;
  }
  if (!d.online && !d.seeded) status = 'offline';
  let nextIdx = g.stopMiles.findIndex(m => m > mile + 0.5);
  const nextStop = nextIdx >= 0 ? g.stops[nextIdx] : null;
  const lastStop = nextIdx > 0 ? g.stops[nextIdx - 1] : nextIdx === -1 ? g.stops[g.stops.length - 1] : g.stops[0];
  const nextStopEta = nextIdx >= 0 ? j.departAt + msToMiles(g.stopMiles[nextIdx]) : null;
  return { pos, heading: p.heading, status, journey: j, mile, progress: mile / g.totalMiles, nextStop, nextStopEta: nextStopEta && Math.max(now, nextStopEta), lastStop };
}

export type Match = {
  driver: Driver;
  journey: Journey;
  pickupMile: number;
  dropoffMile: number;
  pickupEta: number;
  dropoffEta: number;
  pickupOffRoute: number;
  dropoffOffRoute: number;
  tripMiles: number;
};

export function findMatches(drivers: Driver[], from: LatLng, to: LatLng, opts: { now: number; radiusMi?: number; earliest?: number }): Match[] {
  const radius = opts.radiusMi ?? 75;
  const earliest = Math.max(opts.now, opts.earliest ?? 0);
  const out: Match[] = [];
  for (const d of drivers) {
    if (!d.online && !d.seeded) continue;
    const live = liveState(d, opts.now);
    for (const j of upcomingJourneys(d, opts.now, 3)) {
      const after = live.journey && live.journey.departAt === j.departAt ? live.mile : -1;
      const pick = nearestOnRoute(j.geom, from, after);
      if (!pick || pick.offRouteMiles > radius) continue;
      const drop = nearestOnRoute(j.geom, to, pick.point.mile + 10);
      if (!drop || drop.offRouteMiles > radius) continue;
      const pickupEta = j.departAt + msToMiles(pick.point.mile);
      if (pickupEta < earliest - 30 * 60_000) continue;
      out.push({
        driver: d,
        journey: j,
        pickupMile: pick.point.mile,
        dropoffMile: drop.point.mile,
        pickupEta,
        dropoffEta: j.departAt + msToMiles(drop.point.mile),
        pickupOffRoute: pick.offRouteMiles,
        dropoffOffRoute: drop.offRouteMiles,
        tripMiles: drop.point.mile - pick.point.mile,
      });
      break;
    }
  }
  return out.sort((a, b) => a.pickupEta - b.pickupEta);
}

// Pickup/drop-off along a specific journey for two arbitrary points.
export function legFor(j: Journey, from: LatLng, to: LatLng, afterMile = -1) {
  const pick = nearestOnRoute(j.geom, from, afterMile);
  if (!pick) return null;
  const drop = nearestOnRoute(j.geom, to, pick.point.mile + 1);
  if (!drop) return null;
  return {
    pickupMile: pick.point.mile,
    dropoffMile: drop.point.mile,
    pickupEta: j.departAt + msToMiles(pick.point.mile),
    dropoffEta: j.departAt + msToMiles(drop.point.mile),
    pickupOffRoute: pick.offRouteMiles,
    dropoffOffRoute: drop.offRouteMiles,
    tripMiles: drop.point.mile - pick.point.mile,
  };
}

export function stopEtas(j: Journey) {
  return j.geom.stops.map((c, i) => ({ city: c, mile: j.geom.stopMiles[i], eta: j.departAt + msToMiles(j.geom.stopMiles[i]) }));
}

// Advertised space minus what's already sold. Real drivers publish their
// booked total on their profile; seeded drivers have no backend, so we derive
// it from the viewer's own bookings.
export function remainingCargo(d: Driver, bookings: Booking[], now = Date.now()): CargoSpace {
  const own = bookings.filter(b => {
    if (b.driverId !== d.id) return false;
    const s = effectiveStatus(b, now);
    return s === 'accepted' || s === 'picked_up' || (d.seeded && s === 'requested');
  });
  const ownSqft = own.reduce((s, b) => s + b.footprintSqft, 0);
  const ownLbs = own.reduce((s, b) => s + b.item.weight * b.item.qty, 0);
  const usedSqft = Math.max(d.booked?.sqft ?? 0, ownSqft);
  const usedLbs = Math.max(d.booked?.lbs ?? 0, ownLbs);
  return { ...d.cargo, sqft: Math.max(0, d.cargo.sqft - usedSqft), maxWeight: Math.max(0, d.cargo.maxWeight - usedLbs) };
}

// Demo drivers don't have a human behind them, so their side of the workflow
// is simulated: auto-accept a few seconds after request, then follow the clock.
export function effectiveStatus(b: Booking, now: number): BookingStatus {
  if (!b.driverId.startsWith('seed-')) return b.status;
  if (b.status === 'cancelled' || b.status === 'declined') return b.status;
  if (b.status === 'requested' && now - b.createdAt < 4000) return 'requested';
  if (now >= b.dropoffEta) return 'delivered';
  if (now >= b.pickupEta) return 'picked_up';
  return 'accepted';
}

export const STATUS_LABEL: Record<LiveStatus, string> = {
  driving: 'Driving',
  resting: 'HOS rest break',
  layover: 'At destination',
  scheduled: 'Departing soon',
  offline: 'Offline',
};
export const STATUS_COLOR: Record<LiveStatus, string> = {
  driving: '#22c55e',
  resting: '#f59e0b',
  layover: '#60a5fa',
  scheduled: '#a78bfa',
  offline: '#6b7280',
};
