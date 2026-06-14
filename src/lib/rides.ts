import {
  collection, doc, addDoc, onSnapshot, query, where,
  updateDoc, serverTimestamp, getDocs, deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VanStatus = 'available' | 'on_route' | 'charter' | 'maintenance';

export type SimVan = {
  id: string;
  number: number;
  label: string;
  status: VanStatus;
  lat: number;
  lng: number;
  routeId: string | null;
  routeName: string | null;
  seatsAvailable: number;
};

export type RouteWaypoint = { lat: number; lng: number };

export type StaticRoute = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  pricePerRider: number;
  compPrice: number;        // Uber XL equivalent per rider
  departureTime: string;
  returnTime: string;
  durationLabel: string;
  pickupName: string;
  pickupLat: number;
  pickupLng: number;
  dropoffName: string;
  dropoffLat: number;
  dropoffLng: number;
  distanceMiles: number;
  maxPassengers: number;
  frequency: string;
  waypoints: RouteWaypoint[];
  cycleDurationMs: number;
};

export type BookingStatus = 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';

export type Booking = {
  id: string;
  uid: string;
  displayName: string;
  routeId: string;
  routeName: string;
  isCharter: boolean;
  vanId: string | null;
  vanLabel: string | null;
  seats: number;
  totalPrice: number;
  pickupName: string;
  dropoffName: string;
  scheduledDate: string;
  departureTime: string;
  status: BookingStatus;
  paymentLast4: string | null;
  charterDestination?: string;
  charterNotes?: string;
  createdAt: number;
};

export type PaymentMethod = {
  id: string;
  label: string;
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  addedAt: number;
};

// ─── Static Routes ────────────────────────────────────────────────────────────

const BUFFALO_HUB = { lat: 42.8864, lng: -78.8784 };

