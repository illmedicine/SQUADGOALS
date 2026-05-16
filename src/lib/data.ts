import {
  collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
  addDoc, getDocs, arrayUnion, arrayRemove, writeBatch, limit
} from 'firebase/firestore';
import { db } from './firebase';
import { haversine, type LatLng } from './geo';
import { demoPublicPresence, demoSquads } from './demoSeed';
import { buffaloDemoPresence, buffaloDemoSquad } from './buffaloDemo';
import { createPublicPin } from './publicPins';

export type DemoSquad = ReturnType<typeof demoSquads>[number];

export type Squad = {
  id: string;
  name: string;
  ownerId: string;            // squad leader (creator). Has admin powers.
  members: string[];          // approved uids (includes leader)
  pendingMembers?: string[];  // uids awaiting leader approval
  visibility: 'public' | 'private';
  logo?: string;              // SQUAD_LOGOS id, defaults to 'star'
  hq?: { lat: number; lng: number; placeName?: string }; // squad meeting grounds / HQ pin
  tags?: string[];            // interest tags for discovery (e.g., 'coffee', 'hiking')
  createdAt?: any;
};

export type Presence = {
  uid: string;
  displayName: string;
  avatar?: any;
  lat: number;
  lng: number;
  updatedAt: any;
  placeName?: string | null;
  squadIds: string[];
  shareLocation: boolean;
  // When true, this user is visible on the world-wide "Public" layer to
  // every signed-in Squad REN user, not just their squads.
  sharePublic?: boolean;
  // Snapshot of the user's storefront so other viewers can preview it
  // when they tap the avatar on the map. Only attached when visibility is
  // 'public'; squad-only / private storefronts are filtered upstream.
  storefront?: any;
  // Optional XP/tier snapshot so the map can render a prestige badge
  // without a second Firestore round-trip.
  xp?: number;
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

export async function updateSquadLogo(squadId: string, logo: string) {
  if (demo) {
    const list = dget<Squad[]>('squads', []);
    const sq = list.find(s => s.id === squadId);
    if (sq) sq.logo = logo;
    dset('squads', list);
    return;
  }
  await updateDoc(doc(db!, 'squads', squadId), { logo });
}

// Pin or move the squad's headquarters / meeting grounds. Only the leader
// (ownerId) should call this from the UI; we don't enforce server-side
// because the prototype runs without strict security rules.
export async function updateSquadHq(squadId: string, hq: { lat: number; lng: number; placeName?: string }) {
  if (demo) {
    const list = dget<Squad[]>('squads', []);
    const sq = list.find(s => s.id === squadId);
    if (sq) sq.hq = hq;
    dset('squads', list);
    return;
  }
  await updateDoc(doc(db!, 'squads', squadId), { hq });
}

// User taps a public squad's HQ on the map and asks to join. For public
// squads this enqueues the uid into `pendingMembers` until the leader
// approves or denies. (For backwards compatibility, callers that want the
// old "instant join" behaviour can still call `joinSquad` directly.)
export async function requestJoinSquad(squadId: string, uid: string) {
  if (demo) {
    const list = dget<Squad[]>('squads', []);
    const sq = list.find(s => s.id === squadId);
    if (!sq) return;
    if (sq.members.includes(uid)) return;
    sq.pendingMembers = sq.pendingMembers || [];
    if (!sq.pendingMembers.includes(uid)) sq.pendingMembers.push(uid);
    dset('squads', list);
    return;
  }
  await updateDoc(doc(db!, 'squads', squadId), { pendingMembers: arrayUnion(uid) });
}

export async function approveJoinRequest(squadId: string, uid: string) {
  if (demo) {
    const list = dget<Squad[]>('squads', []);
    const sq = list.find(s => s.id === squadId);
    if (!sq) return;
    sq.pendingMembers = (sq.pendingMembers || []).filter(u => u !== uid);
    if (!sq.members.includes(uid)) sq.members.push(uid);
    dset('squads', list);
    return;
  }
  await updateDoc(doc(db!, 'squads', squadId), {
    pendingMembers: arrayRemove(uid),
    members: arrayUnion(uid)
  });
}

export async function denyJoinRequest(squadId: string, uid: string) {
  if (demo) {
    const list = dget<Squad[]>('squads', []);
    const sq = list.find(s => s.id === squadId);
    if (!sq) return;
    sq.pendingMembers = (sq.pendingMembers || []).filter(u => u !== uid);
    dset('squads', list);
    return;
  }
  await updateDoc(doc(db!, 'squads', squadId), { pendingMembers: arrayRemove(uid) });
}

// Leader removes a member (cannot remove themselves; use leaveSquad +
// transfer ownership for that path which is out of scope here).
export async function removeSquadMember(squadId: string, uid: string) {
  if (demo) {
    const list = dget<Squad[]>('squads', []);
    const sq = list.find(s => s.id === squadId);
    if (sq) sq.members = sq.members.filter(m => m !== uid);
    dset('squads', list);
    return;
  }
  await updateDoc(doc(db!, 'squads', squadId), { members: arrayRemove(uid) });
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

// Live stream of public squads — used by the map to render HQ pins.
export function watchPublicSquadsLive(cb: (squads: Squad[]) => void) {
  const showcase = [buffaloDemoSquad() as Squad];
  if (demo) {
    const tick = () => cb([...dget<Squad[]>('squads', []).filter(s => s.visibility === 'public'), ...showcase]);
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }
  const q = query(collection(db!, 'squads'), where('visibility', '==', 'public'));
  return onSnapshot(q, snap => {
    cb([...snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Squad[], ...showcase]);
  });
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

// Returns every user who has opted in to *public* location sharing.
// Used to render the "world" presence layer alongside squad-mates.
export function watchPublicPresence(cb: (p: Presence[]) => void, max = 200) {
  // Demo presence is always overlaid so the world map feels alive.
  // Buffalo showcase squad is always included so new users immediately
  // see what an active hyper-local community looks like.
  const seeded = [...demoPublicPresence(), ...buffaloDemoPresence()];
  if (demo) {
    const tick = () => {
      const all = dget<Presence[]>('presence', []);
      cb([...all.filter(p => p.sharePublic), ...seeded].slice(0, max + seeded.length));
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }
  const q = query(collection(db!, 'presence'), where('sharePublic', '==', true), limit(max));
  return onSnapshot(q, snap => {
    cb([...snap.docs.map(d => d.data() as Presence), ...seeded]);
  });
}

// Demo squads with geographic centers — used to draw squad badges on the map.
export function listDemoSquads(): DemoSquad[] { return demoSquads(); }

// ---------- Visited places ----------
export type VisitedPlace = {
  uid: string;
  displayName: string;
  placeName: string;
  category?: string;
  lat: number;
  lng: number;
  visitedAt: any;
  rating?: number;     // 1-5 stars from Google Reviews export
  note?: string;       // review text / saved-place note
  publicPinId?: string; // if this place was also promoted to a public pin
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
// Optional async resolver lets callers (MapPage) enrich auto-logged visits with
// real place names from the Google Places API. Return null to skip logging
// entirely (e.g. when the GPS pin is in the middle of a highway with no POI).
export type AutoVisitResolver = (pos: LatLng) => Promise<{ placeName: string; category?: string } | null>;
export async function maybeAutoLogVisit(
  uid: string,
  displayName: string,
  pos: LatLng,
  existing: VisitedPlace[],
  resolver?: AutoVisitResolver
) {
  const now = Date.now();
  if (now - lastAutoAt < AUTO_COOLDOWN_MS) return false;
  const tooClose = existing.some(p => haversine(pos, { lat: p.lat, lng: p.lng }) < AUTO_RADIUS_M);
  if (tooClose) return false;
  let placeName = 'Visited spot';
  let category: string | undefined = 'Auto';
  if (resolver) {
    try {
      const r = await resolver(pos);
      if (!r) return false;
      placeName = r.placeName || placeName;
      category = r.category || category;
    } catch { /* fall through with default name */ }
  }
  lastAutoAt = now;
  await logVisitedPlace({
    uid, displayName,
    placeName,
    category,
    lat: pos.lat, lng: pos.lng
  });
  return true;
}

// ---------- Google Maps / Timeline import (Takeout) ----------
// Accepts every flavor of Google Takeout that contains place coordinates:
//   • Location History → Records.json  (raw lat/lng pings)
//   • Location History → Semantic Location History (placeVisit objects)
//   • Location History → Timeline.json (2024+, semanticSegments)
//   • Maps (your places) → Saved Places.json (GeoJSON FeatureCollection)
//   • Maps (your places) → Reviews.json     (GeoJSON FeatureCollection)
//   • Saved/*.csv                           (Google Maps saved-list exports
//     — Want to go, Favorites, Starred, etc. URLs contain @lat,lng)
// Deduplicates by rounding coords to ~110m grid.
export type TimelinePin = {
  lat: number;
  lng: number;
  placeName: string;
  visitedAt: number;
  category?: string;   // 'Timeline' | 'Saved' | 'Review' | 'Want to go' …
  rating?: number;     // 1-5 stars when imported from Reviews.json
  note?: string;       // review text / saved-place note
};

function pushUnique(out: TimelinePin[], seen: Set<string>, p: TimelinePin) {
  const key = p.lat.toFixed(3) + ',' + p.lng.toFixed(3) + '|' + (p.placeName || '');
  if (seen.has(key)) return;
  seen.add(key);
  out.push(p);
}

// Try to pull lat,lng out of a Google Maps URL. Handles:
//   .../@37.42,-122.08,15z/...
//   ?q=37.42,-122.08
//   /place/.../data=!3m1!4b1!4m...!3d37.42!4d-122.08
function coordsFromMapsUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null;
  let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]); const lng = Number(m[2]);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return { lat, lng };
}

// Parse a "geo:lat,lng" URI (Timeline.json semanticSegments format).
function coordsFromGeoUri(s: any): { lat: number; lng: number } | null {
  if (typeof s !== 'string' || !s.startsWith('geo:')) return null;
  const [lat, lng] = s.slice(4).split(',').map(Number);
  return isFinite(lat) && isFinite(lng) ? { lat, lng } : null;
}

// Naive CSV row splitter that handles quoted fields with commas inside.
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { q = false; }
      else cell += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c === '\r') { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function parseGoogleTimeline(text: string, fileName = ''): TimelinePin[] {
  const out: TimelinePin[] = [];
  const seen = new Set<string>();
  const lowerName = fileName.toLowerCase();

  // ----- CSV exports (Saved/*.csv) -----
  // Try CSV first if the file looks like one (filename .csv OR starts with a
  // recognizable header). Columns we care about: Title, Note, URL.
  if (lowerName.endsWith('.csv') || /^Title\s*,/i.test(text.slice(0, 50))) {
    const rows = csvRows(text);
    if (rows.length > 1) {
      const header = rows[0].map(h => h.trim().toLowerCase());
      const iTitle = header.indexOf('title');
      const iNote  = header.indexOf('note');
      const iUrl   = header.findIndex(h => h === 'url' || h === 'google maps url');
      const listName = fileName.replace(/\.csv$/i, '').replace(/^.*[\\/]/, '') || 'Saved';
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const url = iUrl >= 0 ? row[iUrl] : '';
        const co = coordsFromMapsUrl(url || '');
        if (!co) continue;
        pushUnique(out, seen, {
          lat: co.lat, lng: co.lng,
          placeName: (iTitle >= 0 ? row[iTitle] : '') || 'Saved place',
          visitedAt: Date.now(),
          category: listName,
          note: iNote >= 0 ? row[iNote] : undefined
        });
      }
      return out;
    }
  }

  let json: any;
  try { json = JSON.parse(text); } catch { return out; }

  // ----- GeoJSON FeatureCollection (Saved Places.json / Reviews.json) -----
  if (json?.type === 'FeatureCollection' && Array.isArray(json.features)) {
    const isReviews = /review/i.test(fileName);
    for (const f of json.features) {
      const g = f?.geometry;
      const coords = g?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const lng = Number(coords[0]); const lat = Number(coords[1]);
      if (!isFinite(lat) || !isFinite(lng)) continue;
      const props = f.properties || {};
      const loc = props.location || props.Location || {};
      const name = props.Title || loc.name || loc.Name || loc.address || loc.Address || props.name || 'Saved place';
      const rating = Number(props.five_star_rating_published || props.rating || 0) || undefined;
      const note = props.review_text_published || props.comment || props.Comment || props.note || props.Note || undefined;
      const dateStr = props.date || props.review_date || props.published || props.Updated || '';
      const ts = dateStr ? Date.parse(dateStr) : Date.now();
      pushUnique(out, seen, {
        lat, lng, placeName: String(name).slice(0, 140),
        visitedAt: isFinite(ts) ? ts : Date.now(),
        category: isReviews ? 'Review' : 'Saved',
        rating, note: note ? String(note).slice(0, 500) : undefined
      });
    }
    if (out.length) return out;
  }

  // ----- Records.json: { locations: [{ latitudeE7, longitudeE7, timestamp }] } -----
  if (Array.isArray(json?.locations)) {
    for (const r of json.locations) {
      if (typeof r.latitudeE7 !== 'number' || typeof r.longitudeE7 !== 'number') continue;
      const lat = r.latitudeE7 / 1e7;
      const lng = r.longitudeE7 / 1e7;
      const ts = r.timestamp ? Date.parse(r.timestamp) : (r.timestampMs ? Number(r.timestampMs) : Date.now());
      pushUnique(out, seen, { lat, lng, placeName: 'Timeline point', visitedAt: ts, category: 'Timeline' });
    }
    return out;
  }

  // ----- Semantic Location History: { timelineObjects: [{ placeVisit }] } -----
  if (Array.isArray(json?.timelineObjects)) {
    for (const o of json.timelineObjects) {
      const pv = o.placeVisit;
      if (!pv?.location) continue;
      const lat = pv.location.latitudeE7 / 1e7;
      const lng = pv.location.longitudeE7 / 1e7;
      const name = pv.location.name || pv.location.address || 'Visited place';
      const ts = pv.duration?.startTimestamp ? Date.parse(pv.duration.startTimestamp) : Date.now();
      pushUnique(out, seen, { lat, lng, placeName: name, visitedAt: ts, category: 'Timeline' });
    }
    return out;
  }

  // ----- New Timeline.json (2024+): { semanticSegments: [{ visit }] } -----
  if (Array.isArray(json?.semanticSegments)) {
    for (const s of json.semanticSegments) {
      const v = s.visit;
      const co = coordsFromGeoUri(v?.topCandidate?.placeLocation) || coordsFromGeoUri(v?.location);
      if (!co) continue;
      const name = v?.topCandidate?.semanticType || 'Visited place';
      const ts = s.startTime ? Date.parse(s.startTime) : Date.now();
      pushUnique(out, seen, { lat: co.lat, lng: co.lng, placeName: name, visitedAt: ts, category: 'Timeline' });
    }
    return out;
  }

  return out;
}

export async function importTimelinePins(
  uid: string, displayName: string, pins: TimelinePin[],
  onProgress?: (done: number, total: number) => void,
  opts?: { avatar?: any; promoteReviewsToPublic?: boolean; squadIds?: string[] }
) {
  const promote = opts?.promoteReviewsToPublic !== false; // default ON
  const avatar = opts?.avatar;
  const squadIds = opts?.squadIds || [];

  // 1) Promote reviewed/saved places to public pins so the rest of the
  //    Squad REN world sees them on the map. Only items with a rating or
  //    explicit Review/Saved category are promoted — we don't expose raw
  //    Timeline pings publicly because they're personal movement data.
  async function maybePromote(p: TimelinePin): Promise<string | null> {
    if (!promote) return null;
    const isPublicWorthy = p.category === 'Review' || p.category === 'Saved' || !!p.rating;
    if (!isPublicWorthy) return null;
    try {
      return await createPublicPin({
        uid, displayName, avatar,
        placeName: p.placeName,
        category: p.category || 'Saved',
        comment: p.note || '',
        rating: p.rating || 0,
        lat: p.lat, lng: p.lng,
        visibility: 'public',
        squadIds
      });
    } catch (e) {
      console.warn('[import] could not promote to public pin', e);
      return null;
    }
  }

  if (demo) {
    const list = dget<VisitedPlace[]>('places', []);
    for (const p of pins) {
      const publicPinId = (await maybePromote(p)) || undefined;
      list.push({
        uid, displayName,
        placeName: p.placeName, category: p.category || 'Timeline',
        lat: p.lat, lng: p.lng, visitedAt: p.visitedAt,
        ...(p.rating ? { rating: p.rating } : {}),
        ...(p.note ? { note: p.note } : {}),
        ...(publicPinId ? { publicPinId } : {})
      } as any);
    }
    dset('places', list.slice(0, 5000));
    onProgress?.(pins.length, pins.length);
    return pins.length;
  }
  // Firestore batched writes — 450 ops per batch to stay safely under 500.
  let written = 0;
  for (let i = 0; i < pins.length; i += 450) {
    const slice = pins.slice(i, i + 450);
    // Promote reviewed/saved pins in parallel — these are separate
    // addDoc()s, not part of the visitedPlaces batch.
    const promoIds = await Promise.all(slice.map(p => maybePromote(p)));
    const batch = writeBatch(db!);
    slice.forEach((p, idx) => {
      const ref = doc(collection(db!, 'visitedPlaces'));
      const ppid = promoIds[idx];
      batch.set(ref, {
        uid, displayName,
        placeName: p.placeName, category: p.category || 'Timeline',
        lat: p.lat, lng: p.lng,
        visitedAt: new Date(p.visitedAt),
        ...(p.rating ? { rating: p.rating } : {}),
        ...(p.note ? { note: p.note } : {}),
        ...(ppid ? { publicPinId: ppid } : {})
      });
    });
    await batch.commit();
    written += slice.length;
    onProgress?.(written, pins.length);
  }
  return written;
}
