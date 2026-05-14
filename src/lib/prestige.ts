// Prestige / XP system — earned by check-ins, public pin drops, and time
// near squadmates. Stored per-user in Firestore (and mirrored to
// localStorage for instant UI). Each tier unlocks new avatar accessories
// and a fancier title.

import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type Stats = {
  xp: number;
  checkIns: number;
  publicPins: number;
  comments: number;
  reviews: number;
};

export const STATS_DEFAULT: Stats = { xp: 0, checkIns: 0, publicPins: 0, comments: 0, reviews: 0 };

export const TIERS = [
  { tier: 0, name: 'Rookie',    xp: 0,    color: '#94a3b8', icon: '🌱' },
  { tier: 1, name: 'Regular',   xp: 50,   color: '#22c55e', icon: '🌿' },
  { tier: 2, name: 'Local',     xp: 150,  color: '#0ea5e9', icon: '🗺️' },
  { tier: 3, name: 'Explorer',  xp: 400,  color: '#8b5cf6', icon: '🧭' },
  { tier: 4, name: 'Trailblazer', xp: 900, color: '#ec4899', icon: '🔥' },
  { tier: 5, name: 'Legend',    xp: 2000, color: '#f59e0b', icon: '👑' },
  { tier: 6, name: 'Mythic',    xp: 5000, color: '#ef4444', icon: '🌟' }
];

export function tierForXp(xp: number) {
  let t = TIERS[0];
  for (const cur of TIERS) if (xp >= cur.xp) t = cur;
  return t;
}

export function nextTier(xp: number) {
  return TIERS.find(t => xp < t.xp) || null;
}

// XP awards per action.
export const XP = {
  CHECK_IN: 10,
  PUBLIC_PIN: 25,
  COMMENT: 3,
  REVIEW: 8,
  NEW_PLACE_BONUS: 15   // first time anyone in the squad world logs this spot
};

// Accessories unlocked at each tier. Keys match `AvatarConfig.accessory`
// ids or a special `aura` field.
export const UNLOCKS: Record<string, number> = {
  // base — always available
  none: 0, glasses: 0, hat: 0, headphones: 0,
  // tier 1
  sunglasses: 1, beanie: 1,
  // tier 2
  earrings: 2, mask: 2,
  // tier 3
  crown: 3,
  // tier 4
  halo: 4,
  // tier 5
  flame: 5,
  // tier 6
  cosmic: 6
};

const LKEY = 'squadren.stats';
export function loadLocalStats(): Stats {
  try {
    const v = localStorage.getItem(LKEY);
    return v ? { ...STATS_DEFAULT, ...JSON.parse(v) } : { ...STATS_DEFAULT };
  } catch { return { ...STATS_DEFAULT }; }
}
export function saveLocalStats(s: Stats) {
  localStorage.setItem(LKEY, JSON.stringify(s));
}

// Apply a stats delta both locally and in Firestore. Firestore uses
// FieldValue.increment so concurrent updates from multiple devices don't
// clobber each other.
export async function awardXp(uid: string | null, delta: Partial<Stats>) {
  const local = loadLocalStats();
  const next: Stats = { ...local };
  (Object.keys(delta) as (keyof Stats)[]).forEach(k => {
    next[k] = (next[k] || 0) + (delta[k] || 0);
  });
  saveLocalStats(next);

  if (!uid || !db) return next;
  try {
    const ref = doc(db, 'users', uid);
    // Try to update first; if no doc exists, fall back to a merge-set.
    const updates: any = { statsUpdatedAt: serverTimestamp() };
    for (const k of Object.keys(delta) as (keyof Stats)[]) {
      updates['stats.' + k] = increment(delta[k] || 0);
    }
    await updateDoc(ref, updates).catch(async () => {
      await setDoc(ref, { stats: next, statsUpdatedAt: serverTimestamp() }, { merge: true });
    });
  } catch (e) {
    // Offline / rules error — local copy already updated, will reconcile later.
    console.warn('[prestige] award failed', e);
  }
  return next;
}

export async function fetchStats(uid: string): Promise<Stats> {
  if (!db) return loadLocalStats();
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const data: any = snap.data();
    const s = { ...STATS_DEFAULT, ...(data?.stats || {}) };
    saveLocalStats(s);
    return s;
  } catch {
    return loadLocalStats();
  }
}