export const STATIC_ROUTES: StaticRoute[] = [
  {
    id: 'nyc-shopping',
    name: 'NYC Shopping Turnaround',
    emoji: '🗽',
    description: 'Day trip to New York City. Departs Buffalo 6 AM, arrives NYC 1 PM. Departs NYC 6 PM, arrives Buffalo 1 AM.',
    pricePerRider: 45,
    compPrice: 140,
    departureTime: '6:00 AM',
    returnTime: '1:00 AM',
    durationLabel: '19 hr round trip',
    pickupName: 'Buffalo Central Terminal Hub',
    pickupLat: 42.8864,
    pickupLng: -78.8784,
    dropoffName: 'Manhattan / Times Square',
    dropoffLat: 40.7580,
    dropoffLng: -73.9855,
    distanceMiles: 600,
    maxPassengers: 15,
    frequency: 'Weekends',
    waypoints: [
      { lat: 42.8864, lng: -78.8784 }, // Buffalo
      { lat: 43.1566, lng: -77.6088 }, // Rochester
      { lat: 43.0481, lng: -76.1474 }, // Syracuse
      { lat: 42.6526, lng: -73.7562 }, // Albany
      { lat: 41.5623, lng: -74.0234 }, // Newburgh
      { lat: 40.7580, lng: -73.9855 }, // NYC
    ],
    cycleDurationMs: 19 * 60 * 60 * 1000,
  },
  {
    id: 'darien-lake',
    name: 'Darien Lake Theme Park',
    emoji: '🎢',
    description: 'Round trip to Darien Lake theme park. Perfect for group outings — way cheaper than Uber XL.',
    pricePerRider: 18,
    compPrice: 28,
    departureTime: '9:00 AM',
    returnTime: '8:00 PM',
    durationLabel: '~2.5 hr round trip',
    pickupName: 'Buffalo Central Terminal Hub',
    pickupLat: 42.8864,
    pickupLng: -78.8784,
    dropoffName: 'Darien Lake Theme Park',
    dropoffLat: 42.8863,
    dropoffLng: -78.4945,
    distanceMiles: 70,
    maxPassengers: 15,
    frequency: 'Daily (seasonal)',
    waypoints: [
      { lat: 42.8864, lng: -78.8784 }, // Buffalo
      { lat: 42.8875, lng: -78.7200 }, // Cheektowaga
      { lat: 42.8869, lng: -78.6100 }, // Lancaster
      { lat: 42.8863, lng: -78.4945 }, // Darien Lake
    ],
    cycleDurationMs: 2.5 * 60 * 60 * 1000,
  },
  {
    id: 'clifton-hill',
    name: 'Clifton Hill · Niagara Falls',
    emoji: '🌊',
    description: 'Cross the border to Clifton Hill entertainment district, steps from Niagara Falls.',
    pricePerRider: 15,
    compPrice: 24,
    departureTime: '10:00 AM',
    returnTime: '6:00 PM',
    durationLabel: '~2 hr round trip',
    pickupName: 'Buffalo Central Terminal Hub',
    pickupLat: 42.8864,
    pickupLng: -78.8784,
    dropoffName: 'Clifton Hill, Niagara Falls ON',
    dropoffLat: 43.0896,
    dropoffLng: -79.0849,
    distanceMiles: 50,
    maxPassengers: 15,
    frequency: 'Daily',
    waypoints: [
      { lat: 42.8864, lng: -78.8784 }, // Buffalo
      { lat: 43.0271, lng: -78.9648 }, // Grand Island
      { lat: 43.0623, lng: -79.0320 }, // Niagara Falls NY side
      { lat: 43.0896, lng: -79.0849 }, // Clifton Hill
    ],
    cycleDurationMs: 2 * 60 * 60 * 1000,
  },
  {
    id: 'toronto',
    name: 'Toronto, Ontario',
    emoji: '🇨🇦',
    description: 'Cross-border group ride to Toronto. We handle the border so you handle the good time.',
    pricePerRider: 45,
    compPrice: 100,
    departureTime: '8:00 AM',
    returnTime: '10:00 PM',
    durationLabel: '~5 hr round trip',
    pickupName: 'Buffalo Central Terminal Hub',
    pickupLat: 42.8864,
    pickupLng: -78.8784,
    dropoffName: 'Downtown Toronto',
    dropoffLat: 43.6532,
    dropoffLng: -79.3832,
    distanceMiles: 200,
    maxPassengers: 12,
    frequency: 'Daily',
    waypoints: [
      { lat: 42.8864, lng: -78.8784 }, // Buffalo
      { lat: 42.9003, lng: -78.9047 }, // Peace Bridge / Fort Erie
      { lat: 43.0894, lng: -79.2276 }, // St. Catharines
      { lat: 43.2557, lng: -79.8711 }, // Hamilton
      { lat: 43.6532, lng: -79.3832 }, // Toronto
    ],
    cycleDurationMs: 5 * 60 * 60 * 1000,
  },
  {
    id: 'regional-jails',
    name: 'Regional Corrections Visits',
    emoji: '🏛️',
    description: 'Comfortable, dignified transport to Erie County Holding Center and Alden Correctional. Book seats individually.',
    pricePerRider: 18,
    compPrice: 28,
    departureTime: '7:00 AM',
    returnTime: '5:00 PM',
    durationLabel: '~2 hr round trip',
    pickupName: 'Buffalo Central Terminal Hub',
    pickupLat: 42.8864,
    pickupLng: -78.8784,
    dropoffName: 'Alden Correctional Facility',
    dropoffLat: 42.9027,
    dropoffLng: -78.4883,
    distanceMiles: 70,
    maxPassengers: 15,
    frequency: 'Daily (visiting hours)',
    waypoints: [
      { lat: 42.8864, lng: -78.8784 }, // Buffalo
      { lat: 42.8862, lng: -78.8734 }, // Erie County Holding Center
      { lat: 42.8901, lng: -78.6800 }, // Lancaster
      { lat: 42.9027, lng: -78.4883 }, // Alden Correctional
    ],
    cycleDurationMs: 2 * 60 * 60 * 1000,
  },
];

// ─── Fleet Simulation ─────────────────────────────────────────────────────────
// Deterministic: all clients compute the same position from Date.now().
// No Firestore writes required for simulation.

const VAN_LABELS = [
  'Squadron 1', 'Squadron 2', 'Squadron 3', 'Squadron 4', 'Squadron 5',
  'Squadron 6', 'Squadron 7', 'Squadron 8', 'Squadron 9', 'Squadron 10',
];

// Phase offsets (0-1) so vans spread across their routes rather than bunching.
const VAN_PHASES = [0, 0.35, 0.12, 0.68, 0.5, 0.22, 0.81, 0.44, 0.07, 0.62];

