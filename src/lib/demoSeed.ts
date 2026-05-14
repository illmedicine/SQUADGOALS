// Deterministic demo dataset that paints a clear picture of what Squad REN
// looks like at scale: 1,000 squads spread across the world's biggest cities,
// each with members, public pins, check-ins, comments, and prestige stats.
//
// This data is generated client-side (no Firestore writes) so prototype
// testers see a populated world without us shipping millions of docs. It is
// merged into the live watchers alongside real data.

import type { Squad, Presence, VisitedPlace } from './data';
import type { PublicPin, PinComment } from './publicPins';
import { tierForXp } from './prestige';

// ---------- Top 50 metropolitan areas (lat, lng, country) ----------
const CITIES: { name: string; lat: number; lng: number; country: string }[] = [
  { name: 'Tokyo',            lat: 35.6762,  lng: 139.6503,  country: 'JP' },
  { name: 'Delhi',            lat: 28.7041,  lng: 77.1025,   country: 'IN' },
  { name: 'Shanghai',         lat: 31.2304,  lng: 121.4737,  country: 'CN' },
  { name: 'São Paulo',        lat: -23.5505, lng: -46.6333,  country: 'BR' },
  { name: 'Mexico City',      lat: 19.4326,  lng: -99.1332,  country: 'MX' },
  { name: 'Cairo',            lat: 30.0444,  lng: 31.2357,   country: 'EG' },
  { name: 'Mumbai',           lat: 19.0760,  lng: 72.8777,   country: 'IN' },
  { name: 'Beijing',          lat: 39.9042,  lng: 116.4074,  country: 'CN' },
  { name: 'Dhaka',            lat: 23.8103,  lng: 90.4125,   country: 'BD' },
  { name: 'Osaka',            lat: 34.6937,  lng: 135.5023,  country: 'JP' },
  { name: 'New York',         lat: 40.7128,  lng: -74.0060,  country: 'US' },
  { name: 'Karachi',          lat: 24.8607,  lng: 67.0011,   country: 'PK' },
  { name: 'Buenos Aires',     lat: -34.6037, lng: -58.3816,  country: 'AR' },
  { name: 'Chongqing',        lat: 29.4316,  lng: 106.9123,  country: 'CN' },
  { name: 'Istanbul',         lat: 41.0082,  lng: 28.9784,   country: 'TR' },
  { name: 'Kolkata',          lat: 22.5726,  lng: 88.3639,   country: 'IN' },
  { name: 'Manila',           lat: 14.5995,  lng: 120.9842,  country: 'PH' },
  { name: 'Lagos',            lat: 6.5244,   lng: 3.3792,    country: 'NG' },
  { name: 'Rio de Janeiro',   lat: -22.9068, lng: -43.1729,  country: 'BR' },
  { name: 'Tianjin',          lat: 39.3434,  lng: 117.3616,  country: 'CN' },
  { name: 'Guangzhou',        lat: 23.1291,  lng: 113.2644,  country: 'CN' },
  { name: 'Moscow',           lat: 55.7558,  lng: 37.6173,   country: 'RU' },
  { name: 'Lahore',           lat: 31.5204,  lng: 74.3587,   country: 'PK' },
  { name: 'Shenzhen',         lat: 22.5431,  lng: 114.0579,  country: 'CN' },
  { name: 'Bangalore',        lat: 12.9716,  lng: 77.5946,   country: 'IN' },
  { name: 'Paris',            lat: 48.8566,  lng: 2.3522,    country: 'FR' },
  { name: 'Bogotá',           lat: 4.7110,   lng: -74.0721,  country: 'CO' },
  { name: 'Jakarta',          lat: -6.2088,  lng: 106.8456,  country: 'ID' },
  { name: 'Chennai',          lat: 13.0827,  lng: 80.2707,   country: 'IN' },
  { name: 'Lima',             lat: -12.0464, lng: -77.0428,  country: 'PE' },
  { name: 'Bangkok',          lat: 13.7563,  lng: 100.5018,  country: 'TH' },
  { name: 'Seoul',            lat: 37.5665,  lng: 126.9780,  country: 'KR' },
  { name: 'Nagoya',           lat: 35.1815,  lng: 136.9066,  country: 'JP' },
  { name: 'Hyderabad',        lat: 17.3850,  lng: 78.4867,   country: 'IN' },
  { name: 'London',           lat: 51.5074,  lng: -0.1278,   country: 'GB' },
  { name: 'Tehran',           lat: 35.6892,  lng: 51.3890,   country: 'IR' },
  { name: 'Chicago',          lat: 41.8781,  lng: -87.6298,  country: 'US' },
  { name: 'Chengdu',          lat: 30.5728,  lng: 104.0668,  country: 'CN' },
  { name: 'Nanjing',          lat: 32.0603,  lng: 118.7969,  country: 'CN' },
  { name: 'Wuhan',            lat: 30.5928,  lng: 114.3055,  country: 'CN' },
  { name: 'Ho Chi Minh City', lat: 10.8231,  lng: 106.6297,  country: 'VN' },
  { name: 'Luanda',           lat: -8.8390,  lng: 13.2894,   country: 'AO' },
  { name: 'Ahmedabad',        lat: 23.0225,  lng: 72.5714,   country: 'IN' },
  { name: 'Kuala Lumpur',     lat: 3.1390,   lng: 101.6869,  country: 'MY' },
  { name: 'Hong Kong',        lat: 22.3193,  lng: 114.1694,  country: 'HK' },
  { name: 'Riyadh',           lat: 24.7136,  lng: 46.6753,   country: 'SA' },
  { name: 'Baghdad',          lat: 33.3152,  lng: 44.3661,   country: 'IQ' },
  { name: 'Santiago',         lat: -33.4489, lng: -70.6693,  country: 'CL' },
  { name: 'Madrid',           lat: 40.4168,  lng: -3.7038,   country: 'ES' },
  { name: 'Toronto',          lat: 43.6532,  lng: -79.3832,  country: 'CA' },
  { name: 'Singapore',        lat: 1.3521,   lng: 103.8198,  country: 'SG' },
  { name: 'Los Angeles',      lat: 34.0522,  lng: -118.2437, country: 'US' },
  { name: 'Sydney',           lat: -33.8688, lng: 151.2093,  country: 'AU' },
  { name: 'Berlin',           lat: 52.5200,  lng: 13.4050,   country: 'DE' },
  { name: 'Rome',             lat: 41.9028,  lng: 12.4964,   country: 'IT' },
  { name: 'Cape Town',        lat: -33.9249, lng: 18.4241,   country: 'ZA' }
];

