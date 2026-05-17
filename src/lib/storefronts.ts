// Storefront discovery + lifecycle events.
//
// Two responsibilities:
//   1. Provide a live feed of *public* storefronts (newest first) for the
//      "🛍️ Storefronts" tab on the leaderboard.
//   2. Broadcast lifecycle events (a brand new storefront just opened, a
//      vendor just redeemed an exclusive promo) so every signed-in user can
//      see a celebratory popup. Real mode -> Firestore `storefrontEvents`
//      collection. Demo mode -> per-browser localStorage so the UI still
//      animates for solo testers.
//
// All write paths are intentionally idempotent and best-effort: if the network
// blip swallows an announce, the storefront still works, you just miss the
// notification.

import {
  addDoc, collection, doc, onSnapshot, orderBy, query, limit,
  serverTimestamp, setDoc, where
} from 'firebase/firestore';
import { db, firebaseConfigured } from './firebase';
import type { Storefront, StorefrontPerks, AppUser } from './AuthContext';

/* ──────────────────────────────────────────────────────────────────────────
 * Promo codes
 * Keep the registry small and obvious — these are recruiting perks tied to
 * external campaigns (Indeed, conference handouts, etc.) so we want them
 * grep-able in one spot.
 * ────────────────────────────────────────────────────────────────────────── */
export type PromoCode = {
  code: string;
  label: string;        // user-facing celebration line
  perks: StorefrontPerks;
  // What this campaign was attached to — surfaces in the popup so casual
  // viewers learn there's a way *they* could earn this badge too.
  campaign: string;
};

export const PROMO_CODES: Record<string, PromoCode> = {
  NAILSON10: {
    code: 'NAILSON10',
    label: '✨ Founding Vendor unlocked — Indeed Charter Class',
    campaign: 'Indeed launch · Charter Class of 2026',
    perks: {
      prestigeBadge: '🌟 Founding Vendor',
      badgeColor: '#fde047',
      storefrontGlow: true,
      animatedAvatar: true,
      exclusiveOutfit: '✨ Aurora Apron + Sparkle Crown',
      source: 'NAILSON10'
    }
  }
};

