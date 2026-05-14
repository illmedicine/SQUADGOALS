// Proximity badge engine — awards badges when squad members stay near each
// other for an accumulated amount of time. Tracked locally per device.
import { haversine, type LatLng } from './geo';

export type Badge = {
  id: string;
  name: string;
  icon: string;
  description: string;
  threshold: number;        // accumulated minutes near a squadmate
};

export const BADGES: Badge[] = [
  { id: 'first-link',  name: 'First Link',  icon: '🔗', description: 'Be within 50m of a squadmate.', threshold: 0 },
  { id: 'side-by-side',name: 'Side by Side',icon: '🤝', description: '15 min near a squadmate.', threshold: 15 },
  { id: 'inseparable', name: 'Inseparable', icon: '💎', description: '60 min near a squadmate.', threshold: 60 },
  { id: 'ride-or-die', name: 'Ride or Die', icon: '🔥', description: '4 hours near a squadmate.', threshold: 240 },
  { id: 'crowd-finder',name: 'Crowd Finder',icon: '🎯', description: 'Find 3+ squadmates at once.', threshold: -1 },
  { id: 'prestige-i',  name: 'Prestige I',  icon: '⭐', description: '10 hours total nearby.', threshold: 600 },
  { id: 'prestige-ii', name: 'Prestige II', icon: '🌟', description: '25 hours total nearby.', threshold: 1500 },
  { id: 'prestige-iii',name: 'Prestige III',icon: '👑', description: '100 hours total nearby.', threshold: 6000 }
];

// Check-in / pin-drop badges — earned from gameplay. Tracked via stats
// rather than minute-accumulation, but live in the same UI list.
export type StatBadge = {
  id: string;
  name: string;
  icon: string;
  description: string;
  check: (s: { checkIns?: number; publicPins?: number; reviews?: number; comments?: number; xp?: number }) => boolean;
};
export const STAT_BADGES: StatBadge[] = [
  { id: 'first-checkin', name: 'First Check-in', icon: '📍', description: 'Check in for the first time.',
    check: s => (s.checkIns || 0) >= 1 },
  { id: 'ten-checkins',  name: 'Frequent Flyer', icon: '✈️', description: '10 check-ins.',
    check: s => (s.checkIns || 0) >= 10 },
  { id: 'fifty-checkins',name: 'Globetrotter',   icon: '🌍', description: '50 check-ins.',
    check: s => (s.checkIns || 0) >= 50 },
  { id: 'first-pin',     name: 'Pin Dropper',    icon: '📌', description: 'Drop your first public pin.',
    check: s => (s.publicPins || 0) >= 1 },
  { id: 'ten-pins',      name: 'Cartographer',   icon: '🗺️', description: '10 public pins.',
    check: s => (s.publicPins || 0) >= 10 },
  { id: 'first-review',  name: 'Critic',         icon: '📝', description: 'Leave your first review.',
    check: s => (s.reviews || 0) >= 1 },
  { id: 'ten-reviews',   name: 'Yelper',         icon: '⭐', description: '10 reviews left.',
    check: s => (s.reviews || 0) >= 10 },
  { id: 'social',        name: 'Social Butterfly', icon: '🦋', description: '25 comments posted.',
    check: s => (s.comments || 0) >= 25 }
];

const KEY = 'squadren.badgeState';
const PROX_M = 50;

type BadgeState = {
  totalMinutes: number;
  lastTick: number | null;
  unlocked: Record<string, number>;
  maxConcurrent: number;
};

function load(): BadgeState {
  const v = localStorage.getItem(KEY);
  return v ? JSON.parse(v) : { totalMinutes: 0, lastTick: null, unlocked: {}, maxConcurrent: 0 };
}
function save(s: BadgeState) { localStorage.setItem(KEY, JSON.stringify(s)); }

export function tickBadges(me: LatLng | null, mates: LatLng[]): BadgeState {
  const s = load();
  const now = Date.now();
  const nearby = me ? mates.filter(m => haversine(me, m) <= PROX_M).length : 0;

  if (nearby > 0 && me) {
    if (s.lastTick) {
      const dtMin = (now - s.lastTick) / 60000;
      s.totalMinutes += Math.min(dtMin, 1); // cap drift
    }
    s.lastTick = now;
    if (!s.unlocked['first-link']) s.unlocked['first-link'] = now;
  } else {
    s.lastTick = null;
  }
  s.maxConcurrent = Math.max(s.maxConcurrent, nearby);

  for (const b of BADGES) {
    if (s.unlocked[b.id]) continue;
    if (b.id === 'crowd-finder' && s.maxConcurrent >= 3) s.unlocked[b.id] = now;
    else if (b.threshold > 0 && s.totalMinutes >= b.threshold) s.unlocked[b.id] = now;
  }
  save(s);
  return s;
}

export function getBadgeState(): BadgeState { return load(); }
export function resetBadges() { localStorage.removeItem(KEY); }
