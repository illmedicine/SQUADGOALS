// Buffalo, NY showcase seed — 10 demo female squadders, each with a
// distinct storefront offering one service. They form a single public
// squad ("Buffalo Queens Collective") so new users can see what an
// active, hyper-local squad community feels like before signing up.
//
// These are deterministic, always-present demo accounts. They:
//   • appear on the map as public presence (amber storefront pins)
//   • show up in the live "Squadders online" pulse
//   • count toward the live-squad pill via shared squadIds
//   • render rich storefront cards when tapped
//
// All UIDs are stable and namespaced with `demo-buf-` so we can filter
// them out of any real analytics / leaderboards if we ever need to.

import type { Presence, Squad } from './data';
import type { Storefront, AvatarConfig } from './AuthContext';
import type { ActiveUser } from './pulse';

export const BUFFALO_DEMO_SQUAD_ID = 'demo-buf-squad-queens';

type SeedUser = {
  uid: string;
  displayName: string;
  lat: number;
  lng: number;
  neighborhood: string;
  storefront: Storefront;
  avatar: AvatarConfig;
};

// Real Buffalo neighborhoods so the markers land on streets, not the lake.
// Coords are approximate centers of each neighborhood.
const SEED: SeedUser[] = [
  {
    uid: 'demo-buf-001',
    displayName: 'Jasmine T.',
    lat: 42.8975, lng: -78.8585, // Allentown
    neighborhood: 'Allentown',
    storefront: {
      kind: 'service',
      name: 'Lashed by Jas',
      category: 'Beauty · Lashes',
      tagline: 'Volume sets, hybrids, and weekly fills.',
      bio: 'Licensed lash tech serving Allentown + downtown Buffalo. 5+ years experience, latex-free adhesive available.',
      serviceArea: 'Allentown · Elmwood Village',
      offers: '$10 off your first full set for any squadmate.',
      instagram: 'lashedbyjas',
      items: [
        { name: 'Classic full set', price: '$110' },
        { name: 'Hybrid full set', price: '$140' },
        { name: '2-week fill', price: '$65' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#c68b59', hair: '#1a0f08', shirt: '#ec4899', accessory: 'glasses', body: 'fem', hairStyle: 'long', eyes: '#3b2417', pants: '#1e293b', shoes: '#0f172a', background: '#fce7f3' }
  },
  {
    uid: 'demo-buf-002',
    displayName: 'Aaliyah B.',
    lat: 42.9234, lng: -78.8512, // North Buffalo
    neighborhood: 'North Buffalo',
    storefront: {
      kind: 'service',
      name: 'Twists by Liyah',
      category: 'Hair · Locs & Twists',
      tagline: 'Dread retwists, starter locs, and protective styles.',
      bio: 'Cozy in-home studio off Hertel. Specializing in loc maintenance and palm-rolling. Booking 1 week out.',
      serviceArea: 'North Buffalo · Hertel',
      offers: 'Walk-in retwists Sundays — $20 off for first-timers.',
      instagram: 'twistsbyliyah',
      items: [
        { name: 'Loc retwist', price: '$80' },
        { name: 'Starter locs', price: '$220' },
        { name: 'Two-strand twists', price: '$140' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#8d5524', hair: '#1a0f08', shirt: '#f59e0b', accessory: 'none', body: 'fem', hairStyle: 'curly', eyes: '#1a0f08', pants: '#0f172a', shoes: '#7c2d12', background: '#fef3c7' }
  },
  {
    uid: 'demo-buf-003',
    displayName: 'Mariah S.',
    lat: 42.8869, lng: -78.8784, // West Side
    neighborhood: 'West Side',
    storefront: {
      kind: 'business',
      name: 'Mari\u2019s Soul Bowls',
      category: 'Food · Soul / Caribbean',
      tagline: 'Jerk bowls, oxtail plates, plantains done right.',
      bio: 'Pop-up kitchen out of the West Side Bazaar Thursday\u2013Sunday. Cash and Venmo only.',
      serviceArea: 'West Side · Grant St',
      offers: 'Show your Squad REN pin = free plantains with any bowl.',
      website: 'marissoulbowls.square.site',
      instagram: 'marissoulbowls',
      items: [
        { name: 'Jerk chicken bowl', price: '$14' },
        { name: 'Oxtail plate', price: '$22' },
        { name: 'Curry shrimp', price: '$18' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#a0673f', hair: '#2c1810', shirt: '#dc2626', accessory: 'none', body: 'fem', hairStyle: 'bun', eyes: '#1a0f08', pants: '#1e293b', shoes: '#0f172a', background: '#fee2e2' }
  },
  {
    uid: 'demo-buf-004',
    displayName: 'Camille R.',
    lat: 42.9032, lng: -78.8740, // Elmwood Village
    neighborhood: 'Elmwood Village',
    storefront: {
      kind: 'service',
      name: 'Camille Heals',
      category: 'Wellness · Massage',
      tagline: 'Deep tissue + prenatal massage, by appointment.',
      bio: 'NYS-licensed LMT working out of a private suite on Elmwood. Sliding scale available for full-time students.',
      serviceArea: 'Elmwood Village · Delaware Park',
      offers: 'Squadmate bundle: book 3 sessions, get $30 off.',
      instagram: 'camilleheals',
      items: [
        { name: '60-min deep tissue', price: '$95' },
        { name: '90-min full body', price: '$135' },
        { name: 'Prenatal massage', price: '$110' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#e8b88a', hair: '#6b3f1d', shirt: '#10b981', accessory: 'none', body: 'fem', hairStyle: 'ponytail', eyes: '#3b2417', pants: '#1e293b', shoes: '#f3f4f6', background: '#d1fae5' }
  },
  {
    uid: 'demo-buf-005',
    displayName: 'Briana W.',
    lat: 42.8753, lng: -78.8197, // South Buffalo
    neighborhood: 'South Buffalo',
    storefront: {
      kind: 'service',
      name: 'Bri\u2019s Babysitting Co.',
      category: 'Childcare · Sitting',
      tagline: 'CPR-certified, references on request.',
      bio: 'Date-night and weekend sitter for ages 1\u20139. Background-checked, comfortable with multiple kids and pets.',
      serviceArea: 'South Buffalo · Lackawanna',
      offers: 'Recurring weekly bookings = $5/hr discount.',
      instagram: 'brissitting',
      items: [
        { name: 'Date-night sitting', price: '$20/hr' },
        { name: 'Overnight sitting', price: '$160/night' },
        { name: 'School pickup + care', price: '$18/hr' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#f1c27d', hair: '#dab676', shirt: '#0ea5e9', accessory: 'none', body: 'fem', hairStyle: 'long', eyes: '#1e3a8a', pants: '#0f172a', shoes: '#7c3aed', background: '#dbeafe' }
  },
  {
    uid: 'demo-buf-006',
    displayName: 'Imani K.',
    lat: 42.9087, lng: -78.8453, // Fillmore / Masten
    neighborhood: 'Masten',
    storefront: {
      kind: 'creator',
      name: 'Imani Inks',
      category: 'Art · Tattoo',
      tagline: 'Fine-line and script tattoos by appointment.',
      bio: 'Resident artist at a private studio off Jefferson. Black + grey, color, and cover-ups. Custom flash drops every month.',
      serviceArea: 'Masten · Downtown',
      offers: 'Free touch-up within 30 days for squadmates.',
      instagram: 'imaniinks',
      items: [
        { name: 'Small fine-line', price: '$120+' },
        { name: 'Script / lettering', price: '$150+' },
        { name: 'Flash piece', price: '$180' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#704a2a', hair: '#0f0a06', shirt: '#7c3aed', accessory: 'glasses', body: 'fem', hairStyle: 'short', eyes: '#1a0f08', pants: '#0f172a', shoes: '#0f172a', background: '#ede9fe' }
  },
  {
    uid: 'demo-buf-007',
    displayName: 'Destiny F.',
    lat: 42.9281, lng: -78.8782, // Black Rock
    neighborhood: 'Black Rock',
    storefront: {
      kind: 'service',
      name: 'Nailed by Des',
      category: 'Beauty · Nails',
      tagline: 'Gel-X sets, chrome, and 3D nail art.',
      bio: 'Home studio with bookings Tues\u2013Sat. Designs uploaded weekly to IG. Walk-ins by request only.',
      serviceArea: 'Black Rock · Riverside',
      offers: 'First Gel-X set: 15% off when you mention Squad REN.',
      instagram: 'nailedbydes',
      items: [
        { name: 'Gel-X full set', price: '$75' },
        { name: 'Chrome / cat-eye', price: '+$10' },
        { name: '3D nail art (per finger)', price: '$5' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#d4a373', hair: '#c2185b', shirt: '#f43f5e', accessory: 'none', body: 'fem', hairStyle: 'long', eyes: '#3b2417', pants: '#1e293b', shoes: '#f3f4f6', background: '#fce7f3' }
  },
  {
    uid: 'demo-buf-008',
    displayName: 'Nyla H.',
    lat: 42.8967, lng: -78.8489, // Cobblestone / Downtown
    neighborhood: 'Downtown',
    storefront: {
      kind: 'service',
      name: 'Brows by Nyla',
      category: 'Beauty · Brows',
      tagline: 'Microblading, lamination, tints.',
      bio: 'Certified PMU artist working out of a downtown shared suite. Free 6-week touch-up with every new microblading service.',
      serviceArea: 'Downtown · Larkinville',
      offers: 'Refer a friend: $25 off your next service.',
      instagram: 'browsbynyla',
      items: [
        { name: 'Microblading session', price: '$320' },
        { name: 'Brow lamination', price: '$60' },
        { name: 'Brow tint + shape', price: '$35' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#ad7e54', hair: '#3b2417', shirt: '#f97316', accessory: 'none', body: 'fem', hairStyle: 'bun', eyes: '#3b2417', pants: '#0f172a', shoes: '#0f172a', background: '#ffedd5' }
  },
  {
    uid: 'demo-buf-009',
    displayName: 'Tiana G.',
    lat: 42.9145, lng: -78.8197, // University Heights
    neighborhood: 'University Heights',
    storefront: {
      kind: 'business',
      name: 'Cakes by Tee',
      category: 'Food · Bakery',
      tagline: 'Custom cakes, cupcakes, and dessert tables.',
      bio: 'Home baker near UB South. Birthday, baby shower, and wedding orders booked 2 weeks out.',
      serviceArea: 'University Heights · Amherst',
      offers: 'Free dozen mini cupcakes with any tiered cake order.',
      instagram: 'cakesbytee_buf',
      items: [
        { name: '6-inch custom cake', price: '$55+' },
        { name: 'Cupcake dozen', price: '$36' },
        { name: 'Dessert table package', price: '$220+' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#b9805a', hair: '#2c1810', shirt: '#eab308', accessory: 'none', body: 'fem', hairStyle: 'curly', eyes: '#3b2417', pants: '#1e293b', shoes: '#f3f4f6', background: '#fef9c3' }
  },
  {
    uid: 'demo-buf-010',
    displayName: 'Simone A.',
    lat: 42.8829, lng: -78.8729, // Lower West / Connecticut St
    neighborhood: 'Lower West Side',
    storefront: {
      kind: 'creator',
      name: 'Simone Trains',
      category: 'Fitness · Personal Trainer',
      tagline: 'Strength training and bootcamps in the park.',
      bio: 'NASM-certified trainer running 1:1 sessions and Saturday bootcamps in Front Park. New-client consultation always free.',
      serviceArea: 'Lower West · Front Park',
      offers: 'Bring a squadmate: both sessions $10 off.',
      instagram: 'simonetrains',
      items: [
        { name: '1:1 60-min session', price: '$65' },
        { name: 'Saturday bootcamp', price: '$15' },
        { name: '4-pack training', price: '$220' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#a0673f', hair: '#3b2417', shirt: '#22c55e', accessory: 'none', body: 'fem', hairStyle: 'ponytail', eyes: '#1a0f08', pants: '#0f172a', shoes: '#f3f4f6', background: '#dcfce7' }
  }
];

const now = () => Date.now();
const recentLastSeen = (i: number) => now() - ((i * 17_000) % 90_000); // staggered within last 90s so all read as "fresh"

// Public presence entries — these surface on the world map as amber
// storefront pins because they all have storefront.visibility === 'public'.
export function buffaloDemoPresence(): Presence[] {
  return SEED.map((u, i) => ({
    uid: u.uid,
    displayName: u.displayName,
    avatar: u.avatar,
    lat: u.lat,
    lng: u.lng,
    placeName: u.neighborhood + ', Buffalo',
    squadIds: [BUFFALO_DEMO_SQUAD_ID],
    shareLocation: true,
    sharePublic: true,
    storefront: u.storefront,
    xp: 400 + i * 220, // varied prestige across the squad
    updatedAt: recentLastSeen(i)
  }));
}

// Active-user heartbeats so these demos count toward "Squadders online"
// and the live-squad pill platform-wide. lastSeenMs is always kept fresh
// inside the ACTIVE_WINDOW (2 min) — `watchActiveUsers` callers can poll
// this fn for fresh stamps every refresh.
export function buffaloDemoActiveUsers(): ActiveUser[] {
  return SEED.map((u, i) => ({
    uid: u.uid,
    displayName: u.displayName,
    lat: u.lat,
    lng: u.lng,
    squadCount: 1,
    squadIds: [BUFFALO_DEMO_SQUAD_ID],
    lastSeenMs: recentLastSeen(i)
  }));
}

// The squad these demo users belong to. Surfaced in watchPublicSquadsLive
// so the squad shows up on the leaderboard / public-squad layer.
export function buffaloDemoSquad(): Squad & { lat: number; lng: number; city: string; country: string } {
  return {
    id: BUFFALO_DEMO_SQUAD_ID,
    name: 'Buffalo Queens Collective',
    ownerId: SEED[0].uid,
    members: SEED.map(s => s.uid),
    visibility: 'public',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 180, // ~6 months old
    hq: { lat: 42.8975, lng: -78.8585, placeName: 'Allentown, Buffalo' },
    lat: 42.8975, lng: -78.8585,
    city: 'Buffalo', country: 'US'
  } as any;
}

// Convenience: stable UID set for filtering demos out elsewhere if needed.
export const BUFFALO_DEMO_UIDS = new Set(SEED.map(s => s.uid));
