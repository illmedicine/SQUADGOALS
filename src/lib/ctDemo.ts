// Connecticut showcase seed — 10 demo female squadders spread across the
// state's major hubs (Hartford, New Haven, Bridgeport, Stamford, Waterbury,
// New London, Norwalk, West Hartford, Danbury, Middletown). Same shape /
// behavior as the Buffalo showcase so new users see a second active local
// community out of the box.

import type { Presence, Squad } from './data';
import type { Storefront, AvatarConfig } from './AuthContext';
import type { ActiveUser } from './pulse';

export const CT_DEMO_SQUAD_ID = 'demo-ct-squad-coastal';

type SeedUser = {
  uid: string;
  displayName: string;
  lat: number;
  lng: number;
  neighborhood: string;
  storefront: Storefront;
  avatar: AvatarConfig;
};

const SEED: SeedUser[] = [
  {
    uid: 'demo-ct-001',
    displayName: 'Tanya M.',
    lat: 41.7637, lng: -72.6851, // Hartford — West End
    neighborhood: 'West End, Hartford',
    storefront: {
      kind: 'service',
      name: 'Lash Lab CT',
      category: 'Beauty · Lashes',
      tagline: 'Hybrid + volume sets, weekly fills.',
      bio: 'Private studio off Farmington Ave. Latex-free adhesives, weekend fills available by request.',
      serviceArea: 'Hartford · West Hartford',
      offers: '$15 off your first full set for any squadmate.',
      instagram: 'lashlabct',
      items: [
        { name: 'Classic full set', price: '$120' },
        { name: 'Hybrid full set', price: '$150' },
        { name: '2-week fill', price: '$70' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#c68b59', hair: '#1a0f08', shirt: '#ec4899', accessory: 'glasses', body: 'fem', hairStyle: 'long', eyes: '#3b2417', pants: '#1e293b', shoes: '#0f172a', background: '#fce7f3' }
  },
  {
    uid: 'demo-ct-002',
    displayName: 'Janelle O.',
    lat: 41.3083, lng: -72.9279, // New Haven — Westville
    neighborhood: 'Westville, New Haven',
    storefront: {
      kind: 'service',
      name: 'Locd by Nelle',
      category: 'Hair · Locs & Twists',
      tagline: 'Retwists, interlocking, starter locs.',
      bio: 'Booking Tues–Sat from a private loft studio. Specializing in microlocs and natural-product retwists.',
      serviceArea: 'New Haven · Hamden',
      offers: 'First retwist 15% off when you mention Squad REN.',
      instagram: 'locdbynelle',
      items: [
        { name: 'Loc retwist', price: '$85' },
        { name: 'Starter microlocs', price: '$260' },
        { name: 'Interlocking session', price: '$110' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#8d5524', hair: '#1a0f08', shirt: '#f59e0b', accessory: 'none', body: 'fem', hairStyle: 'curly', eyes: '#1a0f08', pants: '#0f172a', shoes: '#7c2d12', background: '#fef3c7' }
  },
  {
    uid: 'demo-ct-003',
    displayName: 'Yasmin C.',
    lat: 41.1865, lng: -73.1952, // Bridgeport — Black Rock
    neighborhood: 'Black Rock, Bridgeport',
    storefront: {
      kind: 'business',
      name: 'Yas Eats',
      category: 'Food · Caribbean',
      tagline: 'Empanadas, rice bowls, jerk plates.',
      bio: 'Pop-up kitchen out of a shared commissary. Pre-order via IG; pickup Friday–Sunday on Fairfield Ave.',
      serviceArea: 'Bridgeport · Fairfield',
      offers: 'Squad REN pin = free side of plantains.',
      instagram: 'yaseats_ct',
      items: [
        { name: 'Jerk chicken bowl', price: '$15' },
        { name: 'Beef empanadas (3)', price: '$10' },
        { name: 'Oxtail plate', price: '$24' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#a0673f', hair: '#2c1810', shirt: '#dc2626', accessory: 'none', body: 'fem', hairStyle: 'bun', eyes: '#1a0f08', pants: '#1e293b', shoes: '#0f172a', background: '#fee2e2' }
  },
  {
    uid: 'demo-ct-004',
    displayName: 'Rhea P.',
    lat: 41.0534, lng: -73.5387, // Stamford — Downtown
    neighborhood: 'Downtown, Stamford',
    storefront: {
      kind: 'service',
      name: 'Rhea Heals',
      category: 'Wellness · Massage',
      tagline: 'Deep tissue, prenatal, sports recovery.',
      bio: 'NYS + CT licensed LMT. Private suite on Atlantic St. Sliding scale for healthcare workers.',
      serviceArea: 'Stamford · Greenwich · Norwalk',
      offers: 'Book 3 sessions, get $40 off the bundle.',
      instagram: 'rheaheals',
      items: [
        { name: '60-min deep tissue', price: '$110' },
        { name: '90-min full body', price: '$155' },
        { name: 'Prenatal massage', price: '$120' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#e8b88a', hair: '#6b3f1d', shirt: '#10b981', accessory: 'none', body: 'fem', hairStyle: 'ponytail', eyes: '#3b2417', pants: '#1e293b', shoes: '#f3f4f6', background: '#d1fae5' }
  },
  {
    uid: 'demo-ct-005',
    displayName: 'Aisha D.',
    lat: 41.5582, lng: -73.0515, // Waterbury — Downtown
    neighborhood: 'Downtown, Waterbury',
    storefront: {
      kind: 'service',
      name: 'Aisha\u2019s Little Stars',
      category: 'Childcare · Sitting',
      tagline: 'CPR-certified, weekday + weekend sitting.',
      bio: 'In-home sitter for ages 0–10. Comfortable with twins, pets, and special diets. Background-checked.',
      serviceArea: 'Waterbury · Cheshire',
      offers: 'Recurring weekly bookings = $5/hr off.',
      instagram: 'aishaslittlestars',
      items: [
        { name: 'Date-night sitting', price: '$22/hr' },
        { name: 'Overnight sitting', price: '$170/night' },
        { name: 'After-school care', price: '$20/hr' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#f1c27d', hair: '#dab676', shirt: '#0ea5e9', accessory: 'none', body: 'fem', hairStyle: 'long', eyes: '#1e3a8a', pants: '#0f172a', shoes: '#7c3aed', background: '#dbeafe' }
  },
  {
    uid: 'demo-ct-006',
    displayName: 'Priya R.',
    lat: 41.3556, lng: -72.0995, // New London — Downtown
    neighborhood: 'Downtown, New London',
    storefront: {
      kind: 'creator',
      name: 'Priya Inks',
      category: 'Art · Tattoo',
      tagline: 'Fine-line botanical and script work.',
      bio: 'Resident artist at a private studio off Bank St. Black & grey specialist, custom flash drops monthly.',
      serviceArea: 'New London · Mystic · Groton',
      offers: 'Free 30-day touch-up for squadmates.',
      instagram: 'priyainks',
      items: [
        { name: 'Small fine-line', price: '$130+' },
        { name: 'Botanical piece', price: '$220+' },
        { name: 'Custom flash', price: '$180' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#704a2a', hair: '#0f0a06', shirt: '#7c3aed', accessory: 'glasses', body: 'fem', hairStyle: 'short', eyes: '#1a0f08', pants: '#0f172a', shoes: '#0f172a', background: '#ede9fe' }
  },
  {
    uid: 'demo-ct-007',
    displayName: 'Mikayla J.',
    lat: 41.1177, lng: -73.4082, // Norwalk — SoNo
    neighborhood: 'SoNo, Norwalk',
    storefront: {
      kind: 'service',
      name: 'Nailed by Mik',
      category: 'Beauty · Nails',
      tagline: 'Gel-X, chrome, French tips, 3D art.',
      bio: 'SoNo home studio. Weekday + Saturday availability. Designs posted weekly to IG; walk-ins by request.',
      serviceArea: 'Norwalk · Westport',
      offers: 'First Gel-X set 15% off with Squad REN.',
      instagram: 'nailedbymik',
      items: [
        { name: 'Gel-X full set', price: '$80' },
        { name: 'Chrome / cat-eye', price: '+$12' },
        { name: '3D nail art (per finger)', price: '$6' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#d4a373', hair: '#c2185b', shirt: '#f43f5e', accessory: 'none', body: 'fem', hairStyle: 'long', eyes: '#3b2417', pants: '#1e293b', shoes: '#f3f4f6', background: '#fce7f3' }
  },
  {
    uid: 'demo-ct-008',
    displayName: 'Selena V.',
    lat: 41.7621, lng: -72.7420, // West Hartford — Center
    neighborhood: 'WeHa Center, West Hartford',
    storefront: {
      kind: 'service',
      name: 'Brows by Sel',
      category: 'Beauty · Brows',
      tagline: 'Microblading, lamination, tints.',
      bio: 'Certified PMU artist in a private suite off Farmington Ave. Free 6-week touch-up with every new microblading service.',
      serviceArea: 'West Hartford · Bloomfield',
      offers: 'Refer a friend: $30 off your next service.',
      instagram: 'browsbysel',
      items: [
        { name: 'Microblading session', price: '$340' },
        { name: 'Brow lamination', price: '$65' },
        { name: 'Brow tint + shape', price: '$38' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#ad7e54', hair: '#3b2417', shirt: '#f97316', accessory: 'none', body: 'fem', hairStyle: 'bun', eyes: '#3b2417', pants: '#0f172a', shoes: '#0f172a', background: '#ffedd5' }
  },
  {
    uid: 'demo-ct-009',
    displayName: 'Brielle N.',
    lat: 41.3948, lng: -73.4540, // Danbury — Downtown
    neighborhood: 'Downtown, Danbury',
    storefront: {
      kind: 'business',
      name: 'Bri\u2019s Bakehouse',
      category: 'Food · Bakery',
      tagline: 'Custom cakes, cupcakes, dessert tables.',
      bio: 'Home baker. Birthday, baby shower, and wedding orders booked 2 weeks out. Pickup in Danbury or delivery within 15 mi.',
      serviceArea: 'Danbury · Bethel · Newtown',
      offers: 'Free mini-cupcake dozen with any tiered cake.',
      instagram: 'brisbakehouse',
      items: [
        { name: '6-inch custom cake', price: '$60+' },
        { name: 'Cupcake dozen', price: '$40' },
        { name: 'Dessert table pkg', price: '$240+' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#b9805a', hair: '#2c1810', shirt: '#eab308', accessory: 'none', body: 'fem', hairStyle: 'curly', eyes: '#3b2417', pants: '#1e293b', shoes: '#f3f4f6', background: '#fef9c3' }
  },
  {
    uid: 'demo-ct-010',
    displayName: 'Jordyn S.',
    lat: 41.5623, lng: -72.6506, // Middletown — Downtown
    neighborhood: 'Downtown, Middletown',
    storefront: {
      kind: 'creator',
      name: 'Train w/ Jordy',
      category: 'Fitness · Personal Trainer',
      tagline: 'Strength training, mobility, park bootcamps.',
      bio: 'NASM-certified trainer. 1:1 and small-group sessions in Wadsworth Park; first consult always free.',
      serviceArea: 'Middletown · Cromwell',
      offers: 'Bring a squadmate: both sessions $10 off.',
      instagram: 'trainwjordy',
      items: [
        { name: '1:1 60-min session', price: '$70' },
        { name: 'Saturday bootcamp', price: '$18' },
        { name: '4-pack training', price: '$240' }
      ],
      visibility: 'public',
      updatedAt: Date.now()
    },
    avatar: { skin: '#a0673f', hair: '#3b2417', shirt: '#22c55e', accessory: 'none', body: 'fem', hairStyle: 'ponytail', eyes: '#1a0f08', pants: '#0f172a', shoes: '#f3f4f6', background: '#dcfce7' }
  }
];

const recentLastSeen = (i: number) => Date.now() - ((i * 19_000) % 90_000);

export function ctDemoPresence(): Presence[] {
  return SEED.map((u, i) => ({
    uid: u.uid,
    displayName: u.displayName,
    avatar: u.avatar,
    lat: u.lat,
    lng: u.lng,
    placeName: u.neighborhood,
    squadIds: [CT_DEMO_SQUAD_ID],
    shareLocation: true,
    sharePublic: true,
    storefront: u.storefront,
    xp: 350 + i * 240,
    updatedAt: recentLastSeen(i)
  }));
}

export function ctDemoActiveUsers(): ActiveUser[] {
  return SEED.map((u, i) => ({
    uid: u.uid,
    displayName: u.displayName,
    avatar: u.avatar,
    lat: u.lat,
    lng: u.lng,
    squadCount: 1,
    squadIds: [CT_DEMO_SQUAD_ID],
    lastSeenMs: recentLastSeen(i)
  }));
}

export function ctDemoSquad(): Squad & { lat: number; lng: number; city: string; country: string } {
  return {
    id: CT_DEMO_SQUAD_ID,
    name: 'Connecticut Coastal Collective',
    ownerId: SEED[0].uid,
    members: SEED.map(s => s.uid),
    visibility: 'public',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 150,
    hq: { lat: 41.7637, lng: -72.6851, placeName: 'Hartford, CT' },
    lat: 41.7637, lng: -72.6851,
    city: 'Hartford', country: 'US'
  } as any;
}

export const CT_DEMO_UIDS = new Set(SEED.map(s => s.uid));
