// Public pins + comments + reviews. Anyone with the app sees these on the
// map. Pins live in `publicPins` collection; comments live in a subcollection
// `publicPins/{id}/comments`. Demo mode keeps them in localStorage so the
// system works without Firebase.

import {
  addDoc, collection, doc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, where, limit
} from 'firebase/firestore';
import { db } from './firebase';

export type PinVisibility = 'public' | 'squad';

export type PublicPin = {
  id: string;
  uid: string;
  displayName: string;
  avatar?: any;
  placeName: string;
  category: string;
  comment: string;
  rating: number;          // 0..5 (0 = no rating, just a pin)
  lat: number;
  lng: number;
  createdAt: any;
  // 'public' = visible worldwide; 'squad' = visible only to fellow squad members.
  visibility: PinVisibility;
  // Snapshot of the author's squads at post time — used to gate squad-only pins.
  squadIds?: string[];
  // Aggregates updated client-side after each new comment/review.
  commentCount?: number;
  avgRating?: number;
  reviewCount?: number;
};

export type PinComment = {
  id: string;
  uid: string;
  displayName: string;
  avatar?: any;
  text: string;
  rating: number;          // 0..5; 0 means it's a plain comment, not a review
  createdAt: any;
};

const demo = !db;

function dget<T>(k: string, fb: T): T {
  const v = localStorage.getItem('squadren.' + k);
  return v ? JSON.parse(v) as T : fb;
}
function dset<T>(k: string, v: T) { localStorage.setItem('squadren.' + k, JSON.stringify(v)); }

export async function createPublicPin(p: Omit<PublicPin, 'id' | 'createdAt' | 'commentCount' | 'avgRating' | 'reviewCount'>) {
  // Default to public so legacy callers continue to behave the same way.
  const visibility: PinVisibility = p.visibility || 'public';
  const squadIds = p.squadIds || [];
  if (demo) {
    const list = dget<PublicPin[]>('publicPins', []);
    const next: PublicPin = {
      ...p, visibility, squadIds,
      id: 'pp-' + Date.now(),
      createdAt: Date.now(),
      commentCount: 0, avgRating: p.rating || 0, reviewCount: p.rating ? 1 : 0
    };
    list.unshift(next);
    dset('publicPins', list.slice(0, 5000));
    return next.id;
  }
  const ref = await addDoc(collection(db!, 'publicPins'), {
    ...p,
    visibility,
    squadIds,
    createdAt: serverTimestamp(),
    commentCount: 0,
    avgRating: p.rating || 0,
    reviewCount: p.rating ? 1 : 0
  });
  return ref.id;
}

// Returns pins the current viewer is allowed to see: all public pins +
// squad-only pins whose author shares at least one squad with the viewer
// (or that the viewer themselves authored). Pass viewerUid='' to see only
// world-public pins.
export function watchPublicPins(
  cb: (pins: PublicPin[]) => void,
  opts: { viewerUid?: string; viewerSquadIds?: string[]; max?: number } = {}
) {
  const { viewerUid = '', viewerSquadIds = [], max = 500 } = opts;
  const filter = (pins: PublicPin[]) => pins.filter(p => {
    const vis = p.visibility || 'public';
    if (vis === 'public') return true;
    if (p.uid === viewerUid) return true;
    const ids = p.squadIds || [];
    return ids.some(s => viewerSquadIds.includes(s));
  });
  if (demo) {
    const tick = () => cb(filter(dget<PublicPin[]>('publicPins', [])));
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }
  const q = query(collection(db!, 'publicPins'), orderBy('createdAt', 'desc'), limit(max));
  return onSnapshot(q, snap => {
    cb(filter(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
  });
}

export async function addComment(pinId: string, c: Omit<PinComment, 'id' | 'createdAt'>) {
  if (demo) {
    const all = dget<Record<string, PinComment[]>>('pinComments', {});
    const list = all[pinId] || [];
    list.push({ ...c, id: 'c-' + Date.now(), createdAt: Date.now() });
    all[pinId] = list;
    dset('pinComments', all);
    // Update aggregate counters on the pin.
    const pins = dget<PublicPin[]>('publicPins', []);
    const idx = pins.findIndex(p => p.id === pinId);
    if (idx >= 0) {
      const reviews = list.filter(x => x.rating > 0);
      pins[idx].commentCount = list.length;
      pins[idx].reviewCount = reviews.length;
      pins[idx].avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
      dset('publicPins', pins);
    }
    return;
  }
  const ref = collection(db!, 'publicPins', pinId, 'comments');
  await addDoc(ref, { ...c, createdAt: serverTimestamp() });
}

export function watchComments(pinId: string, cb: (c: PinComment[]) => void) {
  if (demo) {
    const tick = () => {
      const all = dget<Record<string, PinComment[]>>('pinComments', {});
      cb(all[pinId] || []);
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }
  const q = query(collection(db!, 'publicPins', pinId, 'comments'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  });
}

export async function fetchPinAggregates(pinId: string) {
  if (demo) {
    const all = dget<Record<string, PinComment[]>>('pinComments', {});
    return all[pinId] || [];
  }
  const snap = await getDocs(query(collection(db!, 'publicPins', pinId, 'comments')));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as PinComment[];
}
