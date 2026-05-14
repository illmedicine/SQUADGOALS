import {
  collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
  addDoc, getDocs, arrayUnion, arrayRemove, writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { haversine, type LatLng } from './geo';

export type Squad = {
  id: string;
  name: string;
  ownerId: string;
  members: string[];          // uids
  visibility: 'public' | 'private';
  createdAt?: any;
};

export type Presence = {
  uid: string;
  displayName: string;
  lat: number;
  lng: number;
  updatedAt: any;
  placeName?: string | null;
  squadIds: string[];
  shareLocation: boolean;
};

const demo = !db;

// --- Demo (no Firebase) in-memory + localStorage stores ---
function dkey(k: string) { return `squadren.${k}`; }
function dget<T>(k: string, fb: T): T {
  const v = localStorage.getItem(dkey(k));
  return v ? JSON.parse(v) as T : fb;
}
function dset<T>(k: string, v: T) { localStorage.setItem(dkey(k), JSON.stringify(v)); }

// ---------- Squads ----------
export async function createSquad(s: Omit<Squad, 'id' | 'createdAt'>) {
  if (demo) {
    const list = dget<Squad[]>('squads', []);
    const sq: Squad = { ...s, id: 'sq-' + Date.now() };
    list.push(sq); dset('squads', list);
    return sq;
  }
  const ref = await addDoc(collection(db!, 'squads'), { ...s, createdAt: serverTimestamp() });
  return { id: ref.id, ...s } as Squad;
}

export async function joinSquad(squadId: string, uid: string) {
  if (demo) {
    const list = dget<Squad[]>('squads', []);
    const sq = list.find(s => s.id === squadId);
    if (sq && !sq.members.includes(uid)) sq.members.push(uid);
    dset('squads', list);
    return;
  }
  await updateDoc(doc(db!, 'squads', squadId), { members: arrayUnion(uid) });
}

export async function leaveSquad(squadId: string, uid: string) {
  if (demo) {
    const list = dget<Squad[]>('squads', []);
    const sq = list.find(s => s.id === squadId);
    if (sq) sq.members = sq.members.filter(m => m !== uid);
    dset('squads', list);
    return;
  }
  await updateDoc(doc(db!, 'squads', squadId), { members: arrayRemove(uid) });
}

export function watchUserSquads(uid: string, cb: (squads: Squad[]) => void) {
  if (demo) {
    const tick = () => cb(dget<Squad[]>('squads', []).filter(s => s.members.includes(uid)));
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }
  const q = query(collection(db!, 'squads'), where('members', 'array-contains', uid));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  });
}

export async function listPublicSquads(): Promise<Squad[]> {
  if (demo) return dget<Squad[]>('squads', []).filter(s => s.visibility === 'public');
  const q = query(collection(db!, 'squads'), where('visibility', '==', 'public'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Squad[];
}

// ---------- Presence ----------
export async function updatePresence(p: Omit<Presence, 'updatedAt'>) {
  if (demo) {
    const all = dget<Presence[]>('presence', []);
    const idx = all.findIndex(x => x.uid === p.uid);
    const next: Presence = { ...p, updatedAt: Date.now() };
    if (idx >= 0) all[idx] = next; else all.push(next);
    dset('presence', all);
    return;
  }
  await setDoc(doc(db!, 'presence', p.uid), { ...p, updatedAt: serverTimestamp() }, { merge: true });
}

export function watchSquadPresence(squadIds: string[], cb: (p: Presence[]) => void) {
  if (demo) {
    const tick = () => {
      const all = dget<Presence[]>('presence', []);
      cb(all.filter(p => p.shareLocation && p.squadIds.some(s => squadIds.includes(s))));
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }
  if (squadIds.length === 0) { cb([]); return () => {}; }
  // Firestore array-contains-any allows up to 30 values.
  const q = query(collection(db!, 'presence'),
    where('shareLocation', '==', true),
    where('squadIds', 'array-contains-any', squadIds.slice(0, 30)));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => d.data() as Presence));
  });
}

// ---------- Visited places ----------
export type VisitedPlace = {
  uid: string;
  displayName: string;
  placeName: string;
  category?: string;
  lat: number;
  lng: number;
  visitedAt: any;
};

export async function logVisitedPlace(v: Omit<VisitedPlace, 'visitedAt'>) {
  if (demo) {
    const list = dget<VisitedPlace[]>('places', []);
    list.unshift({ ...v, visitedAt: Date.now() });
    dset('places', list.slice(0, 500));
    return;
  }
  await addDoc(collection(db!, 'visitedPlaces'), { ...v, visitedAt: serverTimestamp() });
}

export function watchVisitedPlaces(cb: (v: VisitedPlace[]) => void) {
  if (demo) {
    const tick = () => cb(dget<VisitedPlace[]>('places', []));
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }
  return onSnapshot(collection(db!, 'visitedPlaces'), snap => {
    cb(snap.docs.map(d => d.data() as VisitedPlace));
  });
}

// Watch only the current user's visited places — used for the personal
// "places I've been" overlay on the map.
export function watchMyVisitedPlaces(uid: string, cb: (v: VisitedPlace[]) => void) {
  if (demo) {
    const tick = () => cb(dget<VisitedPlace[]>('places', []).filter(p => p.uid === uid));
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }
  const q = query(collection(db!, 'visitedPlaces'), where('uid', '==', uid));
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data() as VisitedPlace)));
}

