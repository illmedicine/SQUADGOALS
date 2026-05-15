// Member Population Pulse — every signed-in user heartbeats once a minute to
// the `activeUsers` collection. The map shows the live count (anyone whose
// heartbeat lands inside an ACTIVE_WINDOW_MS window) plus an opt-in roster
// of recent users so squads can scan for potential rivals / recruits.

import {
  doc, setDoc, onSnapshot, collection, query, where, serverTimestamp, limit
} from 'firebase/firestore';
import { db } from './firebase';

export type ActiveUser = {
  uid: string;
  displayName: string;
  // Optional coarse location — only present when the user has location sharing
  // turned on. The pulse counter works the same either way; this just feeds
  // the "scan the globe" discovery roster.
  lat?: number;
  lng?: number;
  squadCount?: number;
  // ms epoch mirror so clients can filter without resolving serverTimestamp.
  lastSeenMs: number;
  lastSeen?: any;
};

// A user is considered "currently online" if their heartbeat is younger than
// this. 2 minutes covers a 60s heartbeat + network jitter.
export const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

const demo = !db;

function dget<T>(k: string, fb: T): T {
  const v = localStorage.getItem('squadren.' + k);
  return v ? JSON.parse(v) as T : fb;
}
function dset<T>(k: string, v: T) { localStorage.setItem('squadren.' + k, JSON.stringify(v)); }

// Demo-only: seed a synthetic worldwide population so the counter is never
// boring in dev. Real users from `activeUsers` are merged on top.
function syntheticPulse(): ActiveUser[] {
  const cities = [
    { name: 'NYC',     lat: 40.71, lng: -74.01 },
    { name: 'LDN',     lat: 51.51, lng: -0.13 },
    { name: 'TKY',     lat: 35.68, lng: 139.69 },
    { name: 'SYD',     lat: -33.87, lng: 151.21 },
    { name: 'SFO',     lat: 37.77, lng: -122.42 },
    { name: 'SAO',     lat: -23.55, lng: -46.63 },
    { name: 'BER',     lat: 52.52, lng: 13.40 },
    { name: 'LAG',     lat: 6.52,  lng: 3.38 },
    { name: 'BOM',     lat: 19.07, lng: 72.87 },
    { name: 'MEX',     lat: 19.43, lng: -99.13 }
  ];
  const now = Date.now();
  const out: ActiveUser[] = [];
  for (const c of cities) {
    const n = 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      out.push({
        uid: `demo-${c.name}-${i}`,
        displayName: `${c.name} Squadder ${i + 1}`,
        lat: c.lat + (Math.random() - 0.5) * 1.5,
        lng: c.lng + (Math.random() - 0.5) * 1.5,
        lastSeenMs: now - Math.floor(Math.random() * 90_000)
      });
    }
  }
  return out;
}

// Start the heartbeat for a signed-in user. Returns an unsubscribe that stops
// the interval and writes a final "going offline" marker.
export function startHeartbeat(p: {
  uid: string;
  displayName: string;
  lat?: number; lng?: number;
  squadCount?: number;
}, intervalMs = 60_000): () => void {
  let cancelled = false;
  const tick = async () => {
    if (cancelled) return;
    const now = Date.now();
    const data: ActiveUser & Record<string, any> = {
      uid: p.uid,
      displayName: p.displayName,
      lastSeenMs: now,
      ...(p.squadCount !== undefined ? { squadCount: p.squadCount } : {}),
      ...(typeof p.lat === 'number' ? { lat: p.lat } : {}),
      ...(typeof p.lng === 'number' ? { lng: p.lng } : {})
    };
    if (demo) {
      const list = dget<ActiveUser[]>('activeUsers', []);
      const idx = list.findIndex(u => u.uid === p.uid);
      if (idx >= 0) list[idx] = data; else list.push(data);
      dset('activeUsers', list);
      return;
    }
    try {
      await setDoc(doc(db!, 'activeUsers', p.uid),
        { ...data, lastSeen: serverTimestamp() },
        { merge: true });
    } catch { /* offline / rules — ignore so app keeps running */ }
  };
  // Fire once immediately, then on the interval.
  tick();
  const id = window.setInterval(tick, intervalMs);
  return () => {
    cancelled = true;
    clearInterval(id);
  };
}

// Watch every currently-active user across the platform. Filters client-side
// to the ACTIVE_WINDOW so stale heartbeats fade out within ~2 minutes even if
// the writer never marked themselves offline.
export function watchActiveUsers(cb: (users: ActiveUser[]) => void) {
  if (demo) {
    const seeded = syntheticPulse();
    const tick = () => {
      const now = Date.now();
      const list = dget<ActiveUser[]>('activeUsers', []);
      const merged = [...list, ...seeded].filter(u => now - u.lastSeenMs <= ACTIVE_WINDOW_MS);
      // Dedupe by uid (real entries win over synthetic of same uid).
      const seen = new Set<string>();
      const out: ActiveUser[] = [];
      for (const u of merged) {
        if (seen.has(u.uid)) continue;
        seen.add(u.uid); out.push(u);
      }
      cb(out);
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }
  const cutoff = Date.now() - ACTIVE_WINDOW_MS;
  // Query only fresh docs — keeps reads bounded as the user base grows.
  const q = query(
    collection(db!, 'activeUsers'),
    where('lastSeenMs', '>=', cutoff),
    limit(1000)
  );
  return onSnapshot(q, snap => {
    const now = Date.now();
    cb(snap.docs
      .map(d => d.data() as ActiveUser)
      .filter(u => now - u.lastSeenMs <= ACTIVE_WINDOW_MS));
  });
}