// Route assignment per van (index = van number 1-10, value = route id or null).
const VAN_ROUTES = [
  'nyc-shopping',   // 1
  'nyc-shopping',   // 2
  'darien-lake',    // 3
  'clifton-hill',   // 4
  'toronto',        // 5
  'toronto',        // 6
  'regional-jails', // 7
  'darien-lake',    // 8
  null,             // 9 — available for charter
  null,             // 10 — maintenance / available
];

function interpolateWaypoints(
  waypoints: RouteWaypoint[],
  fraction: number
): { lat: number; lng: number } {
  // fraction 0-1 covers outbound trip; 0.5-1 is return (reversed)
  const isReturn = fraction >= 0.5;
  const pts = isReturn ? [...waypoints].reverse() : waypoints;
  const f = isReturn ? (fraction - 0.5) * 2 : fraction * 2;
  const segments = pts.length - 1;
  const segF = f * segments;
  const seg = Math.min(Math.floor(segF), segments - 1);
  const t = segF - seg;
  const a = pts[seg];
  const b = pts[seg + 1];
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

export function simulateFleet(now = Date.now()): SimVan[] {
  return VAN_LABELS.map((label, i) => {
    const vanNum = i + 1;
    const routeId = VAN_ROUTES[i];
    const phase = VAN_PHASES[i];

    if (!routeId) {
      // Available / maintenance — drift randomly near the Buffalo hub
      const seed = (vanNum * 7919 + now / 60000) % 1;
      const drift = 0.02;
      return {
        id: `van-${vanNum}`,
        number: vanNum,
        label,
        status: vanNum === 10 ? 'maintenance' : 'available',
        lat: BUFFALO_HUB.lat + (Math.sin(seed * Math.PI * 2) * drift),
        lng: BUFFALO_HUB.lng + (Math.cos(seed * Math.PI * 2) * drift),
        routeId: null,
        routeName: null,
        seatsAvailable: vanNum === 10 ? 0 : 15,
      } satisfies SimVan;
    }

    const route = STATIC_ROUTES.find(r => r.id === routeId)!;
    const elapsed = (now + phase * route.cycleDurationMs) % route.cycleDurationMs;
    const fraction = elapsed / route.cycleDurationMs;
    const pos = interpolateWaypoints(route.waypoints, fraction);
    const onRoute = fraction > 0.02 && fraction < 0.98;

    return {
      id: `van-${vanNum}`,
      number: vanNum,
      label,
      status: onRoute ? 'on_route' : 'available',
      lat: pos.lat,
      lng: pos.lng,
      routeId,
      routeName: route.name,
      seatsAvailable: onRoute ? Math.floor(Math.random() * 8) + 4 : 15,
    } satisfies SimVan;
  });
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

const demo = !db;

function dkey(k: string) { return `squadren.rides.${k}`; }
function dget<T>(k: string, fb: T): T {
  const v = localStorage.getItem(dkey(k));
  return v ? (JSON.parse(v) as T) : fb;
}
function dset<T>(k: string, v: T) { localStorage.setItem(dkey(k), JSON.stringify(v)); }

export async function createBooking(
  b: Omit<Booking, 'id' | 'createdAt'>
): Promise<string> {
  const payload: Omit<Booking, 'id'> = { ...b, createdAt: Date.now() };
  if (demo) {
    const id = 'bk-' + Date.now();
    const list = dget<Booking[]>('bookings', []);
    list.unshift({ ...payload, id });
    dset('bookings', list);
    return id;
  }
  const ref = await addDoc(collection(db!, 'rideBookings'), {
    ...payload,
    createdAtTs: serverTimestamp(),
  });
  return ref.id;
}

export function watchMyBookings(uid: string, cb: (b: Booking[]) => void) {
  if (demo) {
    const tick = () => cb(dget<Booking[]>('bookings', []).filter(b => b.uid === uid));
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }
  const q = query(collection(db!, 'rideBookings'), where('uid', '==', uid));
  return onSnapshot(q, snap => {
    cb(
      snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) } as Booking))
        .sort((a, b) => b.createdAt - a.createdAt)
    );
  });
}

export async function cancelBooking(id: string) {
  if (demo) {
    const list = dget<Booking[]>('bookings', []);
    const b = list.find(x => x.id === id);
    if (b) b.status = 'cancelled';
    dset('bookings', list);
    return;
  }
  await updateDoc(doc(db!, 'rideBookings', id), { status: 'cancelled' });
}