// Auto-log "places I've been" as the user moves. We only persist a new pin
// when the user is at least minDistanceM away from every existing pin AND
// hasn't logged anything in the last cooldownMs window. This keeps the map
// usable when the user is stationary.
const AUTO_RADIUS_M = 120;
const AUTO_COOLDOWN_MS = 60 * 1000;
let lastAutoAt = 0;
export async function maybeAutoLogVisit(uid: string, displayName: string, pos: LatLng, existing: VisitedPlace[]) {
  const now = Date.now();
  if (now - lastAutoAt < AUTO_COOLDOWN_MS) return false;
  const tooClose = existing.some(p => haversine(pos, { lat: p.lat, lng: p.lng }) < AUTO_RADIUS_M);
  if (tooClose) return false;
  lastAutoAt = now;
  await logVisitedPlace({
    uid, displayName,
    placeName: 'Visited spot',
    category: 'Auto',
    lat: pos.lat, lng: pos.lng
  });
  return true;
}

// ---------- Google Timeline import (Takeout) ----------
// Accepts either the legacy "Records.json" structure (locationHistory) or
// the new "Timeline.json" structure (semanticSegments / visit items) from
// Google Takeout's "Location History (Timeline)" archive. Deduplicates by
// rounding coords to ~110m grid and skipping anything already present.
export type TimelinePin = { lat: number; lng: number; placeName: string; visitedAt: number };

export function parseGoogleTimeline(text: string): TimelinePin[] {
  let json: any;
  try { json = JSON.parse(text); } catch { return []; }
  const out: TimelinePin[] = [];

  // Records.json: { locations: [{ latitudeE7, longitudeE7, timestamp }] }
  if (Array.isArray(json?.locations)) {
    const seen = new Set<string>();
    for (const r of json.locations) {
      if (typeof r.latitudeE7 !== 'number' || typeof r.longitudeE7 !== 'number') continue;
      const lat = r.latitudeE7 / 1e7;
      const lng = r.longitudeE7 / 1e7;
      const key = lat.toFixed(3) + ',' + lng.toFixed(3);
      if (seen.has(key)) continue;
      seen.add(key);
      const ts = r.timestamp ? Date.parse(r.timestamp) : (r.timestampMs ? Number(r.timestampMs) : Date.now());
      out.push({ lat, lng, placeName: 'Timeline point', visitedAt: ts });
    }
    return out;
  }

  // Semantic Location History: { timelineObjects: [{ placeVisit: { location, duration } }] }
  if (Array.isArray(json?.timelineObjects)) {
    for (const o of json.timelineObjects) {
      const pv = o.placeVisit;
      if (!pv?.location) continue;
      const lat = pv.location.latitudeE7 / 1e7;
      const lng = pv.location.longitudeE7 / 1e7;
      const name = pv.location.name || pv.location.address || 'Visited place';
      const ts = pv.duration?.startTimestamp ? Date.parse(pv.duration.startTimestamp) : Date.now();
      out.push({ lat, lng, placeName: name, visitedAt: ts });
    }
    return out;
  }

  // New Timeline.json (2024+): { semanticSegments: [{ visit: { topCandidate: { placeLocation: "geo:lat,lng" } } }] }
  if (Array.isArray(json?.semanticSegments)) {
    for (const s of json.semanticSegments) {
      const v = s.visit;
      const loc = v?.topCandidate?.placeLocation || v?.location;
      if (!loc || typeof loc !== 'string' || !loc.startsWith('geo:')) continue;
      const [lat, lng] = loc.slice(4).split(',').map(Number);
      if (!isFinite(lat) || !isFinite(lng)) continue;
      const name = v?.topCandidate?.semanticType || 'Visited place';
      const ts = s.startTime ? Date.parse(s.startTime) : Date.now();
      out.push({ lat, lng, placeName: name, visitedAt: ts });
    }
    return out;
  }

  return out;
}

export async function importTimelinePins(
  uid: string, displayName: string, pins: TimelinePin[],
  onProgress?: (done: number, total: number) => void
) {
  if (demo) {
    const list = dget<VisitedPlace[]>('places', []);
    for (const p of pins) {
      list.push({
        uid, displayName,
        placeName: p.placeName, category: 'Timeline',
        lat: p.lat, lng: p.lng, visitedAt: p.visitedAt
      });
    }
    dset('places', list.slice(0, 5000));
    onProgress?.(pins.length, pins.length);
    return pins.length;
  }
  // Firestore batched writes — 450 ops per batch to stay safely under 500.
  let written = 0;
  for (let i = 0; i < pins.length; i += 450) {
    const slice = pins.slice(i, i + 450);
    const batch = writeBatch(db!);
    for (const p of slice) {
      const ref = doc(collection(db!, 'visitedPlaces'));
      batch.set(ref, {
        uid, displayName,
        placeName: p.placeName, category: 'Timeline',
        lat: p.lat, lng: p.lng,
        visitedAt: new Date(p.visitedAt)
      });
    }
    await batch.commit();
    written += slice.length;
    onProgress?.(written, pins.length);
  }
  return written;
}
