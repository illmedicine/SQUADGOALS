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

// ---------- Top 50 metropolitan areas ----------
// Each city carries a small list of **land anchor points** (real
// neighborhoods/landmarks) so demo pins cluster near actual places rather
// than spilling into lakes, rivers, or the ocean. Coastal cities (Toronto,
// Sydney, Cape Town, NYC, etc.) get extra inland anchors to prevent the
// "pins floating in the water" problem.
type City = {
  name: string;
  lat: number;            // map center / fallback anchor
  lng: number;
  country: string;
  anchors?: [number, number][]; // [lat, lng] neighborhood centers on land
};
const CITIES: City[] = [
  { name: 'Tokyo',            lat: 35.6762,  lng: 139.6503,  country: 'JP',
    anchors: [[35.6586, 139.7454],[35.6938, 139.7036],[35.6595, 139.7005],[35.6284, 139.7387],[35.7295, 139.7109],[35.6712, 139.7639]] },
  { name: 'Delhi',            lat: 28.7041,  lng: 77.1025,   country: 'IN',
    anchors: [[28.6139, 77.2090],[28.5535, 77.2588],[28.6692, 77.4538],[28.5244, 77.1855]] },
  { name: 'Shanghai',         lat: 31.2304,  lng: 121.4737,  country: 'CN',
    anchors: [[31.2243, 121.4759],[31.2389, 121.4994],[31.2008, 121.4365],[31.2540, 121.4737]] },
  { name: 'São Paulo',        lat: -23.5505, lng: -46.6333,  country: 'BR',
    anchors: [[-23.5505, -46.6333],[-23.5613, -46.6566],[-23.5870, -46.6573],[-23.5320, -46.6390]] },
  { name: 'Mexico City',      lat: 19.4326,  lng: -99.1332,  country: 'MX',
    anchors: [[19.4326, -99.1332],[19.4284, -99.1677],[19.3911, -99.2837],[19.3656, -99.1714]] },
  { name: 'Cairo',            lat: 30.0444,  lng: 31.2357,   country: 'EG',
    anchors: [[30.0444, 31.2357],[30.0626, 31.2497],[30.0271, 31.2105],[30.0626, 31.2197]] },
  { name: 'Mumbai',           lat: 19.0760,  lng: 72.8777,   country: 'IN',
    anchors: [[19.0760, 72.8777],[19.1136, 72.8697],[18.9388, 72.8354],[19.0596, 72.8295]] },
  { name: 'Beijing',          lat: 39.9042,  lng: 116.4074,  country: 'CN',
    anchors: [[39.9042, 116.4074],[39.9163, 116.4470],[39.9925, 116.3262],[39.8782, 116.4257]] },
  { name: 'Dhaka',            lat: 23.8103,  lng: 90.4125,   country: 'BD',
    anchors: [[23.8103, 90.4125],[23.7806, 90.4070],[23.7561, 90.3872]] },
  { name: 'Osaka',            lat: 34.6937,  lng: 135.5023,  country: 'JP',
    anchors: [[34.6937, 135.5023],[34.7025, 135.4959],[34.6655, 135.4382],[34.7099, 135.5117]] },
  { name: 'New York',         lat: 40.7128,  lng: -74.0060,  country: 'US',
    anchors: [[40.7589, -73.9851],[40.7831, -73.9712],[40.6782, -73.9442],[40.7282, -73.7949],[40.8448, -73.8648]] },
  { name: 'Karachi',          lat: 24.8607,  lng: 67.0011,   country: 'PK',
    anchors: [[24.8607, 67.0011],[24.9056, 67.0822],[24.8138, 67.0299]] },
  { name: 'Buenos Aires',     lat: -34.6037, lng: -58.3816,  country: 'AR',
    anchors: [[-34.6037, -58.3816],[-34.5875, -58.3974],[-34.6158, -58.4333],[-34.5708, -58.4233]] },
  { name: 'Chongqing',        lat: 29.4316,  lng: 106.9123,  country: 'CN',
    anchors: [[29.5630, 106.5516],[29.5447, 106.5489],[29.5916, 106.6043]] },
  { name: 'Istanbul',         lat: 41.0082,  lng: 28.9784,   country: 'TR',
    anchors: [[41.0082, 28.9784],[41.0369, 28.9858],[41.0498, 29.0299],[40.9923, 29.0273]] },
  { name: 'Kolkata',          lat: 22.5726,  lng: 88.3639,   country: 'IN',
    anchors: [[22.5726, 88.3639],[22.5448, 88.3426],[22.5958, 88.3996]] },
  { name: 'Manila',           lat: 14.5995,  lng: 120.9842,  country: 'PH',
    anchors: [[14.5995, 120.9842],[14.5547, 121.0244],[14.6760, 121.0437]] },
  { name: 'Lagos',            lat: 6.5244,   lng: 3.3792,    country: 'NG',
    anchors: [[6.5244, 3.3792],[6.4474, 3.3903],[6.6018, 3.3515]] },
  { name: 'Rio de Janeiro',   lat: -22.9068, lng: -43.1729,  country: 'BR',
    anchors: [[-22.9068, -43.1729],[-22.9711, -43.1822],[-22.9519, -43.2105],[-22.8305, -43.2192]] },
  { name: 'Tianjin',          lat: 39.3434,  lng: 117.3616,  country: 'CN',
    anchors: [[39.0851, 117.2009],[39.1336, 117.2050]] },
  { name: 'Guangzhou',        lat: 23.1291,  lng: 113.2644,  country: 'CN',
    anchors: [[23.1291, 113.2644],[23.1378, 113.3185],[23.1066, 113.3239]] },
  { name: 'Moscow',           lat: 55.7558,  lng: 37.6173,   country: 'RU',
    anchors: [[55.7558, 37.6173],[55.7520, 37.6175],[55.7308, 37.6113],[55.7980, 37.5377]] },
  { name: 'Lahore',           lat: 31.5204,  lng: 74.3587,   country: 'PK',
    anchors: [[31.5204, 74.3587],[31.5497, 74.3436]] },
  { name: 'Shenzhen',         lat: 22.5431,  lng: 114.0579,  country: 'CN',
    anchors: [[22.5431, 114.0579],[22.5455, 114.0683],[22.6088, 113.9985]] },
  { name: 'Bangalore',        lat: 12.9716,  lng: 77.5946,   country: 'IN',
    anchors: [[12.9716, 77.5946],[12.9352, 77.6245],[12.9784, 77.6408],[13.0359, 77.5970]] },
  { name: 'Paris',            lat: 48.8566,  lng: 2.3522,    country: 'FR',
    anchors: [[48.8566, 2.3522],[48.8738, 2.2950],[48.8606, 2.3376],[48.8847, 2.3501],[48.8388, 2.3621]] },
  { name: 'Bogotá',           lat: 4.7110,   lng: -74.0721,  country: 'CO',
    anchors: [[4.7110, -74.0721],[4.6097, -74.0817],[4.6533, -74.0836]] },
  { name: 'Jakarta',          lat: -6.2088,  lng: 106.8456,  country: 'ID',
    anchors: [[-6.2088, 106.8456],[-6.1751, 106.8650],[-6.2615, 106.8106]] },
  { name: 'Chennai',          lat: 13.0827,  lng: 80.2707,   country: 'IN',
    anchors: [[13.0827, 80.2707],[13.0067, 80.2206],[13.1185, 80.2574]] },
  { name: 'Lima',             lat: -12.0464, lng: -77.0428,  country: 'PE',
    anchors: [[-12.0464, -77.0428],[-12.1196, -77.0365],[-12.0732, -77.0823]] },
  { name: 'Bangkok',          lat: 13.7563,  lng: 100.5018,  country: 'TH',
    anchors: [[13.7563, 100.5018],[13.7367, 100.5604],[13.7651, 100.5380],[13.7367, 100.5333]] },
  { name: 'Seoul',            lat: 37.5665,  lng: 126.9780,  country: 'KR',
    anchors: [[37.5665, 126.9780],[37.5172, 127.0473],[37.5400, 127.0700],[37.5326, 126.9905]] },
  { name: 'Nagoya',           lat: 35.1815,  lng: 136.9066,  country: 'JP',
    anchors: [[35.1815, 136.9066],[35.1709, 136.8815]] },
  { name: 'Hyderabad',        lat: 17.3850,  lng: 78.4867,   country: 'IN',
    anchors: [[17.3850, 78.4867],[17.4475, 78.3754],[17.4239, 78.4738]] },
  { name: 'London',           lat: 51.5074,  lng: -0.1278,   country: 'GB',
    anchors: [[51.5074, -0.1278],[51.5145, -0.1419],[51.5400, -0.1426],[51.4934, -0.1115],[51.5045, -0.0865]] },
  { name: 'Tehran',           lat: 35.6892,  lng: 51.3890,   country: 'IR',
    anchors: [[35.6892, 51.3890],[35.7219, 51.3347],[35.7448, 51.3753]] },
  { name: 'Chicago',          lat: 41.8781,  lng: -87.6298,  country: 'US',
    anchors: [[41.8781, -87.6298],[41.9100, -87.6770],[41.8920, -87.6360],[41.8506, -87.6493]] },
  { name: 'Chengdu',          lat: 30.5728,  lng: 104.0668,  country: 'CN',
    anchors: [[30.5728, 104.0668],[30.6586, 104.0648],[30.5398, 104.0741]] },
  { name: 'Nanjing',          lat: 32.0603,  lng: 118.7969,  country: 'CN',
    anchors: [[32.0603, 118.7969],[32.0427, 118.7787]] },
  { name: 'Wuhan',            lat: 30.5928,  lng: 114.3055,  country: 'CN',
    anchors: [[30.5928, 114.3055],[30.5471, 114.3422]] },
  { name: 'Ho Chi Minh City', lat: 10.8231,  lng: 106.6297,  country: 'VN',
    anchors: [[10.7769, 106.7009],[10.8231, 106.6297],[10.8005, 106.6402]] },
  { name: 'Luanda',           lat: -8.8390,  lng: 13.2894,   country: 'AO',
    anchors: [[-8.8390, 13.2894],[-8.8147, 13.2302]] },
  { name: 'Ahmedabad',        lat: 23.0225,  lng: 72.5714,   country: 'IN',
    anchors: [[23.0225, 72.5714],[23.0339, 72.5850]] },
  { name: 'Kuala Lumpur',     lat: 3.1390,   lng: 101.6869,  country: 'MY',
    anchors: [[3.1390, 101.6869],[3.1570, 101.7123],[3.1090, 101.6730]] },
  { name: 'Hong Kong',        lat: 22.3193,  lng: 114.1694,  country: 'HK',
    anchors: [[22.2783, 114.1747],[22.3193, 114.1694],[22.3964, 114.1095],[22.3372, 114.2103]] },
  { name: 'Riyadh',           lat: 24.7136,  lng: 46.6753,   country: 'SA',
    anchors: [[24.7136, 46.6753],[24.6877, 46.7219],[24.7741, 46.7386]] },
  { name: 'Baghdad',          lat: 33.3152,  lng: 44.3661,   country: 'IQ',
    anchors: [[33.3152, 44.3661],[33.3389, 44.4009]] },
  { name: 'Santiago',         lat: -33.4489, lng: -70.6693,  country: 'CL',
    anchors: [[-33.4489, -70.6693],[-33.4172, -70.6063],[-33.4691, -70.6420]] },
  { name: 'Madrid',           lat: 40.4168,  lng: -3.7038,   country: 'ES',
    anchors: [[40.4168, -3.7038],[40.4255, -3.6907],[40.4406, -3.7126],[40.4036, -3.6912]] },
  { name: 'Toronto',          lat: 43.6532,  lng: -79.3832,  country: 'CA',
    anchors: [[43.6532, -79.3832],[43.6677, -79.3948],[43.6629, -79.3957],[43.7000, -79.4163],[43.7615, -79.4111],[43.6890, -79.3196],[43.6426, -79.3871],[43.6470, -79.5210]] },
  { name: 'Singapore',        lat: 1.3521,   lng: 103.8198,  country: 'SG',
    anchors: [[1.3521, 103.8198],[1.3000, 103.8403],[1.3151, 103.7635]] },
  { name: 'Los Angeles',      lat: 34.0522,  lng: -118.2437, country: 'US',
    anchors: [[34.0522, -118.2437],[34.0900, -118.3617],[34.0211, -118.4815],[34.1478, -118.1445]] },
  { name: 'Sydney',           lat: -33.8688, lng: 151.2093,  country: 'AU',
    anchors: [[-33.8688, 151.2093],[-33.8915, 151.2767],[-33.8830, 151.1859],[-33.8915, 151.1949]] },
  { name: 'Berlin',           lat: 52.5200,  lng: 13.4050,   country: 'DE',
    anchors: [[52.5200, 13.4050],[52.5163, 13.3777],[52.4934, 13.4172],[52.5408, 13.3902]] },
  { name: 'Rome',             lat: 41.9028,  lng: 12.4964,   country: 'IT',
    anchors: [[41.9028, 12.4964],[41.8902, 12.4922],[41.9109, 12.4818],[41.8919, 12.5113]] },
  { name: 'Cape Town',        lat: -33.9249, lng: 18.4241,   country: 'ZA',
    anchors: [[-33.9249, 18.4241],[-33.9628, 18.4097],[-33.9067, 18.4173],[-33.9352, 18.4774]] }
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

  // Generate ~10 squads per city * 50 cities = 500 squads (cut from 20/city
  // for performance — was causing freezes on wide-zoom).
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
    const anchors: [number, number][] = city.anchors && city.anchors.length
      ? city.anchors
      : [[city.lat, city.lng]];
    for (let i = 0; i < 10; i++) {
      const sid = 'demo-sq-' + (squadCounter++);
      const memberCount = 4 + Math.floor(rng() * 97); // 4..100
      const ageDays = 1 + Math.floor(rng() * 1095);   // 1..1095 days
      const createdAt = now - ageDays * 86400_000;
      const name = pick(rng, SQUAD_PREFIX) + ' ' + pick(rng, SQUAD_SUFFIX);

      // Squad "home base" — small ~1.5km jitter around a real neighborhood
      // anchor so we don't dump pins into rivers/lakes/oceans.
      const homeAnchor = pick(rng, anchors);
      const center = jitter(rng, homeAnchor[0], homeAnchor[1], 0.015);

      // Members & their public-share status. To keep marker counts sane on
      // the world map, fewer members publicly broadcast (8% vs 18%).
      const members: string[] = [];
      const sharingMembers: { uid: string; name: string }[] = [];
      for (let m = 0; m < memberCount; m++) {
        const uid = 'demo-u-' + (userCounter++);
        members.push(uid);
        if (rng() < 0.08) sharingMembers.push({ uid, name: demoName(rng) });
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
        // Snap each public-sharing user to a random neighborhood anchor with a
        // tight ~800m jitter so they land on actual streets, not water.
        const a = pick(rng, anchors);
        const p = jitter(rng, a[0], a[1], 0.008);
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
      const squadPinCount = Math.min(pinCount, 2); // cap rendered pins per squad
      for (let p = 0; p < squadPinCount; p++) {
        const author = members[Math.floor(rng() * members.length)];
        const authorName = demoName(rng);
        const cat = pick(rng, PLACE_TEMPLATES as any) as readonly [string, readonly string[]];
        const placeName = city.name + ' ' + pick(rng, [...cat[1]]);
        // Each pin uses a fresh anchor + ~500m jitter — puts the pin on a
        // believable block rather than randomly in a harbour.
        const pinAnchor = pick(rng, anchors);
        const pinPos = jitter(rng, pinAnchor[0], pinAnchor[1], 0.005);
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
