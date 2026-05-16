// Daily path tracking. Independently of `trips`, every signed-in user can
// opt to log their day's GPS breadcrumbs so they (and optionally their squad
// or the public) can review where they've been over the past 7 days.
//
// Storage: one Firestore doc per (uid, calendar-day) under `userPaths`. The
// doc id is `${uid}_${YYYY-MM-DD}` so a day's history is a single append-only
// arrayUnion target — cheap writes, single subscription target per day.
//
// Visibility is stored on each day's doc so security rules and live watchers
// can filter without needing extra lookups. Retention is enforced lazily by
// each client at boot: anything older than 7 calendar days is deleted from
// their own collection. (Firestore TTL policies could replace this later.)

import {
  collection, doc, getDoc, getDocs, onSnapshot, query, where,
  serverTimestamp, setDoc, updateDoc, arrayUnion, deleteDoc, writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { haversine, type LatLng } from './geo';

export type PathVisibility = 'private' | 'squad' | 'public';
export type DailyPathPoint = { lat: number; lng: number; t: number };

export type DailyPath = {
  id: string;                  // `${uid}_${date}`
  uid: string;
  displayName?: string;
  date: string;                // YYYY-MM-DD (user-local calendar day)
  points: DailyPathPoint[];
  visibility: PathVisibility;
  squadIds?: string[];         // snapshot at last write — gates squad-only views
  updatedAt?: any;
};

// Number of trailing days each user keeps in their own history.
export const DAILY_PATH_RETAIN_DAYS = 7;

// Throttle for appending breadcrumbs. Mirrors trips.ts so the two systems
// share the same sampling density when both are recording at once.
export const DAILY_PATH_MIN_M = 25;
export const DAILY_PATH_MIN_MS = 10_000;

const demo = !db;

function dkey(k: string) { return `squadren.${k}`; }
function dget<T>(k: string, fb: T): T {
  const v = localStorage.getItem(dkey(k));
  return v ? JSON.parse(v) as T : fb;
}
function dset<T>(k: string, v: T) { localStorage.setItem(dkey(k), JSON.stringify(v)); }

// User-local calendar day in YYYY-MM-DD. We intentionally use *local* time so
// "today" matches what the user sees on their device clock.
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Iterate the last `n` calendar days, newest first.
export function recentDateKeys(n: number = DAILY_PATH_RETAIN_DAYS): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(todayKey(d));
  }
  return out;
}

// Read the saved visibility preference (per-user, default 'private'). Used
// when creating a new day's doc so the user's earlier choice is sticky.
export function getDefaultVisibility(uid: string): PathVisibility {
  const v = localStorage.getItem(`squadren.dailyPathVis.${uid}`);
  return (v === 'squad' || v === 'public' || v === 'private') ? v : 'private';
}
export function setDefaultVisibility(uid: string, v: PathVisibility) {
  localStorage.setItem(`squadren.dailyPathVis.${uid}`, v);
}

// Local "recording enabled" toggle. Off by default so we don't quietly track
// users who never opted in. The check-in flow flips this on the first time.
export function getRecordingEnabled(uid: string): boolean {
  return localStorage.getItem(`squadren.dailyPathRec.${uid}`) === 'true';
}
export function setRecordingEnabled(uid: string, on: boolean) {
  localStorage.setItem(`squadren.dailyPathRec.${uid}`, String(on));
}

// ---------- Writes ----------

// Append one breadcrumb to today's path doc. Caller is responsible for the
// throttle (`shouldAppendDailyPath`). Creates the doc on first call.
export async function appendDailyPathPoint(
  uid: string,
  displayName: string,
  pt: DailyPathPoint,
  opts: { visibility?: PathVisibility; squadIds?: string[] } = {}
): Promise<void> {
  const date = todayKey(new Date(pt.t));
  const id = `${uid}_${date}`;
  const visibility = opts.visibility || getDefaultVisibility(uid);
  const squadIds = opts.squadIds || [];

  if (demo) {
    const all = dget<Record<string, DailyPath>>('dailyPaths', {});
    const cur = all[id] || {
      id, uid, displayName, date, points: [], visibility, squadIds
    } as DailyPath;
    cur.points = [...(cur.points || []), pt].slice(-2000);
    cur.visibility = visibility;
    cur.squadIds = squadIds;
    cur.displayName = displayName;
    cur.updatedAt = Date.now();
    all[id] = cur;
    dset('dailyPaths', all);
    return;
  }

  const ref = doc(db!, 'userPaths', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid, displayName, date, visibility, squadIds,
      points: [pt],
      updatedAt: serverTimestamp()
    });
    return;
  }
  // Existing doc — append + refresh visibility/squad snapshot so toggles
  // applied to "today" take effect for live viewers immediately.
  await updateDoc(ref, {
    points: arrayUnion(pt),
    visibility,
    squadIds,
    displayName,
    updatedAt: serverTimestamp()
  });
}