// ─── Payment Methods ──────────────────────────────────────────────────────────

export async function addPaymentMethod(
  uid: string,
  pm: Omit<PaymentMethod, 'id' | 'addedAt'>
): Promise<string> {
  const payload: Omit<PaymentMethod, 'id'> = { ...pm, addedAt: Date.now() };
  if (demo) {
    const id = 'pm-' + Date.now();
    const list = dget<PaymentMethod[]>(`pm-${uid}`, []);
    if (pm.isDefault) list.forEach(x => (x.isDefault = false));
    list.unshift({ ...payload, id });
    dset(`pm-${uid}`, list);
    return id;
  }
  const ref = await addDoc(collection(db!, 'users', uid, 'paymentMethods'), payload);
  return ref.id;
}

export async function removePaymentMethod(uid: string, pmId: string) {
  if (demo) {
    const list = dget<PaymentMethod[]>(`pm-${uid}`, []).filter(p => p.id !== pmId);
    dset(`pm-${uid}`, list);
    return;
  }
  await deleteDoc(doc(db!, 'users', uid, 'paymentMethods', pmId));
}

export async function getPaymentMethods(uid: string): Promise<PaymentMethod[]> {
  if (demo) return dget<PaymentMethod[]>(`pm-${uid}`, []);
  const snap = await getDocs(collection(db!, 'users', uid, 'paymentMethods'));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as PaymentMethod));
}

// ─── Charter Pricing ──────────────────────────────────────────────────────────

export const CHARTER_FLAT_RATE = 350;
export const CHARTER_NOTE = 'Flat rate per trip · up to 15 passengers · fuel, driver & insurance included';

// ─── APE — Algorithmic Pricing Engine ────────────────────────────────────────
// Inputs: rider count, distance, time-of-day, demand signal, seats filled.
// Returns a per-seat price and a human-readable breakdown.

export type ApeResult = {
  basePrice: number;
  riderDiscount: number;    // 0-25% — more riders = steeper discount
  demandSurcharge: number;  // 0-20% — peak hours / venue surge
  filledDiscount: number;   // 0-15% — van is already mostly full → fill last seats cheap
  finalPrice: number;
  savingsVsComp: number;    // vs Uber XL competitor price
  savingsPct: number;
  label: string;            // e.g. "Group Rate · 19% off"
};

export function computeApe(
  route: StaticRoute,
  seatsOccupied: number,       // how many seats are already taken on this van
  requestedSeats: number = 1,
  now = Date.now()
): ApeResult {
  const base = route.pricePerRider;
  const hour = new Date(now).getHours();

  // Rider-count discount: scales 0 → 25% as van fills up to max
  const fillRatio = Math.min(seatsOccupied / route.maxPassengers, 1);
  const riderDiscount = Math.round(fillRatio * 25);

  // Demand surcharge: peaks 8-10 AM and 4-7 PM
  const isPeak = (hour >= 8 && hour < 10) || (hour >= 16 && hour < 19);
  const demandSurcharge = isPeak ? 15 : 0;

  // Filled discount: if van is >70% full, drop price to fill remaining seats
  const filledDiscount = fillRatio >= 0.7 ? 12 : fillRatio >= 0.5 ? 6 : 0;

  const netDiscount = Math.max(0, riderDiscount + filledDiscount - demandSurcharge);
  const finalPrice = Math.max(base * 0.6, base * (1 - netDiscount / 100));
  const finalRounded = Math.round(finalPrice);

  const savingsVsComp = route.compPrice - finalRounded;
  const savingsPct = Math.round((savingsVsComp / route.compPrice) * 100);

  return {
    basePrice: base,
    riderDiscount,
    demandSurcharge,
    filledDiscount,
    finalPrice: finalRounded,
    savingsVsComp,
    savingsPct,
    label: netDiscount > 0
      ? `Group Rate · ${netDiscount}% off`
      : isPeak ? 'Peak Demand Pricing' : 'Standard Rate',
  };
}

// ─── Hitchhiker AI ────────────────────────────────────────────────────────────
// Finds vans currently en route that can pick up a user at a waypoint they
// haven't passed yet, heading toward the user's desired destination.

export type HitchhikeMatch = {
  van: SimVan;
  route: StaticRoute;
  pickupWaypointIdx: number;
  pickupName: string;
  pickupLat: number;
  pickupLng: number;
  minutesToPickup: number;     // estimated minutes until van reaches pickup point
  pricePerSeat: number;        // APE-computed price
  ape: ApeResult;
  isReturn: boolean;           // true if van is on return leg
};