// ---------- Deterministic RNG (mulberry32) ----------
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(rng: () => number, arr: T[]) => arr[Math.floor(rng() * arr.length)];

// ---------- Word banks ----------
const SQUAD_PREFIX = [
  'Neon','Midnight','Sunset','Golden','Cosmic','Velvet','Crystal','Wild','Ember',
  'Lunar','Solar','Mystic','Electric','Polar','Iron','Silver','Royal','Phantom',
  'Quantum','Stellar','Crimson','Jade','Glacier','Pixel','Echo','Aurora','Nimbus',
  'Rogue','Vortex','Zenith'
];
const SQUAD_SUFFIX = [
  'Foxes','Tigers','Owls','Wolves','Dragons','Whales','Comets','Sharks','Eagles',
  'Hawks','Bears','Lions','Pandas','Otters','Crew','Collective','Society','Club',
  'Riders','Gang','Hunters','Travellers','Pilots','Crusaders','Nomads','Mavericks',
  'Sentinels','Voyagers','Vibe','Coalition'
];
const FIRST_NAMES = [
  'Alex','Sam','Jordan','Taylor','Casey','Riley','Quinn','Avery','Hayden','Reese',
  'Jamie','Skyler','Drew','Morgan','Cameron','Phoenix','River','Sage','Rowan','Emerson',
  'Maya','Liam','Noah','Olivia','Emma','Aria','Kai','Zara','Leo','Mila',
  'Yuki','Ren','Hiro','Mei','Sora','Aiko','Niko','Luna','Theo','Iris',
  'Diego','Carmen','Mateo','Sofia','Lucas','Camila','Isabela','Bruno','Valeria','Marco'
];
const LAST_NAMES = [
  'Park','Kim','Chen','Lee','Patel','Singh','Garcia','Lopez','Silva','Costa',
  'Sato','Tanaka','Yamamoto','Schmidt','Müller','Rossi','Romano','Dubois','Martin','Bernard',
  'Hassan','Khan','Ali','Said','Okafor','Adebayo','Nguyen','Tran','Lim','Wong',
  'Sullivan','Walker','Wright','Reed','Bailey','Cooper','Bennett','Hayes','Brooks','Foster'
];
const PLACE_TEMPLATES = [
  ['Coffee',   ['Roast House','Coffee Bar','Espresso Lab','Brew & Co','Café','Beans','Caffeine Club','Morning Pour']],
  ['Food',     ['Kitchen','Eatery','Diner','Bistro','Street Food','Bowl Bar','Noodle House','Grill']],
  ['Bar',      ['Tavern','Pub','Rooftop','Lounge','Cocktail Room','Speakeasy','Beer Garden','Wine Bar']],
  ['Venue',    ['Theater','Live Stage','Music Hall','Arena','Amphitheater','Club','Studio','Gallery']],
  ['Park',     ['Park','Gardens','Green','Riverwalk','Bay Promenade','Trail Head','Botanical Park','Forest Path']],
  ['Shopping', ['Market','Bazaar','Mall','Boutique','Vintage Shop','Bookstore','Concept Store','Pop-up']],
  ['Work',     ['Coworking','Hub','Office Lounge','Maker Space','Studio Space','Library','Tech Hub','Innovation Lab']],
  ['Other',    ['Lookout','Overlook','Pier','Plaza','Square','Bridge View','Sunset Point','Old Town']]
] as const;
const COMMENT_TEMPLATES = [
  'Amazing vibes here! Definitely coming back.',
  'A little crowded on weekends but worth it.',
  'Best spot in the neighborhood.',
  'Solid place to meet up with the squad.',
  'Loved the atmosphere — staff was super friendly.',
  'Hidden gem. Tell your friends.',
  'Five stars no notes.',
  'Came for the views, stayed for the snacks.',
  'Decent but pricey for what it is.',
  'My new favorite hang.',
  'Felt like a movie scene at golden hour.',
  'Bring a jacket — it gets cold at night.',
  'Music was on point all evening.',
  'Drinks > food but still good overall.',
  'Squad approved. 10/10 would return.',
  'If you know, you know.',
  'Tucked away but easy to find on the app.',
  'Felt like home from the moment we walked in.'
];

