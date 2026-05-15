// Squad REN trips — plan a multi-stop journey, physically check in at each
// stop, broadcast your live path to your squad. Stops are reached when the
// user's GPS gets within REACH_RADIUS_M of the planned coordinate.

import {
  addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc,
  where, deleteDoc, arrayUnion, getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { haversine, type LatLng } from './geo';

export type TripStop = {
  placeName: string;
  lat: number;
  lng: number;
  reachedAt?: number | null;   // ms epoch when user physically arrived
  note?: string;
};

export type TripPathPoint = { lat: number; lng: number; t: number };

export type TripStatus = 'planned' | 'active' | 'completed' | 'cancelled';
export type TripVisibility = 'public' | 'squad' | 'private';

export type Trip = {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  status: TripStatus;
  visibility: TripVisibility;
  squadIds: string[];          // squads that can see the live path
  stops: TripStop[];
  path?: TripPathPoint[];      // recorded GPS breadcrumbs while active
  startedAt?: number | null;
  completedAt?: number | null;
  createdAt?: any;
  updatedAt?: any;
};

// Stops count as "reached" when the user is this close, in meters. ~80m
// matches typical coffee-shop / venue tolerance and most consumer GPS jitter.
export const STOP_REACH_M = 80;

// Live-path sampling: only persist a new breadcrumb when the user has moved
// at least this many meters or this much time has passed. Keeps Firestore
// writes sane without sacrificing visible smoothness.
export const PATH_MIN_M = 25;
export const PATH_MIN_MS = 10_000;

const demo = !db;

function dkey(k: string) { return `squadren.${k}`; }
function dget<T>(k: string, fb: T): T {
  const v = localStorage.getItem(dkey(k));
  return v ? JSON.parse(v) as T : fb;
}
function dset<T>(k: string, v: T) { localStorage.setItem(dkey(k), JSON.stringify(v)); }

function newId() { return 'trip-' + Date.now() + '-' + Math.floor(Math.random() * 1000); }

// ---------- CRUD ----------

export async function createTrip(t: Omit<Trip, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: TripStatus }): Promise<Trip> {
  const trip: Trip = {
    ...t,
    id: newId(),
    status: t.status || 'planned',
    path: t.path || [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  if (demo) {
    const list = dget<Trip[]>('trips', []);
    list.unshift(trip); dset('trips', list);
    return trip;
  }
  const ref = await addDoc(collection(db!, 'trips'), {
    ...trip,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { ...trip, id: ref.id };
}

export async function updateTrip(id: string, patch: Partial<Trip>) {
  if (demo) {
    const list = dget<Trip[]>('trips', []);
    const t = list.find(x => x.id === id);
    if (t) Object.assign(t, patch, { updatedAt: Date.now() });
    dset('trips', list);
    return;
  }
  await updateDoc(doc(db!, 'trips', id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteTrip(id: string) {
  if (demo) {
    const list = dget<Trip[]>('trips', []).filter(t => t.id !== id);
    dset('trips', list);
    return;
  }
  await deleteDoc(doc(db!, 'trips', id));
}

export async function startTrip(id: string) {
  await updateTrip(id, { status: 'active', startedAt: Date.now(), path: [] });
}

export async function completeTrip(id: string) {
  await updateTrip(id, { status: 'completed', completedAt: Date.now() });
}

// Append one breadcrumb to the live path. Throttled by caller via PATH_MIN_*.
export async function appendPathPoint(id: string, p: TripPathPoint) {
  if (demo) {
    const list = dget<Trip[]>('trips', []);
    const t = list.find(x => x.id === id);
    if (t) { t.path = [...(t.path || []), p].slice(-500); t.updatedAt = Date.now(); }
    dset('trips', list);
    return;
  }
  await updateDoc(doc(db!, 'trips', id), {
    path: arrayUnion(p),
    updatedAt: serverTimestamp()
  });
}

// Mark a specific stop reached. Used by the proximity detector in MapPage.
export async function markStopReached(id: string, stopIndex: number, reachedAt = Date.now()) {
  if (demo) {
    const list = dget<Trip[]>('trips', []);
    const t = list.find(x => x.id === id);
    if (t && t.stops[stopIndex]) {
      t.stops[stopIndex].reachedAt = reachedAt;
      t.updatedAt = Date.now();
    }
    dset('trips', list);
    return;
  }
  // Firestore can't patch array indices directly — read, mutate, write.
  const ref = doc(db!, 'trips', id);
  const snap = await getDoc(ref);
  const data = snap.data() as Trip | undefined;
  if (!data || !data.stops?.[stopIndex]) return;
  const stops = data.stops.map((s, i) => i === stopIndex ? { ...s, reachedAt } : s);
  await updateDoc(ref, { stops, updatedAt: serverTimestamp() });
}

// ---------- Watchers ----------

export function watchMyTrips(uid: string, cb: (trips: Trip[]) => void) {
  if (demo) {
    const tick = () => cb(dget<Trip[]>('trips', []).filter(t => t.ownerId === uid));
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }
  const q = query(collection(db!, 'trips'), where('ownerId', '==', uid));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Trip[]));
}

// Trips you can see live: anything from a squad you're in (visibility 'squad' or 'public')
// + anything publicly broadcast worldwide.
export function watchSquadTrips(squadIds: string[], cb: (trips: Trip[]) => void) {
  if (demo) {
    const tick = () => {
      const list = dget<Trip[]>('trips', []);
      cb(list.filter(t =>
        t.status === 'active' && (
          t.visibility === 'public' ||
          (t.visibility === 'squad' && t.squadIds.some(s => squadIds.includes(s)))
        )
      ));
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }
  if (squadIds.length === 0) {
    // Still subscribe to public active trips.
    const q = query(collection(db!, 'trips'),
      where('status', '==', 'active'),
      where('visibility', '==', 'public'));
    return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Trip[]));
  }
  // Two parallel queries (public + squad) merged client-side.
  let publicTrips: Trip[] = []; let squadTrips: Trip[] = [];
  const emit = () => {
    const merged = [...publicTrips];
    for (const t of squadTrips) if (!merged.find(x => x.id === t.id)) merged.push(t);
    cb(merged);
  };
  const qPub = query(collection(db!, 'trips'),
    where('status', '==', 'active'),
    where('visibility', '==', 'public'));
  const qSq = query(collection(db!, 'trips'),
    where('status', '==', 'active'),
    where('squadIds', 'array-contains-any', squadIds.slice(0, 30)));
  const u1 = onSnapshot(qPub, snap => { publicTrips = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Trip[]; emit(); });
  const u2 = onSnapshot(qSq, snap => { squadTrips = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Trip[]; emit(); });
  return () => { u1(); u2(); };
}

// ---------- Helpers ----------

// Returns the index of the first unreached stop within STOP_REACH_M of pos,
// or -1 if none. Used by the auto-arrival detector.
export function findReachedStop(trip: Trip, pos: LatLng): number {
  for (let i = 0; i < trip.stops.length; i++) {
    const s = trip.stops[i];
    if (s.reachedAt) continue;
    if (haversine(pos, { lat: s.lat, lng: s.lng }) <= STOP_REACH_M) return i;
  }
  return -1;
}

// Total kilometers between consecutive path points.
export function pathDistanceKm(path: TripPathPoint[] | undefined): number {
  if (!path || path.length < 2) return 0;
  let m = 0;
  for (let i = 1; i < path.length; i++) {
    m += haversine(path[i - 1], path[i]);
  }
  return m / 1000;
}
