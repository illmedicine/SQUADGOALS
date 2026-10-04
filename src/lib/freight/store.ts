// Persistence for driver profiles and bookings.
//
// Uses Firestore (`drivers/{uid}`, `bookings/{id}`) when Firebase is configured
// and reachable; otherwise — or if Firestore rejects the request — falls back to
// localStorage so the whole product still works as a single-browser demo.
import { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, onSnapshot, setDoc, updateDoc, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Booking, BookingStatus, Driver } from './types';
import { SEED_DRIVERS } from './seed';

const LS_DRIVERS = 'squadren.freight.drivers';
const LS_BOOKINGS = 'squadren.freight.bookings';

// ── local fallback ───────────────────────────────────────────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach(l => l());
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => { if (e.key === LS_DRIVERS || e.key === LS_BOOKINGS) emit(); });
}
function readLocal<T>(key: string): Record<string, T> {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}
function writeLocal<T>(key: string, id: string, value: T | null) {
  try {
    const all = readLocal<T>(key);
    if (value === null) delete all[id]; else all[id] = value;
    localStorage.setItem(key, JSON.stringify(all));
  } catch { /* storage full / blocked — demo data just won't persist */ }
  emit();
}
function subscribeLocal(cb: Listener) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

let firestoreBroken = false;
const useFs = () => !!db && !firestoreBroken;
const strip = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

// ── drivers ──────────────────────────────────────────────────────────────────
export function useNetworkDrivers(): Driver[] {
  const [remote, setRemote] = useState<Driver[]>([]);
  const [local, setLocal] = useState<Driver[]>(() => Object.values(readLocal<Driver>(LS_DRIVERS)));
  useEffect(() => subscribeLocal(() => setLocal(Object.values(readLocal<Driver>(LS_DRIVERS)))), []);
  useEffect(() => {
    if (!useFs()) return;
    return onSnapshot(collection(db!, 'drivers'),
      snap => setRemote(snap.docs.map(d => d.data() as Driver)),
      err => { console.warn('[freight] drivers listener failed, using local store', err.message); firestoreBroken = true; });
  }, []);
  return useMemo(() => {
    const byId = new Map<string, Driver>();
    for (const d of SEED_DRIVERS) byId.set(d.id, d);
    for (const d of local) byId.set(d.id, d);
    for (const d of remote) byId.set(d.id, d);
    return [...byId.values()];
  }, [remote, local]);
}

export function useDriver(id: string | undefined): Driver | null {
  const all = useNetworkDrivers();
  return useMemo(() => all.find(d => d.id === id) ?? null, [all, id]);
}

export async function saveDriver(d: Driver) {
  const stamped = strip({ ...d, updatedAt: Date.now() });
  writeLocal(LS_DRIVERS, d.id, stamped);
  if (useFs()) {
    try { await setDoc(doc(db!, 'drivers', d.id), stamped); }
    catch (e: any) { console.warn('[freight] saveDriver fell back to local:', e?.message); }
  }
}

export async function publishLive(d: Driver, pos: { lat: number; lng: number }) {
  const live = { lat: pos.lat, lng: pos.lng, at: Date.now() };
  const all = readLocal<Driver>(LS_DRIVERS);
  if (all[d.id]) writeLocal(LS_DRIVERS, d.id, { ...all[d.id], live });
  if (useFs()) {
    try { await updateDoc(doc(db!, 'drivers', d.id), { live }); } catch { /* not yet created */ }
  }
}

// ── bookings ─────────────────────────────────────────────────────────────────
export function useBookings(filter: { driverId?: string; customerId?: string }): Booking[] {
  const key = filter.driverId ? ['driverId', filter.driverId] as const : filter.customerId ? ['customerId', filter.customerId] as const : null;
  const pick = (all: Booking[]) => key ? all.filter(b => b[key[0]] === key[1]) : [];
  const [remote, setRemote] = useState<Booking[]>([]);
  const [local, setLocal] = useState<Booking[]>(() => pick(Object.values(readLocal<Booking>(LS_BOOKINGS))));
  useEffect(() => {
    setLocal(pick(Object.values(readLocal<Booking>(LS_BOOKINGS))));
    return subscribeLocal(() => setLocal(pick(Object.values(readLocal<Booking>(LS_BOOKINGS)))));
  }, [key?.[0], key?.[1]]);
  useEffect(() => {
    if (!key || !useFs()) return;
    return onSnapshot(query(collection(db!, 'bookings'), where(key[0], '==', key[1])),
      snap => setRemote(snap.docs.map(d => d.data() as Booking)),
      err => { console.warn('[freight] bookings listener failed, using local store', err.message); firestoreBroken = true; });
  }, [key?.[0], key?.[1]]);
  return useMemo(() => {
    const byId = new Map<string, Booking>();
    for (const b of local) byId.set(b.id, b);
    for (const b of remote) {
      const l = byId.get(b.id);
      if (!l || b.updatedAt >= l.updatedAt) byId.set(b.id, b);
    }
    return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  }, [remote, local]);
}

export async function createBooking(b: Omit<Booking, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'history'>): Promise<Booking> {
  const now = Date.now();
  const booking: Booking = strip({
    ...b,
    id: `bk-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now,
    updatedAt: now,
    status: 'requested',
    history: [{ status: 'requested', at: now }],
  });
  writeLocal(LS_BOOKINGS, booking.id, booking);
  if (useFs()) {
    try { await setDoc(doc(db!, 'bookings', booking.id), booking); }
    catch (e: any) { console.warn('[freight] createBooking fell back to local:', e?.message); }
  }
  return booking;
}

export async function setBookingStatus(b: Booking, status: BookingStatus) {
  const now = Date.now();
  const next: Booking = { ...b, status, updatedAt: now, history: [...b.history, { status, at: now }] };
  writeLocal(LS_BOOKINGS, b.id, next);
  if (useFs()) {
    try { await updateDoc(doc(db!, 'bookings', b.id), { status, updatedAt: now, history: next.history }); }
    catch (e: any) { console.warn('[freight] setBookingStatus fell back to local:', e?.message); }
  }
}

export { effectiveStatus } from './network';

export function useNow(intervalMs = 2000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