// ---------- Public API ----------
let _cache: ReturnType<typeof build> | null = null;
function ensure() { if (!_cache) _cache = build(); return _cache; }

export function demoSquads(): (Squad & { lat: number; lng: number; city: string; country: string; stats: SquadStats })[] {
  return ensure().squads;
}
export function demoPublicPins(): PublicPin[] { return ensure().pins; }
export function demoPublicPresence(): Presence[] { return ensure().presence; }
export function demoVisitedPlaces(): VisitedPlace[] { return ensure().visits; }
export function demoPinComments(): Record<string, PinComment[]> { return ensure().comments; }

export type SquadStats = {
  members: number;
  pins: number;
  checkIns: number;
  reviews: number;
  totalXp: number;
  ageDays: number;
};

// Translates a squad's combined activity into a single 0..6 prestige tier
// used for the badge color/icon on the map.
export function squadPrestige(s: SquadStats) {
  return tierForXp(s.totalXp);
}

// ---------- Builder ----------
function build() {
  const rng = makeRng(20260514);

  // Generate ~20 squads per city * 50 cities = 1000 squads.
  const squads: (Squad & { lat: number; lng: number; city: string; country: string; stats: SquadStats })[] = [];
  const presence: Presence[] = [];
  const pins: PublicPin[] = [];
  const visits: VisitedPlace[] = [];
  const comments: Record<string, PinComment[]> = {};

  const now = Date.now();
  let squadCounter = 0;
  let userCounter = 0;
  let pinCounter = 0;

  for (const city of CITIES) {
    for (let i = 0; i < 20; i++) {
      const sid = 'demo-sq-' + (squadCounter++);
      const memberCount = 4 + Math.floor(rng() * 97); // 4..100
      const ageDays = 1 + Math.floor(rng() * 1095);   // 1..1095 days
      const createdAt = now - ageDays * 86400_000;
      const name = pick(rng, SQUAD_PREFIX) + ' ' + pick(rng, SQUAD_SUFFIX);

      // City center with ~25km jitter for the squad's "home base".
      const center = jitter(rng, city.lat, city.lng, 0.25);

      // Members & their public-share status.
      const members: string[] = [];
      const sharingMembers: { uid: string; name: string }[] = [];
      for (let m = 0; m < memberCount; m++) {
        const uid = 'demo-u-' + (userCounter++);
        members.push(uid);
        if (rng() < 0.18) sharingMembers.push({ uid, name: demoName(rng) });
      }

      // Stats scale roughly with member count and squad age (older + bigger = more prestige).
      const ageBoost = Math.min(3, ageDays / 365);
      const pinCount   = Math.floor(memberCount * 0.3 + ageBoost * 4);
      const checkIns   = Math.floor(memberCount * 1.5 + ageBoost * 12);
      const reviewCnt  = Math.floor(memberCount * 0.4 + ageBoost * 3);
      const totalXp    = pinCount * 25 + checkIns * 10 + reviewCnt * 8;

      const stats: SquadStats = { members: memberCount, pins: pinCount, checkIns, reviews: reviewCnt, totalXp, ageDays };

      squads.push({
        id: sid, name,
        ownerId: members[0],
        members,
        visibility: 'public',
        createdAt,
        lat: center.lat, lng: center.lng,
        city: city.name, country: city.country,
        stats
      });

      // Live presence for members who are publicly sharing right now.
      for (const sm of sharingMembers) {
        const p = jitter(rng, center.lat, center.lng, 0.12);
        presence.push({
          uid: sm.uid,
          displayName: sm.name,
          lat: p.lat, lng: p.lng,
          placeName: city.name,
          squadIds: [sid],
          shareLocation: true,
          sharePublic: true,
          updatedAt: now - Math.floor(rng() * 600_000)
        });
      }

      // Public pins authored by squad members, scattered around the city.
      const squadPinCount = Math.min(pinCount, 3); // cap rendered pins per squad
      for (let p = 0; p < squadPinCount; p++) {
        const author = members[Math.floor(rng() * members.length)];
        const authorName = demoName(rng);
        const cat = pick(rng, PLACE_TEMPLATES as any) as readonly [string, readonly string[]];
        const placeName = city.name + ' ' + pick(rng, [...cat[1]]);
        const pinPos = jitter(rng, center.lat, center.lng, 0.20);
        const rating = 3 + Math.floor(rng() * 3); // 3..5 mostly positive
        const pid = 'demo-pp-' + (pinCounter++);

        pins.push({
          id: pid,
          uid: author,
          displayName: authorName,
          placeName,
          category: cat[0],
          comment: pick(rng, COMMENT_TEMPLATES),
          rating,
          lat: pinPos.lat, lng: pinPos.lng,
          createdAt: now - Math.floor(rng() * ageDays * 86400_000),
          visibility: 'public',
          squadIds: [sid],
          commentCount: 0,
          avgRating: rating,
          reviewCount: 1
        });

        // 0–4 demo comments per pin, with the first one mirroring the pin's rating.
        const cCount = Math.floor(rng() * 5);
        if (cCount > 0) {
          const list: PinComment[] = [];
          for (let c = 0; c < cCount; c++) {
            const cr = rng() < 0.7 ? 3 + Math.floor(rng() * 3) : 0;
            list.push({
              id: 'demo-c-' + pid + '-' + c,
              uid: 'demo-u-' + Math.floor(rng() * 100000),
              displayName: demoName(rng),
              text: pick(rng, COMMENT_TEMPLATES),
              rating: cr,
              createdAt: now - Math.floor(rng() * 30 * 86400_000)
            });
          }
          comments[pid] = list;
          const reviews = list.filter(c => c.rating > 0);
          const ratings = [rating, ...reviews.map(r => r.rating)];
          pins[pins.length - 1].commentCount = list.length;
          pins[pins.length - 1].reviewCount = ratings.length;
          pins[pins.length - 1].avgRating = ratings.reduce((s, r) => s + r, 0) / ratings.length;
        }

        // Each public pin doubles as a public check-in for the heat map.
        visits.push({
          uid: author,
          displayName: authorName,
          placeName,
          category: cat[0],
          lat: pinPos.lat, lng: pinPos.lng,
          visitedAt: now - Math.floor(rng() * ageDays * 86400_000)
        });
      }
    }
  }

  return { squads, presence, pins, visits, comments };
}

function jitter(rng: () => number, lat: number, lng: number, deg: number) {
  return {
    lat: lat + (rng() - 0.5) * deg * 2,
    lng: lng + (rng() - 0.5) * deg * 2
  };
}
function demoName(rng: () => number) {
  return pick(rng, FIRST_NAMES) + ' ' + pick(rng, LAST_NAMES).charAt(0) + '.';
}
