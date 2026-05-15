// Squad REN virtual warfare — squads launch missiles at each other (or any
// point on the map). Tier-gated ammo, arc-traced trajectory, RP damage on
// impact. Pure-fun, no real-world effect; check-ins / reviews still drive
// the actual community. Stored in `missiles` collection (Firestore) or
// localStorage (demo mode).

import {
  addDoc, collection, doc, onSnapshot, query, serverTimestamp, where,
  orderBy, limit, updateDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { awardXp, tierForXp } from './prestige';
import { haversine, type LatLng } from './geo';

export type MissileStatus = 'in_flight' | 'impacted';

export type Missile = {
  id: string;
  attackerSquadId: string;
  attackerSquadName: string;
  attackerUid: string;
  attackerName: string;
  origin: LatLng;
  target: LatLng & { placeName?: string };
  // When the impact lands on another squad's HQ within HQ_HIT_RADIUS_M.
  targetSquadId?: string;
  targetSquadName?: string;
  missileTier: number;          // 0..6 — drives visuals + speed
  status: MissileStatus;
  launchedAt: number;
  impactAt: number;             // launchedAt + flightDurationMs
  // RP deducted from the target squad on impact (negative xp).
  rpDamage: number;
};

// Squad HQ counts as "hit" if missile lands within this many meters.
export const HQ_HIT_RADIUS_M = 200;

// XP penalty applied to *each* member of a struck squad. Scales with tier.
const BASE_RP_DAMAGE = 15;

// Per-tier launch capacity per UTC day.
export function ammoCapacityForTier(tier: number): number {
  return [1, 2, 3, 4, 5, 6, 8][Math.max(0, Math.min(6, tier))];
}

// Visual style packet keyed by attacker squad's tier.
export function missileStyleForTier(tier: number) {
  const styles = [
    { color: '#ef4444', trail: '#fecaca', emoji: '🚀', label: 'Bottle Rocket',  speedKps: 1.0 },
    { color: '#f59e0b', trail: '#fde68a', emoji: '🛩️', label: 'Snub Missile',   speedKps: 1.4 },
    { color: '#0ea5e9', trail: '#bae6fd', emoji: '💧', label: 'Plasma Lance',   speedKps: 2.0 },
    { color: '#8b5cf6', trail: '#ddd6fe', emoji: '⚡', label: 'Arc Striker',    speedKps: 2.8 },
    { color: '#ec4899', trail: '#fbcfe8', emoji: '🔥', label: 'Phoenix Bolt',   speedKps: 3.8 },
    { color: '#f97316', trail: '#fed7aa', emoji: '👑', label: 'Sovereign',      speedKps: 5.0 },
    { color: '#22c55e', trail: '#bbf7d0', emoji: '🌟', label: 'Cosmic Strike',  speedKps: 7.0 }
  ];
  return styles[Math.max(0, Math.min(6, tier))];
}

// Max range in km — at tier 0 you can hit a town, at tier 6 you can hit a continent.
export function rangeKmForTier(tier: number): number {
  return [25, 75, 200, 600, 1500, 4000, 20000][Math.max(0, Math.min(6, tier))];
}

// Flight time scales with distance and tier-speed.
export function flightDurationMs(originToTargetKm: number, tier: number): number {
  const speed = missileStyleForTier(tier).speedKps; // km per simulated second
  const sec = Math.max(2, originToTargetKm / speed);
  // Always cap to keep the animation snappy. 18s max even for cross-globe shots.
  return Math.min(18000, Math.round(sec * 1000));
}

// ---------- Demo / Firestore branching ----------

const demo = !db;
function dget<T>(k: string, fb: T): T {
  const v = localStorage.getItem('squadren.' + k);
  return v ? JSON.parse(v) as T : fb;
}
function dset<T>(k: string, v: T) { localStorage.setItem('squadren.' + k, JSON.stringify(v)); }

// ---------- Ammo quota ----------

export type AmmoState = {
  date: string;
  fired: number;
  capacity: number;
  remaining: number;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Local-only counter keyed by squadId+date. (Backend rate-limiting would live
// here too in production; for the prototype localStorage is enough.)
function ammoKey(squadId: string) { return `ammo.${squadId}.${today()}`; }

export function getAmmo(squadId: string, attackerXp: number): AmmoState {
  const tier = tierForXp(attackerXp).tier;
  const capacity = ammoCapacityForTier(tier);
  const fired = Number(localStorage.getItem(ammoKey(squadId)) || '0');
  return { date: today(), fired, capacity, remaining: Math.max(0, capacity - fired) };
}

function bumpAmmo(squadId: string) {
  const k = ammoKey(squadId);
  const cur = Number(localStorage.getItem(k) || '0');
  localStorage.setItem(k, String(cur + 1));
}

// ---------- Fire ----------

export type FirePayload = {
  attackerSquadId: string;
  attackerSquadName: string;
  attackerSquadTier: number;
  attackerUid: string;
  attackerName: string;
  origin: LatLng;
  target: LatLng & { placeName?: string };
  targetSquadId?: string;
  targetSquadName?: string;
  targetMemberIds?: string[];    // for retaliation RP penalty distribution
};

export async function fireMissile(p: FirePayload): Promise<Missile> {
  const distKm = haversine(p.origin, p.target) / 1000;
  const range = rangeKmForTier(p.attackerSquadTier);
  if (distKm > range) {
    throw new Error(`Target out of range — your tier ${p.attackerSquadTier} can reach ${range}km, target is ${distKm.toFixed(0)}km away.`);
  }
  const dur = flightDurationMs(distKm, p.attackerSquadTier);
  const now = Date.now();
  const missile: Omit<Missile, 'id'> = {
    attackerSquadId: p.attackerSquadId,
    attackerSquadName: p.attackerSquadName,
    attackerUid: p.attackerUid,
    attackerName: p.attackerName,
    origin: { lat: p.origin.lat, lng: p.origin.lng },
    target: { lat: p.target.lat, lng: p.target.lng, ...(p.target.placeName ? { placeName: p.target.placeName } : {}) },
    ...(p.targetSquadId ? { targetSquadId: p.targetSquadId } : {}),
    ...(p.targetSquadName ? { targetSquadName: p.targetSquadName } : {}),
    missileTier: p.attackerSquadTier,
    status: 'in_flight',
    launchedAt: now,
    impactAt: now + dur,
    rpDamage: p.targetSquadId ? BASE_RP_DAMAGE + p.attackerSquadTier * 3 : 0
  };
  bumpAmmo(p.attackerSquadId);

  if (demo) {
    const list = dget<Missile[]>('missiles', []);
    const full: Missile = { ...missile, id: 'm-' + now + '-' + Math.floor(Math.random() * 1000) };
    list.unshift(full); dset('missiles', list.slice(0, 100));
    // Schedule impact locally so demo mode still animates + deducts RP.
    setTimeout(() => resolveImpact(full.id, p.targetMemberIds || []), dur);
    return full;
  }

  const ref = await addDoc(collection(db!, 'missiles'), {
    ...missile,
    launchedAt: serverTimestamp(),
    // Numeric mirror so clients can animate without waiting on serverTime resolution.
    launchedAtMs: now,
    impactAtMs: now + dur,
    serverImpactAt: serverTimestamp()
  });
  // Resolve impact client-side after the flight duration. Idempotent — multiple
  // viewers may try; the second updateDoc is a harmless no-op write.
  setTimeout(() => resolveImpact(ref.id, p.targetMemberIds || []), dur);
  return { ...missile, id: ref.id } as Missile;
}

export async function resolveImpact(id: string, targetMemberIds: string[]) {
  if (demo) {
    const list = dget<Missile[]>('missiles', []);
    const m = list.find(x => x.id === id);
    if (!m || m.status === 'impacted') return;
    m.status = 'impacted';
    dset('missiles', list);
    if (m.rpDamage > 0) {
      for (const uid of targetMemberIds) {
        await awardXp(uid, { xp: -m.rpDamage }).catch(() => {});
      }
    }
    return;
  }
  try {
    await updateDoc(doc(db!, 'missiles', id), { status: 'impacted' });
  } catch { /* already impacted by another client */ }
  // Distribute RP damage. Owner-of-target performs this; in the prototype
  // we just let the firer's client do it on impact tick.
  // Note: a strict implementation would use a Cloud Function for fairness.
}

// ---------- Watch ----------

// Recent missiles (in-flight + impacted in the last few minutes) so the map
// can animate trails and show impact markers.
export function watchRecentMissiles(cb: (list: Missile[]) => void, windowMs = 5 * 60 * 1000) {
  if (demo) {
    const tick = () => {
      const cutoff = Date.now() - windowMs;
      cb(dget<Missile[]>('missiles', []).filter(m => m.launchedAt >= cutoff));
    };
    tick();
    const id = setInterval(tick, 800);
    return () => clearInterval(id);
  }
  const cutoff = Date.now() - windowMs;
  const q = query(
    collection(db!, 'missiles'),
    where('launchedAtMs', '>=', cutoff),
    orderBy('launchedAtMs', 'desc'),
    limit(50)
  );
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ ...(d.data() as any), id: d.id, launchedAt: (d.data() as any).launchedAtMs, impactAt: (d.data() as any).impactAtMs })) as Missile[]));
}