// Keyword → route id mapping for destination matching
const DEST_KEYWORDS: { pattern: RegExp; routeId: string }[] = [
  { pattern: /new\s*york|nyc|manhattan|times\s*sq/i,   routeId: 'nyc-shopping' },
  { pattern: /toronto|ontario|scotiabank/i,             routeId: 'toronto' },
  { pattern: /niagara|clifton|falls/i,                  routeId: 'clifton-hill' },
  { pattern: /darien|six\s*flags|theme\s*park/i,        routeId: 'darien-lake' },
  { pattern: /jail|prison|correction|alden|erie\s*county/i, routeId: 'regional-jails' },
];

// Named waypoints for display (parallel to each route's waypoints array)
const WAYPOINT_NAMES: Record<string, string[]> = {
  'nyc-shopping':    ['Buffalo Hub', 'Rochester', 'Syracuse', 'Albany', 'Newburgh', 'New York City'],
  'darien-lake':     ['Buffalo Hub', 'Cheektowaga', 'Lancaster', 'Darien Lake'],
  'clifton-hill':    ['Buffalo Hub', 'Grand Island', 'Niagara Falls NY', 'Clifton Hill'],
  'toronto':         ['Buffalo Hub', 'Peace Bridge', 'St. Catharines', 'Hamilton', 'Toronto'],
  'regional-jails':  ['Buffalo Hub', 'Erie County HC', 'Lancaster', 'Alden Correctional'],
};

function haversineKm(a: RouteWaypoint, b: RouteWaypoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin2 = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
}

export function findHitchhikeMatches(
  destination: string,
  now = Date.now()
): HitchhikeMatch[] {
  const matched = DEST_KEYWORDS.filter(k => k.pattern.test(destination)).map(k => k.routeId);
  if (!matched.length) return [];

  const vans = simulateFleet(now);
  const results: HitchhikeMatch[] = [];

  for (const van of vans) {
    if (van.status !== 'on_route' || !van.routeId) continue;
    if (!matched.includes(van.routeId)) continue;
    if (van.seatsAvailable <= 0) continue;

    const route = STATIC_ROUTES.find(r => r.id === van.routeId);
    if (!route) continue;

    const phaseIdx = van.number - 1;
    const elapsed = (now + VAN_PHASES_EXPORT[phaseIdx] * route.cycleDurationMs) % route.cycleDurationMs;
    const fraction = elapsed / route.cycleDurationMs;
    const isReturn = fraction >= 0.5;

    // On outbound leg only (can pick up). Return leg vans are heading home.
    if (isReturn) continue;

    const waypoints = route.waypoints;
    const names = WAYPOINT_NAMES[route.id] || [];
    const vanProgressInSegments = fraction * 2 * (waypoints.length - 1);

    // Find the next waypoint the van hasn't reached yet (skip first = Buffalo)
    for (let wi = 1; wi < waypoints.length - 1; wi++) {
      const waypointProgress = wi; // each segment = 1 unit
      if (waypointProgress <= vanProgressInSegments) continue; // already passed

      // Estimate minutes: assume ~55 mph avg between waypoints
      const distToPickup = haversineKm({ lat: van.lat, lng: van.lng }, waypoints[wi]);
      const minutesToPickup = Math.round((distToPickup / 88) * 60); // 88 km/h avg

      const seatsOccupied = route.maxPassengers - van.seatsAvailable;
      const ape = computeApe(route, seatsOccupied, 1, now);

      results.push({
        van,
        route,
        pickupWaypointIdx: wi,
        pickupName: names[wi] || `Stop ${wi + 1}`,
        pickupLat: waypoints[wi].lat,
        pickupLng: waypoints[wi].lng,
        minutesToPickup,
        pricePerSeat: ape.finalPrice,
        ape,
        isReturn,
      });
      break; // take the first (closest upcoming) pickup point
    }
  }

  return results.sort((a, b) => a.minutesToPickup - b.minutesToPickup);
}

// Export phase offsets so FleetMapPage can use them for ETA math
export const VAN_PHASES_EXPORT = [0, 0.35, 0.12, 0.68, 0.5, 0.22, 0.81, 0.44, 0.07, 0.62];
