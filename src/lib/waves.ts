// Waves — quick "👋 say hi" gesture between live users on the map.
// This is Squad REN's bump-style social primitive: tap any public pin → wave.
// The recipient sees a toast next time they have the app open, and any wave
// you receive surfaces in your own toast stack. Optional 1-line note can be
// attached so a wave can double as a low-friction intro.

import {
  doc, setDoc, addDoc, collection, onSnapshot, query, where, orderBy, limit,
  serverTimestamp, deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';

export type Wave = {
  id: string;
  fromUid: string;
  fromName: string;
  fromAvatar?: any;
  toUid: string;
  note?: string;
  // Optional reciprocal "wave back" marker — set on the original wave when
  // the recipient waves back, so both sides see a connected state.
  wavedBack?: boolean;
  at: number;
};

const demo = !db;

function dget<T>(k: string, fb: T): T {
  const v = localStorage.getItem('squadren.' + k);
  return v ? JSON.parse(v) as T : fb;
}
function dset<T>(k: string, v: T) { localStorage.setItem('squadren.' + k, JSON.stringify(v)); }

// Per-user cooldown so a single user can't wave-spam another. 60s feels like
// a healthy social pace without making it feel laggy.
const COOLDOWN_MS = 60_000;

export async function sendWave(p: {
  fromUid: string;
  fromName: string;
  fromAvatar?: any;
  toUid: string;
  note?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (p.fromUid === p.toUid) return { ok: false, reason: 'cant-wave-self' };
  const cdKey = `wave.cd.${p.fromUid}.${p.toUid}`;
  const lastAt = Number(localStorage.getItem(cdKey) || 0);
  if (Date.now() - lastAt < COOLDOWN_MS) {
    return { ok: false, reason: 'cooldown' };
  }
  localStorage.setItem(cdKey, String(Date.now()));

  const wave: Omit<Wave, 'id'> = {
    fromUid: p.fromUid,
    fromName: p.fromName,
    ...(p.fromAvatar ? { fromAvatar: p.fromAvatar } : {}),
    toUid: p.toUid,
    ...(p.note ? { note: p.note.slice(0, 140) } : {}),
    at: Date.now()
  };

  if (demo) {
    // Demo mode: write into the recipient's localStorage inbox so opening a
    // second browser/profile demonstrates the round-trip.
    const inbox = dget<Wave[]>(`waves.inbox.${p.toUid}`, []);
    inbox.unshift({ ...wave, id: `demo-${Date.now()}` });
    dset(`waves.inbox.${p.toUid}`, inbox.slice(0, 50));
    return { ok: true };
  }

  try {
    await addDoc(collection(db!, 'waves'),
      { ...wave, at: serverTimestamp(), atMs: wave.at });
    return { ok: true };
  } catch (e) {
    console.warn('[waves] sendWave failed:', e);
    return { ok: false, reason: 'firestore' };
  }
}

// Subscribe to incoming waves for a user. The callback fires for every new
// wave (sorted newest-first, capped at 50). Read state is tracked client-side
// via localStorage so it's per-device.
export function watchInbox(uid: string, cb: (waves: Wave[]) => void): () => void {
  if (demo) {
    const tick = () => cb(dget<Wave[]>(`waves.inbox.${uid}`, []));
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }
  const q = query(
    collection(db!, 'waves'),
    where('toUid', '==', uid),
    orderBy('atMs', 'desc'),
    limit(50)
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  }, e => {
    console.warn('[waves] watchInbox failed:', e);
  });
}

// Mark a wave as read locally — recorded in this device's localStorage so
// the toast doesn't keep re-appearing every cold start.
const READ_KEY = (uid: string) => `squadren.waves.read.${uid}`;
export function readWaveIds(uid: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY(uid)) || '[]')); }
  catch { return new Set(); }
}
export function markWaveRead(uid: string, waveId: string) {
  const s = readWaveIds(uid);
  s.add(waveId);
  localStorage.setItem(READ_KEY(uid), JSON.stringify([...s].slice(-200)));
}

// Dismiss / delete a wave from the inbox (recipient-only).
export async function dismissWave(uid: string, waveId: string): Promise<void> {
  if (demo) {
    const inbox = dget<Wave[]>(`waves.inbox.${uid}`, []);
    dset(`waves.inbox.${uid}`, inbox.filter(w => w.id !== waveId));
    return;
  }
  try {
    await deleteDoc(doc(db!, 'waves', waveId));
  } catch (e) {
    console.warn('[waves] dismissWave failed:', e);
  }
}

// Mark the wave as wavedBack on the server so the original sender sees a
// reciprocated state. Then sends a fresh wave back to the original sender
// so they get their own inbox entry too.
export async function waveBack(p: {
  fromUid: string;
  fromName: string;
  fromAvatar?: any;
  originalWave: Wave;
}): Promise<{ ok: boolean }> {
  if (!demo) {
    try {
      await setDoc(doc(db!, 'waves', p.originalWave.id),
        { wavedBack: true }, { merge: true });
    } catch (e) {
      console.warn('[waves] waveBack mark failed:', e);
    }
  }
  return sendWave({
    fromUid: p.fromUid,
    fromName: p.fromName,
    fromAvatar: p.fromAvatar,
    toUid: p.originalWave.fromUid,
    note: '👋 back at you!'
  });
}
