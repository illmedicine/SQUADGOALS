import {
  collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
  addDoc, getDocs, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { db } from './firebase';
import type { LatLng } from './geo';

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
