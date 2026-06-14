// Ticketmaster Discovery API v2
// Free tier: 5,000 calls/day  |  Key: developer.ticketmaster.com
// All calls made client-side — TM explicitly supports this usage.

export type VenueEvent = {
  id: string;
  name: string;
  url: string;
  imageUrl: string | null;
  date: string;         // YYYY-MM-DD
  time: string | null;  // HH:MM:SS local
  venueName: string;
  venueAddress: string;
  city: 'buffalo' | 'toronto';
  category: string;     // Music | Sports | Arts & Theatre | Film | Miscellaneous
  genre: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  currency: string;
  status: string;       // onsale | offsale | cancelled | postponed | rescheduled
};

const TM_BASE = 'https://app.ticketmaster.com/discovery/v2/events.json';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // refresh every 6 hours

export const TM_KEY: string = (import.meta.env.VITE_TICKETMASTER_API_KEY as string) || '';
export const TM_CONFIGURED = Boolean(TM_KEY);

// ─── Cache ────────────────────────────────────────────────────────────────────

type CacheEntry = { events: VenueEvent[]; fetchedAt: number };

function ck(city: string) { return `squadren.venues.${city}`; }

function readCache(city: string): VenueEvent[] | null {
  try {
    const raw = localStorage.getItem(ck(city));
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry.events;
  } catch { return null; }
}

function writeCache(city: string, events: VenueEvent[]) {
  try {
    localStorage.setItem(ck(city), JSON.stringify({ events, fetchedAt: Date.now() }));
  } catch {}
}

export function clearCache(city?: string) {
  if (city) localStorage.removeItem(ck(city));
  else ['buffalo', 'toronto'].forEach(c => localStorage.removeItem(ck(c)));
}

export function cacheAge(city: string): number | null {
  try {
    const raw = localStorage.getItem(ck(city));
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    return Date.now() - entry.fetchedAt;
  } catch { return null; }
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchCity(city: 'buffalo' | 'toronto'): Promise<VenueEvent[]> {
  const params = new URLSearchParams({
    apikey: TM_KEY,
    size: '50',
    sort: 'date,asc',
    ...(city === 'buffalo'
      ? { city: 'Buffalo', stateCode: 'NY', countryCode: 'US' }
      : { city: 'Toronto', countryCode: 'CA' }),
  });

  const res = await fetch(`${TM_BASE}?${params}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ticketmaster ${res.status}: ${body.slice(0, 120)}`);
  }
  const data = await res.json();
  const raw: any[] = data?._embedded?.events || [];

  return raw.map((e): VenueEvent => {
    const venue = e._embedded?.venues?.[0] || {};
    const cls = e.classifications?.[0] || {};
    const pr = e.priceRanges?.[0] || null;
    const img =
      (e.images || [])
        .filter((i: any) => i.ratio === '16_9' && i.width >= 640)
        .sort((a: any, b: any) => b.width - a.width)[0] ||
      e.images?.[0] ||
      null;

    return {
      id: e.id,
      name: e.name,
      url: e.url || '',
      imageUrl: img?.url || null,
      date: e.dates?.start?.localDate || '',
      time: e.dates?.start?.localTime || null,
      venueName: venue.name || 'Venue TBD',
      venueAddress: [venue.address?.line1, venue.city?.name, venue.state?.stateCode || venue.country?.countryCode]
        .filter(Boolean).join(', '),
      city,
      category: cls?.segment?.name || 'Event',
      genre: cls?.genre?.name && cls.genre.name !== 'Undefined' ? cls.genre.name : null,
      minPrice: pr?.min ?? null,
      maxPrice: pr?.max ?? null,
      currency: pr?.currency || (city === 'toronto' ? 'CAD' : 'USD'),
      status: e.dates?.status?.code || 'onsale',
    };
  });
}

export async function fetchEvents(
  city: 'buffalo' | 'toronto',
  { forceRefresh = false } = {}
): Promise<VenueEvent[]> {
  if (!forceRefresh) {
    const cached = readCache(city);
    if (cached) return cached;
  }
  const events = await fetchCity(city);
  writeCache(city, events);
  return events;
}

// ─── Rallies (Firestore / demo) ───────────────────────────────────────────────
// A rally links a squad to an event so members know to RSVP and book rides.

import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type Rally = {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  venueName: string;
  venueCity: 'buffalo' | 'toronto';
  squadId: string;
  squadName: string;
  createdBy: string;
  createdByName: string;
  createdAt: number;
};

const demoMode = !db;
function dk(k: string) { return `squadren.rallies.${k}`; }
function dget<T>(k: string, fb: T): T {
  try { const v = localStorage.getItem(dk(k)); return v ? JSON.parse(v) : fb; } catch { return fb; }
}
function dset<T>(k: string, v: T) { try { localStorage.setItem(dk(k), JSON.stringify(v)); } catch {} }

export async function createRally(r: Omit<Rally, 'id' | 'createdAt'>): Promise<string> {
  const payload = { ...r, createdAt: Date.now() };
  if (demoMode) {
    const id = 'ral-' + Date.now();
    const list = dget<Rally[]>('all', []);
    list.unshift({ ...payload, id });
    dset('all', list);
    return id;
  }
  const ref = await addDoc(collection(db!, 'squadRallies'), {
    ...payload,
    createdAtTs: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteRally(id: string) {
  if (demoMode) {
    dset('all', dget<Rally[]>('all', []).filter(r => r.id !== id));
    return;
  }
  await deleteDoc(doc(db!, 'squadRallies', id));
}

export function watchRalliesForEvent(eventId: string, cb: (r: Rally[]) => void) {
  if (demoMode) {
    const tick = () => cb(dget<Rally[]>('all', []).filter(r => r.eventId === eventId));
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }
  const q = query(collection(db!, 'squadRallies'), where('eventId', '==', eventId));
  return onSnapshot(q, snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Rally)))
  );
}

export function watchMySquadRallies(squadIds: string[], cb: (r: Rally[]) => void) {
  if (demoMode) {
    const tick = () =>
      cb(dget<Rally[]>('all', []).filter(r => squadIds.includes(r.squadId)));
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }
  if (!squadIds.length) { cb([]); return () => {}; }
  const q = query(collection(db!, 'squadRallies'), where('squadId', 'in', squadIds.slice(0, 10)));
  return onSnapshot(q, snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Rally)))
  );
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function fmtEventDate(date: string, time: string | null): string {
  if (!date) return '';
  const d = new Date(date + 'T' + (time || '00:00:00'));
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (!time) return dateStr;
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} · ${timeStr}`;
}

export function fmtPrice(min: number | null, max: number | null, currency: string): string {
  if (min === null) return 'Check prices';
  const sym = currency === 'CAD' ? 'CA$' : '$';
  if (max === null || max === min) return `${sym}${min.toFixed(0)}`;
  return `${sym}${min.toFixed(0)} – ${sym}${max.toFixed(0)}`;
}

export const CATEGORY_ICONS: Record<string, string> = {
  'Music': '🎵',
  'Sports': '🏟️',
  'Arts & Theatre': '🎭',
  'Film': '🎬',
  'Miscellaneous': '🎪',
  'Event': '📅',
};