// Throttle helper. Returns true if the new point is far/old enough from the
// last appended point that we should write it.
export function shouldAppendDailyPath(
  last: { lat: number; lng: number; t: number } | null,
  next: { lat: number; lng: number; t: number }
): boolean {
  if (!last) return true;
  if ((next.t - last.t) >= DAILY_PATH_MIN_MS) return true;
  if (haversine(last, next) >= DAILY_PATH_MIN_M) return true;
  return false;
}

// Change a single day's visibility (e.g., user retroactively shares yesterday).
export async function setDayVisibility(
  uid: string,
  date: string,
  visibility: PathVisibility,
  squadIds: string[] = []
): Promise<void> {
  const id = `${uid}_${date}`;
  if (demo) {
    const all = dget<Record<string, DailyPath>>('dailyPaths', {});
    if (all[id]) {
      all[id].visibility = visibility;
      all[id].squadIds = squadIds;
      all[id].updatedAt = Date.now();
      dset('dailyPaths', all);
    }
    return;
  }
  const ref = doc(db!, 'userPaths', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { visibility, squadIds, updatedAt: serverTimestamp() });
}

// Bulk update: apply the chosen visibility to every retained day at once.
export async function setAllRecentVisibility(
  uid: string,
  visibility: PathVisibility,
  squadIds: string[] = [],
  days: number = DAILY_PATH_RETAIN_DAYS
): Promise<void> {
  setDefaultVisibility(uid, visibility);
  const keys = recentDateKeys(days);
  if (demo) {
    const all = dget<Record<string, DailyPath>>('dailyPaths', {});
    for (const date of keys) {
      const id = `${uid}_${date}`;
      if (all[id]) {
        all[id].visibility = visibility;
        all[id].squadIds = squadIds;
        all[id].updatedAt = Date.now();
      }
    }
    dset('dailyPaths', all);
    return;
  }
  const batch = writeBatch(db!);
  let writes = 0;
  for (const date of keys) {
    const ref = doc(db!, 'userPaths', `${uid}_${date}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    batch.update(ref, { visibility, squadIds, updatedAt: serverTimestamp() });
    writes++;
  }
  if (writes > 0) await batch.commit();
}

// Delete one day from the user's history (used by both the manual "forget"
// button and the lazy retention sweep).
export async function deleteDay(uid: string, date: string): Promise<void> {
  const id = `${uid}_${date}`;
  if (demo) {
    const all = dget<Record<string, DailyPath>>('dailyPaths', {});
    delete all[id];
    dset('dailyPaths', all);
    return;
  }
  await deleteDoc(doc(db!, 'userPaths', id));
}

// Lazy retention: at boot, delete this user's path docs older than the
// retention window. Cheap because the doc ids encode the date, so we don't
// need to read them first.
export async function sweepOldPaths(uid: string, days: number = DAILY_PATH_RETAIN_DAYS): Promise<void> {
  const keep = new Set(recentDateKeys(days));
  if (demo) {
    const all = dget<Record<string, DailyPath>>('dailyPaths', {});
    let changed = false;
    for (const id of Object.keys(all)) {
      if (all[id].uid !== uid) continue;
      if (!keep.has(all[id].date)) { delete all[id]; changed = true; }
    }
    if (changed) dset('dailyPaths', all);
    return;
  }
  // Pull only this user's docs, then drop the ones outside the window.
  const q = query(collection(db!, 'userPaths'), where('uid', '==', uid));
  const snap = await getDocs(q);
  const batch = writeBatch(db!);
  let writes = 0;
  snap.forEach(d => {
    const data = d.data() as DailyPath;
    if (!keep.has(data.date)) { batch.delete(d.ref); writes++; }
  });
  if (writes > 0) await batch.commit();
}

// ---------- Reads ----------

// Stream the current user's own last-N-days paths (newest day first).
export function watchMyRecentPaths(
  uid: string,
  cb: (paths: DailyPath[]) => void,
  days: number = DAILY_PATH_RETAIN_DAYS
): () => void {
  const keep = new Set(recentDateKeys(days));
  if (demo) {
    const tick = () => {
      const all = dget<Record<string, DailyPath>>('dailyPaths', {});
      const out = Object.values(all).filter(p => p.uid === uid && keep.has(p.date));
      out.sort((a, b) => (a.date < b.date ? 1 : -1));
      cb(out);
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }
  const q = query(collection(db!, 'userPaths'), where('uid', '==', uid));
  return onSnapshot(q, snap => {
    const out: DailyPath[] = [];
    snap.forEach(d => {
      const data = d.data() as DailyPath;
      if (keep.has(data.date)) out.push({ ...data, id: d.id });
    });
    out.sort((a, b) => (a.date < b.date ? 1 : -1));
    cb(out);
  });
}

// Stream paths *visible to the current viewer* — public ones worldwide plus
// squad-only paths whose author shares at least one squad with us. Used by
// the map to draw squadmate / public trails.
export function watchVisiblePaths(
  cb: (paths: DailyPath[]) => void,
  opts: { viewerUid: string; viewerSquadIds: string[]; days?: number }
): () => void {
  const { viewerUid, viewerSquadIds, days = DAILY_PATH_RETAIN_DAYS } = opts;
  const keep = new Set(recentDateKeys(days));
  const allow = (p: DailyPath) => {
    if (p.uid === viewerUid) return false;            // own paths come from watchMyRecentPaths
    if (!keep.has(p.date)) return false;
    if (p.visibility === 'public') return true;
    if (p.visibility === 'squad') {
      return (p.squadIds || []).some(s => viewerSquadIds.includes(s));
    }
    return false;
  };

  if (demo) {
    const tick = () => {
      const all = dget<Record<string, DailyPath>>('dailyPaths', {});
      cb(Object.values(all).filter(allow));
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }

  // Two parallel queries (public + squad), merged client-side. We can't do a
  // single `in` query because 'squad' results also need array-contains-any
  // on squadIds.
  let pub: DailyPath[] = []; let sq: DailyPath[] = [];
  const emit = () => {
    const seen = new Set<string>();
    const merged: DailyPath[] = [];
    for (const p of [...pub, ...sq]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      if (allow(p)) merged.push(p);
    }
    cb(merged);
  };
  const qPub = query(collection(db!, 'userPaths'), where('visibility', '==', 'public'));
  const u1 = onSnapshot(qPub, snap => {
    pub = snap.docs.map(d => ({ ...(d.data() as any), id: d.id })) as DailyPath[];
    emit();
  });
  let u2 = () => {};
  if (viewerSquadIds.length > 0) {
    const qSq = query(
      collection(db!, 'userPaths'),
      where('visibility', '==', 'squad'),
      where('squadIds', 'array-contains-any', viewerSquadIds.slice(0, 30))
    );
    u2 = onSnapshot(qSq, snap => {
      sq = snap.docs.map(d => ({ ...(d.data() as any), id: d.id })) as DailyPath[];
      emit();
    });
  }
  return () => { u1(); u2(); };
}

// ---------- Helpers ----------

// Total kilometers walked/driven along a day's path.
export function pathDistanceKm(points: DailyPathPoint[] | undefined): number {
  if (!points || points.length < 2) return 0;
  let m = 0;
  for (let i = 1; i < points.length; i++) m += haversine(points[i - 1], points[i]);
  return m / 1000;
}

// Human-friendly label for a date key relative to today.
export function labelForDate(date: string): string {
  const today = todayKey();
  if (date === today) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (date === todayKey(y)) return 'Yesterday';
  // Otherwise "Mon, Jul 1"
  const [yr, mo, da] = date.split('-').map(Number);
  const d = new Date(yr, (mo || 1) - 1, da || 1);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// Deterministic color per uid+date so each polyline stays visually stable.
export function pathColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 70%, 45%)`;
}
