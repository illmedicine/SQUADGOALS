// Trailer catalog, shippable-item presets, fit checks, floor packing and
// pricing. All dimensions are in feet, weights in pounds.

export type TrailerType = {
  id: string;
  name: string;
  icon: string;
  length: number;   // usable deck length
  width: number;    // usable deck width
  height: number;   // usable cargo height
  maxWeight: number;
  open?: boolean;   // flatbed-style — drawn without walls
};

export const TRAILERS: TrailerType[] = [
  { id: 'dryvan53', name: "53' Dry Van", icon: '🚛', length: 52.5, width: 8.2, height: 9, maxWeight: 45000 },
  { id: 'reefer53', name: "53' Reefer", icon: '❄️', length: 51.5, width: 8.1, height: 8.5, maxWeight: 43000 },
  { id: 'flatbed48', name: "48' Flatbed", icon: '🪵', length: 48, width: 8.5, height: 8.5, maxWeight: 48000, open: true },
  { id: 'stepdeck53', name: "53' Step Deck", icon: '🏗️', length: 53, width: 8.5, height: 10, maxWeight: 46000, open: true },
  { id: 'conestoga53', name: "53' Conestoga", icon: '⛺', length: 53, width: 8.5, height: 8.5, maxWeight: 44000 },
  { id: 'carhauler', name: 'Car Hauler (9-car)', icon: '🚗', length: 80, width: 8.5, height: 6.5, maxWeight: 40000, open: true },
  { id: 'dryvan28', name: "28' Pup Van", icon: '📦', length: 27.5, width: 8.2, height: 9, maxWeight: 22000 },
];

export const TRAILER_BY_ID: Record<string, TrailerType> = Object.fromEntries(TRAILERS.map(t => [t.id, t]));

export type ItemKind =
  | 'sedan' | 'suv' | 'pickup' | 'motorcycle' | 'atv' | 'golfcart' | 'boat'
  | 'pallet' | 'sofa' | 'fridge' | 'piano' | 'washer' | 'box' | 'crate' | 'custom';

export type ItemPreset = {
  kind: ItemKind;
  name: string;
  icon: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  stackable?: boolean;
  color: string;
};

export const ITEM_PRESETS: ItemPreset[] = [
  { kind: 'sedan', name: 'Sedan / Car', icon: '🚗', length: 15.5, width: 6.2, height: 4.8, weight: 3300, color: '#3b82f6' },
  { kind: 'suv', name: 'SUV', icon: '🚙', length: 16.5, width: 6.6, height: 5.8, weight: 4800, color: '#0ea5e9' },
  { kind: 'pickup', name: 'Pickup Truck', icon: '🛻', length: 19.5, width: 6.8, height: 6.4, weight: 5200, color: '#6366f1' },
  { kind: 'motorcycle', name: 'Motorcycle', icon: '🏍️', length: 7.2, width: 2.8, height: 4, weight: 550, color: '#f97316' },
  { kind: 'atv', name: 'ATV / Quad', icon: '🛞', length: 6.5, width: 4, height: 4, weight: 700, color: '#84cc16' },
  { kind: 'golfcart', name: 'Golf Cart', icon: '⛳', length: 8, width: 4, height: 6, weight: 900, color: '#22c55e' },
  { kind: 'boat', name: 'Small Boat + Trailer', icon: '🚤', length: 18, width: 7, height: 7, weight: 3000, color: '#06b6d4' },
  { kind: 'pallet', name: 'Pallet (48×40)', icon: '🧱', length: 4, width: 3.33, height: 4.5, weight: 1200, stackable: true, color: '#d97706' },
  { kind: 'sofa', name: 'Sofa / Couch', icon: '🛋️', length: 7, width: 3, height: 3, weight: 150, stackable: true, color: '#a855f7' },
  { kind: 'fridge', name: 'Refrigerator', icon: '🧊', length: 3, width: 3, height: 6, weight: 300, color: '#94a3b8' },
  { kind: 'piano', name: 'Upright Piano', icon: '🎹', length: 5, width: 2.2, height: 4.2, weight: 600, color: '#1f2937' },
  { kind: 'washer', name: 'Washer / Dryer', icon: '🫧', length: 2.5, width: 2.5, height: 3.3, weight: 200, stackable: true, color: '#64748b' },
  { kind: 'box', name: 'Moving Box (med)', icon: '📦', length: 1.5, width: 1.5, height: 1.5, weight: 40, stackable: true, color: '#b45309' },
  { kind: 'crate', name: 'Wood Crate', icon: '🪵', length: 4, width: 4, height: 4, weight: 800, stackable: true, color: '#92400e' },
];

export const PRESET_BY_KIND: Record<string, ItemPreset> = Object.fromEntries(ITEM_PRESETS.map(p => [p.kind, p]));

// What the driver advertises for one journey.
export type CargoSpace = {
  trailerId: string;
  sqft: number;        // available floor area
  maxWeight: number;   // available payload, lbs
};

export type ShipItem = {
  kind: ItemKind;
  name: string;
  length: number;
  width: number;
  height: number;
  weight: number;      // per unit
  qty: number;
  stackable?: boolean;
  notes?: string;
};

export function trailerOf(c: CargoSpace): TrailerType {
  return TRAILER_BY_ID[c.trailerId] ?? TRAILERS[0];
}

// The available region as a rectangle at the rear of the deck.
export function availableDeck(c: CargoSpace) {
  const t = trailerOf(c);
  const sqft = Math.min(c.sqft, t.length * t.width);
  return { length: +(sqft / t.width).toFixed(2), width: t.width, height: t.height, sqft, maxWeight: c.maxWeight, trailer: t };
}