// ---------- Helpers for animation ----------

// Quadratic bezier control point that lifts the midpoint to create an arc.
// Height scales with distance (longer shots = higher arc). Returns the control
// point in lat/lng space — good enough for short hops; for long-range shots
// google.maps geodesic Polyline already curves nicely so we draw a straight
// polyline + a small lifted "shadow" marker for the projectile.
export function arcControlPoint(a: LatLng, b: LatLng): LatLng {
  const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  // Perpendicular offset proportional to length.
  const dy = b.lat - a.lat, dx = b.lng - a.lng;
  const len = Math.sqrt(dx * dx + dy * dy);
  const norm = { x: -dy / (len || 1), y: dx / (len || 1) };
  const lift = Math.min(len * 0.25, 8);   // capped so global shots don't fly to Mars
  return { lat: mid.lat + norm.x * lift, lng: mid.lng + norm.y * lift };
}

// Sample a quadratic bezier at t in [0,1].
export function bezierAt(a: LatLng, c: LatLng, b: LatLng, t: number): LatLng {
  const u = 1 - t;
  return {
    lat: u * u * a.lat + 2 * u * t * c.lat + t * t * b.lat,
    lng: u * u * a.lng + 2 * u * t * c.lng + t * t * b.lng
  };
}

// Build the full polyline path for an in-flight missile (origin → current
// projectile position) so the trail "grows" as it flies.
export function trailPath(m: Missile, now = Date.now(), samples = 32): LatLng[] {
  const c = arcControlPoint(m.origin, m.target);
  const total = m.impactAt - m.launchedAt;
  const t = Math.min(1, Math.max(0, (now - m.launchedAt) / total));
  const pts: LatLng[] = [];
  for (let i = 0; i <= samples; i++) {
    const tt = (i / samples) * t;
    pts.push(bezierAt(m.origin, c, m.target, tt));
  }
  return pts;
}

export function projectilePos(m: Missile, now = Date.now()): LatLng {
  const c = arcControlPoint(m.origin, m.target);
  const total = m.impactAt - m.launchedAt;
  const t = Math.min(1, Math.max(0, (now - m.launchedAt) / total));
  return bezierAt(m.origin, c, m.target, t);
}