/** Normalise + validate a code. Returns the matched record or null. */
export function lookupPromoCode(raw: string): PromoCode | null {
  const code = (raw || '').trim().toUpperCase();
  if (!code) return null;
  return PROMO_CODES[code] || null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Public storefronts feed
 * ────────────────────────────────────────────────────────────────────────── */
export type PublicStorefront = Storefront & {
  uid: string;
  ownerName: string;
  ownerPhotoURL?: string | null;
  publishedAt?: number;
};

// Seed list so the leaderboard and discovery surface look populated even
// before real vendors sign up. Mirrors the demo-squads pattern.
const SEED: PublicStorefront[] = [
  {
    uid: 'seed-bean-vine',
    ownerName: 'Renee — Bean & Vine',
    kind: 'business',
    name: 'Bean & Vine Coffee',
    tagline: 'Slow brews, faster mornings.',
    category: 'Coffee',
    city: 'Brooklyn', state: 'NY', country: 'USA',
    offers: '15% off lattes for squadders before 10am',
    visibility: 'public',
    publishedAt: Date.now() - 1000 * 60 * 60 * 22,
    items: [
      { id: 's1-1', name: 'Cortado',    price: 4.5,  description: 'House espresso, micro-foamed milk.' },
      { id: 's1-2', name: 'Iced Mocha', price: 5.25, description: 'Cold brew base, dark cocoa.' },
      { id: 's1-3', name: 'Drip refill', price: 1,   description: 'Stay all morning.' }
    ]
  },
  {
    uid: 'seed-needle-thread',
    ownerName: 'Sage — Needle & Thread',
    kind: 'service',
    name: 'Needle & Thread Tattoo',
    tagline: 'Custom fine-line, book ahead.',
    category: 'Tattoo',
    city: 'Austin', state: 'TX', country: 'USA',
    offers: 'Squad walk-ins get free wrist piece w/ any half-sleeve',
    visibility: 'public',
    publishedAt: Date.now() - 1000 * 60 * 60 * 50,
    items: [
      { id: 's2-1', name: 'Flash piece',  priceText: 'from $80' },
      { id: 's2-2', name: 'Half-sleeve',  priceText: 'from $450' },
      { id: 's2-3', name: 'Consultation', priceText: 'free' }
    ]
  },
  {
    uid: 'seed-pulse',
    ownerName: 'DJ Pulse',
    kind: 'creator',
    name: 'DJ Pulse — Open Decks',
    tagline: 'House sets every Friday at the Watering Hole.',
    category: 'Music',
    city: 'Los Angeles', state: 'CA', country: 'USA',
    offers: 'Bring 4 squadmates → free cover before midnight',
    visibility: 'public',
    publishedAt: Date.now() - 1000 * 60 * 60 * 6,
    items: [
      { id: 's3-1', name: '90-min DJ set', price: 180 },
      { id: 's3-2', name: 'Custom intro track', price: 60 }
    ]
  },
  {
    uid: 'seed-rooftop',
    ownerName: 'Rooftop Yoga',
    kind: 'venue',
    name: 'Rooftop Yoga PHX',
    tagline: 'Sunrise flow with skyline views.',
    category: 'Fitness',
    city: 'Phoenix', state: 'AZ', country: 'USA',
    visibility: 'public',
    publishedAt: Date.now() - 1000 * 60 * 60 * 73,
    items: [
      { id: 's4-1', name: 'Drop-in class', price: 22 },
      { id: 's4-2', name: '10-class pack', price: 180 }
    ]
  }
];

const LS_PUBLIC = 'squadren.publicStorefronts.v1';

function loadLocalPublic(): PublicStorefront[] {
  try {
    const raw = localStorage.getItem(LS_PUBLIC);
    if (!raw) return [];
    return JSON.parse(raw) as PublicStorefront[];
  } catch { return []; }
}

function saveLocalPublic(list: PublicStorefront[]) {
  try { localStorage.setItem(LS_PUBLIC, JSON.stringify(list.slice(0, 200))); } catch {}
}

/**
 * Persist this user's public storefront snapshot to the global feed so it
 * shows up on the leaderboard. Real mode = mirrored doc in
 * `publicStorefronts/{uid}`. Demo mode = localStorage map.
 */
export async function publishStorefront(user: AppUser, storefront: Storefront): Promise<void> {
  if (storefront.visibility !== 'public' || !storefront.name) return;
  const record: PublicStorefront = {
    uid: user.uid,
    ownerName: user.displayName || 'Squadder',
    ownerPhotoURL: user.photoURL || null,
    publishedAt: storefront.firstOpenedAt || Date.now(),
    ...storefront
  };
  if (firebaseConfigured && db) {
    await setDoc(doc(db, 'publicStorefronts', user.uid), {
      ...record,
      _serverPublishedAt: serverTimestamp()
    }, { merge: true });
    return;
  }
  const list = loadLocalPublic().filter(s => s.uid !== user.uid);
  list.unshift(record);
  saveLocalPublic(list);
}

/** Live subscription to public storefronts (newest first, capped). */
export function watchPublicStorefronts(cb: (rows: PublicStorefront[]) => void): () => void {
  if (firebaseConfigured && db) {
    const q = query(collection(db, 'publicStorefronts'), where('visibility', '==', 'public'), limit(80));
    return onSnapshot(q, snap => {
      const rows: PublicStorefront[] = snap.docs.map(d => d.data() as PublicStorefront);
      rows.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
      cb([...rows, ...SEED.filter(s => !rows.some(r => r.uid === s.uid))]);
    }, () => {
      // Permission/transport error — fall back to seed only so the UI still renders.
      cb([...SEED]);
    });
  }
  // Demo mode: combine local + seed, newest first.
  const emit = () => {
    const local = loadLocalPublic();
    const merged = [...local, ...SEED.filter(s => !local.some(l => l.uid === s.uid))];
    merged.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
    cb(merged);
  };
  emit();
  const onStorage = (e: StorageEvent) => { if (e.key === LS_PUBLIC) emit(); };
  window.addEventListener('storage', onStorage);
  // Poll once a second so changes inside the same tab show up too.
  const id = window.setInterval(emit, 1000);
  return () => { window.removeEventListener('storage', onStorage); window.clearInterval(id); };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Announcement events (popups for everyone)
 * ────────────────────────────────────────────────────────────────────────── */
export type StorefrontEvent = {
  id: string;
  kind: 'opened' | 'promo';
  uid: string;                 // owner uid
  ownerName: string;
  storefrontName: string;
  city?: string;
  state?: string;
  category?: string;
  promoCode?: string;
  promoLabel?: string;
  badge?: string;
  badgeColor?: string;
  atMs: number;
};

const LS_EVENTS = 'squadren.storefrontEvents.v1';
const LS_SEEN   = 'squadren.storefrontEventsSeen.v1';

function loadLocalEvents(): StorefrontEvent[] {
  try {
    const raw = localStorage.getItem(LS_EVENTS);
    if (!raw) return [];
    return JSON.parse(raw) as StorefrontEvent[];
  } catch { return []; }
}
function saveLocalEvents(list: StorefrontEvent[]) {
  try { localStorage.setItem(LS_EVENTS, JSON.stringify(list.slice(0, 60))); } catch {}
}

function newId() {
  return 'ev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function pushEvent(ev: StorefrontEvent): Promise<void> {
  if (firebaseConfigured && db) {
    try {
      await addDoc(collection(db, 'storefrontEvents'), {
        ...ev,
        _serverAt: serverTimestamp()
      });
      return;
    } catch (err) {
      console.warn('[storefronts] event write failed, falling back to local', err);
    }
  }
  const list = [ev, ...loadLocalEvents()];
  saveLocalEvents(list);
  // Nudge other tabs.
  try { window.dispatchEvent(new StorageEvent('storage', { key: LS_EVENTS })); } catch {}
}

export async function announceStorefrontOpened(user: AppUser, s: Storefront): Promise<void> {
  if (!s.name) return;
  await pushEvent({
    id: newId(),
    kind: 'opened',
    uid: user.uid,
    ownerName: user.displayName || 'Squadder',
    storefrontName: s.name,
    city: s.city,
    state: s.state,
    category: s.category,
    atMs: Date.now()
  });
}

export async function announcePromoRedeemed(user: AppUser, s: Storefront, code: PromoCode): Promise<void> {
  await pushEvent({
    id: newId(),
    kind: 'promo',
    uid: user.uid,
    ownerName: user.displayName || 'Squadder',
    storefrontName: s.name || (user.displayName || 'Squadder') + '\u2019s storefront',
    city: s.city,
    state: s.state,
    promoCode: code.code,
    promoLabel: code.label,
    badge: code.perks.prestigeBadge,
    badgeColor: code.perks.badgeColor,
    atMs: Date.now()
  });
}

/**
 * Subscribe to recent storefront events. Yields the latest ~20, newest first.
 * Caller dedupes by id and decides which to show as a popup (typically: any
 * event from the last 5 minutes that this device hasn't already seen).
 */
export function watchStorefrontEvents(cb: (rows: StorefrontEvent[]) => void): () => void {
  if (firebaseConfigured && db) {
    const q = query(collection(db, 'storefrontEvents'), orderBy('atMs', 'desc'), limit(20));
    return onSnapshot(q, snap => {
      cb(snap.docs.map(d => d.data() as StorefrontEvent));
    }, () => cb(loadLocalEvents()));
  }
  const emit = () => cb(loadLocalEvents());
  emit();
  const onStorage = (e: StorageEvent) => { if (e.key === LS_EVENTS) emit(); };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

/** Per-device dedupe for which events have already popped. */
export function readSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_SEEN);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
}
export function markSeen(ids: string[]): void {
  const cur = readSeenIds();
  ids.forEach(i => cur.add(i));
  try { localStorage.setItem(LS_SEEN, JSON.stringify([...cur].slice(-500))); } catch {}
}