export type Placement = { x: number; y: number; l: number; w: number; layer: number };

// Simple grid packer: tries both floor orientations and stacks when allowed.
export function pack(deck: { length: number; width: number; height: number }, item: Pick<ShipItem, 'length' | 'width' | 'height' | 'stackable'>, limit = Infinity) {
  const layers = item.stackable ? Math.max(1, Math.floor(deck.height / item.height)) : (item.height <= deck.height ? 1 : 0);
  const tryOrient = (l: number, w: number) => {
    const cols = Math.floor(deck.length / l + 1e-6);
    const rows = Math.floor(deck.width / w + 1e-6);
    return { l, w, cols, rows, perLayer: cols * rows };
  };
  const a = tryOrient(item.length, item.width);
  const b = tryOrient(item.width, item.length);
  const best = b.perLayer > a.perLayer ? b : a;
  const capacity = best.perLayer * layers;
  const n = Math.min(capacity, limit);
  const placements: Placement[] = [];
  // Fill floor first, then stack — so the visual reads as "uses N feet of deck".
  for (let i = 0; i < n; i++) {
    const layer = Math.floor(i / best.perLayer);
    const idx = i % best.perLayer;
    const col = Math.floor(idx / best.rows);
    const row = idx % best.rows;
    placements.push({ x: col * best.l, y: row * best.w, l: best.l, w: best.w, layer });
  }
  return { capacity, placements, orient: best, layers };
}

export type FitResult = {
  fits: boolean;
  reasons: string[];
  capacity: number;            // how many of this item the space can take
  placements: Placement[];
  usedLength: number;          // feet of deck consumed
  footprintSqft: number;
  totalWeight: number;
  pctFloor: number;
  pctWeight: number;
};

export function checkFit(c: CargoSpace, item: ShipItem): FitResult {
  const deck = availableDeck(c);
  const reasons: string[] = [];
  const fitsFootprint =
    (item.length <= deck.length + 1e-6 && item.width <= deck.width + 1e-6) ||
    (item.width <= deck.length + 1e-6 && item.length <= deck.width + 1e-6);
  if (!fitsFootprint) {
    const longest = Math.max(item.length, item.width);
    if (Math.min(item.length, item.width) > deck.width) reasons.push(`Too wide — ${fmtFt(Math.min(item.length, item.width))} vs ${fmtFt(deck.width)} trailer width`);
    else reasons.push(`Needs ${fmtFt(longest)} of deck — only ${fmtFt(deck.length)} available`);
  }
  if (item.height > deck.height) reasons.push(`Too tall — ${fmtFt(item.height)} vs ${fmtFt(deck.height)} clearance`);
  const { capacity, placements } = pack(deck, item, item.qty);
  if (fitsFootprint && item.height <= deck.height && capacity < item.qty) {
    reasons.push(`Only ${capacity} of ${item.qty} fit in the listed space`);
  }
  const totalWeight = item.weight * item.qty;
  if (totalWeight > deck.maxWeight) reasons.push(`Over weight — ${fmtLbs(totalWeight)} vs ${fmtLbs(deck.maxWeight)} available`);
  const usedLength = placements.reduce((m, p) => Math.max(m, p.x + p.l), 0);
  const footprintSqft = placements.filter(p => p.layer === 0).reduce((s, p) => s + p.l * p.w, 0);
  return {
    fits: reasons.length === 0,
    reasons,
    capacity,
    placements,
    usedLength,
    footprintSqft: footprintSqft || item.length * item.width * item.qty,
    totalWeight,
    pctFloor: Math.min(1, (usedLength * deck.width) / Math.max(1, deck.sqft)),
    pctWeight: Math.min(1, totalWeight / Math.max(1, deck.maxWeight)),
  };
}

// "What fits in this space" gallery — how many of each preset the space takes.
export function whatFits(c: CargoSpace) {
  const deck = availableDeck(c);
  return ITEM_PRESETS
    .filter(p => p.kind !== 'box')
    .map(p => {
      const { capacity } = pack(deck, p);
      const byWeight = Math.floor(deck.maxWeight / p.weight);
      return { preset: p, count: Math.min(capacity, byWeight) };
    });
}

// ── Pricing ───────────────────────────────────────────────────────────────────
const FULL_TRUCK_RATE_PER_MILE = 2.6;
const FULL_DECK_SQFT = 430;

export function quote(miles: number, item: ShipItem, fit?: FitResult) {
  const footprint = fit?.usedLength ? fit.usedLength * 8.2 : item.length * item.width * item.qty;
  const share = Math.max(0.06, Math.min(1, Math.max(footprint / FULL_DECK_SQFT, (item.weight * item.qty) / 45000)));
  const lineHaul = Math.round(miles * FULL_TRUCK_RATE_PER_MILE * share);
  const pickupFee = 45;
  const insurance = Math.round(Math.max(15, lineHaul * 0.03));
  const platform = Math.round((lineHaul + pickupFee) * 0.08);
  const total = lineHaul + pickupFee + insurance + platform;
  return { miles: Math.round(miles), share, lineHaul, pickupFee, insurance, platform, total, driverPayout: lineHaul + pickupFee };
}

export const fmtFt = (ft: number) => {
  const whole = Math.floor(ft + 1e-6);
  const inches = Math.round((ft - whole) * 12);
  if (inches === 12) return `${whole + 1}'`;
  return inches ? `${whole}'${inches}"` : `${whole}'`;
};
export const fmtLbs = (lbs: number) => `${Math.round(lbs).toLocaleString()} lbs`;
export const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString()}`;
