// Lifetime user counter — increments once per unique uid the first time a
// user ever signs into Squad REN. Used to power the global "X squadders
// worldwide" marketing stat shown on the map. Also keeps a coarse country
// breakdown so we can show "Y countries reached" without paying for
// geocoding API calls.

import {
  doc, getDoc, setDoc, onSnapshot, increment, serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

export type LifetimeStats = {
  totalUsers: number;
  countries: Record<string, number>; // ISO-2 → count of joiners from that country
  updatedAt?: any;
};

const demo = !db;
const LKEY = 'squadren.lifetimeStats';
const LCOUNTED_KEY = 'squadren.lifetimeCounted'; // prevent double-count in demo

function dgetStats(): LifetimeStats {
  try {
    const raw = localStorage.getItem(LKEY);
    if (raw) return JSON.parse(raw) as LifetimeStats;
  } catch { /* ignore */ }
  // Seed demo number so the marketing pill isn't "1" out of the box.
  return { totalUsers: 1247, countries: { US: 612, GB: 89, CA: 71, JP: 54, BR: 48, DE: 41, AU: 35, NG: 27, IN: 92, MX: 38, FR: 33, ES: 21 } };
}
function dsetStats(s: LifetimeStats) { localStorage.setItem(LKEY, JSON.stringify(s)); }

// Record that this uid has signed in at least once. Safe to call on every
// app boot — internally checks a per-uid flag so the global counter is only
// incremented the FIRST time we see this user.
export async function recordSignIn(uid: string, opts: { lat?: number; lng?: number } = {}) {
  if (!uid) return;
  const country = (typeof opts.lat === 'number' && typeof opts.lng === 'number')
    ? countryFromLatLng(opts.lat, opts.lng)
    : null;

  if (demo) {
    const counted = JSON.parse(localStorage.getItem(LCOUNTED_KEY) || '{}') as Record<string, true>;
    if (counted[uid]) return;
    counted[uid] = true;
    localStorage.setItem(LCOUNTED_KEY, JSON.stringify(counted));
    const s = dgetStats();
    s.totalUsers += 1;
    if (country) s.countries[country] = (s.countries[country] || 0) + 1;
    dsetStats(s);
    return;
  }

  // Real Firestore path: mark a per-user flag doc so we never double count.
  const flagRef = doc(db!, 'lifetimeUserFlags', uid);
  try {
    const snap = await getDoc(flagRef);
    if (snap.exists()) return;
    await setDoc(flagRef, { uid, country: country || null, firstSeenAt: serverTimestamp() });
    // Bump the global counter document.
    const aggRef = doc(db!, 'meta', 'lifetimeStats');
    const inc: any = { totalUsers: increment(1), updatedAt: serverTimestamp() };
    if (country) inc[`countries.${country}`] = increment(1);
    await setDoc(aggRef, inc, { merge: true });
  } catch { /* offline / rules — silently ignore */ }
}

// Subscribe to the global stats doc. Returns an unsubscribe.
export function watchLifetimeStats(cb: (s: LifetimeStats) => void) {
  if (demo) {
    cb(dgetStats());
    // Re-emit periodically so a sign-in in another tab is reflected.
    const id = window.setInterval(() => cb(dgetStats()), 5000);
    return () => clearInterval(id);
  }
  const aggRef = doc(db!, 'meta', 'lifetimeStats');
  return onSnapshot(aggRef, snap => {
    const data = (snap.data() as LifetimeStats) || { totalUsers: 0, countries: {} };
    cb({ totalUsers: data.totalUsers || 0, countries: data.countries || {} });
  });
}

// ----------------------------------------------------------------------------
// Coarse lat/lng → ISO-2 country code. Uses rough bounding boxes for the most
// populous countries — accurate enough for an aggregate "countries reached"
// marketing stat without spending a geocoding quota. Falls back to null for
// regions we don't cover.
// ----------------------------------------------------------------------------
type Box = { code: string; n: number; s: number; w: number; e: number };
const BOXES: Box[] = [
  { code: 'US', n: 49, s: 24.5, w: -125, e: -66.9 },
  { code: 'CA', n: 70, s: 41.7, w: -141, e: -52 },
  { code: 'MX', n: 32.7, s: 14.5, w: -118, e: -86.7 },
  { code: 'BR', n: 5.3, s: -33.7, w: -74, e: -34.8 },
  { code: 'AR', n: -21.8, s: -55.1, w: -73.5, e: -53.6 },
  { code: 'CL', n: -17.5, s: -55.9, w: -75.6, e: -66.4 },
  { code: 'CO', n: 12.5, s: -4.2, w: -79, e: -66.9 },
  { code: 'PE', n: -0.04, s: -18.4, w: -81.4, e: -68.7 },
  { code: 'GB', n: 60.9, s: 49.9, w: -8.6, e: 1.8 },
  { code: 'IE', n: 55.4, s: 51.4, w: -10.5, e: -5.4 },
  { code: 'FR', n: 51.1, s: 41.3, w: -5.1, e: 9.6 },
  { code: 'ES', n: 43.8, s: 36, w: -9.3, e: 3.3 },
  { code: 'PT', n: 42.1, s: 36.9, w: -9.5, e: -6.2 },
  { code: 'DE', n: 55.1, s: 47.3, w: 5.9, e: 15 },
  { code: 'NL', n: 53.6, s: 50.8, w: 3.4, e: 7.2 },
  { code: 'BE', n: 51.5, s: 49.5, w: 2.5, e: 6.4 },
  { code: 'IT', n: 47.1, s: 35.5, w: 6.6, e: 18.5 },
  { code: 'CH', n: 47.8, s: 45.8, w: 5.9, e: 10.5 },
  { code: 'AT', n: 49, s: 46.4, w: 9.5, e: 17.2 },
  { code: 'PL', n: 54.8, s: 49, w: 14.1, e: 24.2 },
  { code: 'SE', n: 69.1, s: 55.3, w: 11.1, e: 24.2 },
  { code: 'NO', n: 71.2, s: 58, w: 4.6, e: 31.1 },
  { code: 'FI', n: 70.1, s: 59.8, w: 20.6, e: 31.6 },
  { code: 'DK', n: 57.8, s: 54.5, w: 8.1, e: 12.7 },
  { code: 'RU', n: 81.9, s: 41.2, w: 19.6, e: 180 },
  { code: 'UA', n: 52.4, s: 44.4, w: 22.1, e: 40.2 },
  { code: 'TR', n: 42.1, s: 35.8, w: 26, e: 44.8 },
  { code: 'GR', n: 41.7, s: 34.8, w: 19.6, e: 28.2 },
  { code: 'EG', n: 31.7, s: 22, w: 24.7, e: 36.9 },
  { code: 'ZA', n: -22.1, s: -34.8, w: 16.5, e: 32.9 },
  { code: 'NG', n: 13.9, s: 4.3, w: 2.7, e: 14.7 },
  { code: 'KE', n: 5, s: -4.7, w: 33.9, e: 41.9 },
  { code: 'MA', n: 35.9, s: 27.7, w: -13.2, e: -1 },
  { code: 'SA', n: 32.2, s: 16.4, w: 34.6, e: 55.7 },
  { code: 'AE', n: 26.1, s: 22.6, w: 51.6, e: 56.4 },
  { code: 'IL', n: 33.3, s: 29.5, w: 34.3, e: 35.9 },
  { code: 'IN', n: 35.5, s: 6.7, w: 68.1, e: 97.4 },
  { code: 'PK', n: 37.1, s: 23.7, w: 60.9, e: 77 },
  { code: 'BD', n: 26.6, s: 20.6, w: 88, e: 92.7 },
  { code: 'CN', n: 53.6, s: 18.2, w: 73.5, e: 134.8 },
  { code: 'JP', n: 45.5, s: 24.2, w: 122.9, e: 153.9 },
  { code: 'KR', n: 38.6, s: 33.1, w: 124.6, e: 130.9 },
  { code: 'TW', n: 25.3, s: 21.9, w: 119.5, e: 122 },
  { code: 'PH', n: 21.1, s: 4.6, w: 116.9, e: 126.6 },
  { code: 'VN', n: 23.4, s: 8.4, w: 102.1, e: 109.5 },
  { code: 'TH', n: 20.5, s: 5.6, w: 97.3, e: 105.6 },
  { code: 'ID', n: 6, s: -11, w: 95, e: 141 },
  { code: 'MY', n: 7.4, s: 0.8, w: 99.6, e: 119.3 },
  { code: 'SG', n: 1.5, s: 1.2, w: 103.6, e: 104.1 },
  { code: 'AU', n: -10.7, s: -43.6, w: 113.2, e: 153.6 },
  { code: 'NZ', n: -34.4, s: -47.3, w: 166.4, e: 178.6 }
];

export function countryFromLatLng(lat: number, lng: number): string | null {
  for (const b of BOXES) {
    if (lat <= b.n && lat >= b.s && lng >= b.w && lng <= b.e) return b.code;
  }
  return null;
}

export function countryCount(s: LifetimeStats): number {
  return Object.keys(s.countries || {}).length;
}
