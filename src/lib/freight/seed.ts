// 50 demo owner-operators spread across the major interstate corridors so a
// first-time visitor immediately sees a living nationwide network. Every run
// loops (journey + layover) relative to the wall clock, so trucks are always
// somewhere on the map and every popular lane has upcoming capacity.
import type { Driver } from './types';
import { routeGeom, durationMs } from './route';

type SeedRow = [name: string, handle: string, route: string[], make: string, model: string, year: number, color: string, trailer: string, sqft: number, lbs: number, bio: string];

const R = {
  nycDen70: ['nyc', 'newark', 'allentown', 'harrisburg', 'pittsburgh', 'columbus', 'indianapolis', 'st-louis', 'kansas-city', 'salina', 'hays', 'denver'],
  nycDen80: ['nyc', 'scranton', 'cleveland', 'toledo', 'chicago', 'davenport', 'des-moines', 'omaha', 'lincoln', 'north-platte', 'denver'],
  phlDen: ['philadelphia', 'harrisburg', 'pittsburgh', 'cleveland', 'toledo', 'chicago', 'davenport', 'des-moines', 'omaha', 'north-platte', 'denver'],
  i95s: ['boston', 'providence', 'hartford', 'nyc', 'philadelphia', 'baltimore', 'dc', 'richmond', 'raleigh', 'savannah', 'jacksonville', 'orlando', 'miami'],
  i40w: ['raleigh', 'greensboro', 'knoxville', 'nashville', 'memphis', 'little-rock', 'oklahoma-city', 'amarillo', 'albuquerque', 'flagstaff', 'barstow', 'los-angeles'],
  i10w: ['jacksonville', 'tallahassee', 'mobile', 'new-orleans', 'baton-rouge', 'houston', 'san-antonio', 'el-paso', 'tucson', 'phoenix', 'los-angeles'],
  i5s: ['seattle', 'portland', 'medford', 'redding', 'sacramento', 'fresno', 'bakersfield', 'los-angeles', 'san-diego'],
  i94e: ['seattle', 'spokane', 'missoula', 'bozeman', 'billings', 'bismarck', 'fargo', 'minneapolis', 'madison', 'chicago'],
  kcSf: ['kansas-city', 'denver', 'grand-junction', 'salt-lake-city', 'elko', 'reno', 'sacramento', 'san-francisco'],
  i80w: ['chicago', 'davenport', 'des-moines', 'omaha', 'north-platte', 'cheyenne', 'rock-springs', 'salt-lake-city', 'elko', 'reno', 'sacramento', 'san-francisco'],
  i35s: ['minneapolis', 'des-moines', 'kansas-city', 'wichita', 'oklahoma-city', 'dallas', 'austin', 'san-antonio', 'laredo'],
  i75s: ['detroit', 'toledo', 'dayton', 'cincinnati', 'lexington', 'knoxville', 'chattanooga', 'atlanta', 'tampa', 'miami'],
  i65s: ['chicago', 'gary', 'indianapolis', 'louisville', 'nashville', 'birmingham', 'montgomery', 'mobile'],
  i55s: ['chicago', 'springfield-il', 'st-louis', 'memphis', 'jackson-ms', 'new-orleans'],
  i20w: ['atlanta', 'birmingham', 'jackson-ms', 'shreveport', 'dallas'],
  i25s: ['billings', 'casper', 'cheyenne', 'denver', 'colorado-springs', 'santa-fe', 'albuquerque', 'el-paso'],
  i15s: ['boise', 'salt-lake-city', 'las-vegas', 'barstow', 'los-angeles'],
  i90w: ['boston', 'albany', 'syracuse', 'rochester', 'buffalo', 'cleveland', 'toledo', 'chicago'],
  i81s: ['syracuse', 'scranton', 'harrisburg', 'knoxville', 'nashville', 'memphis'],
  i44w: ['st-louis', 'springfield-mo', 'tulsa', 'oklahoma-city', 'amarillo', 'albuquerque', 'flagstaff', 'phoenix'],
  i45e: ['dallas', 'houston', 'beaumont', 'baton-rouge', 'new-orleans'],
  i84e: ['portland', 'pendleton', 'boise', 'salt-lake-city', 'rock-springs', 'cheyenne', 'denver'],
  laChi: ['los-angeles', 'barstow', 'flagstaff', 'albuquerque', 'amarillo', 'oklahoma-city', 'tulsa', 'springfield-mo', 'st-louis', 'springfield-il', 'chicago'],
  seaDal: ['seattle', 'portland', 'boise', 'salt-lake-city', 'denver', 'amarillo', 'dallas'],
  houNyc: ['houston', 'beaumont', 'baton-rouge', 'new-orleans', 'mobile', 'montgomery', 'atlanta', 'charlotte', 'greensboro', 'richmond', 'dc', 'baltimore', 'philadelphia', 'nyc'],
  phxDen: ['phoenix', 'flagstaff', 'albuquerque', 'santa-fe', 'colorado-springs', 'denver'],
  chiAtl: ['chicago', 'indianapolis', 'louisville', 'nashville', 'chattanooga', 'atlanta'],
  epKc: ['el-paso', 'midland', 'lubbock', 'amarillo', 'wichita', 'kansas-city'],
  i90wMsp: ['minneapolis', 'sioux-falls', 'rapid-city', 'billings', 'bozeman', 'missoula', 'spokane', 'seattle'],
  bufDal: ['buffalo', 'pittsburgh', 'columbus', 'cincinnati', 'louisville', 'nashville', 'memphis', 'little-rock', 'dallas'],
  bosSf: ['boston', 'hartford', 'nyc', 'harrisburg', 'pittsburgh', 'columbus', 'indianapolis', 'st-louis', 'kansas-city', 'denver', 'salt-lake-city', 'reno', 'san-francisco'],
  atlLa: ['atlanta', 'birmingham', 'jackson-ms', 'shreveport', 'dallas', 'midland', 'el-paso', 'tucson', 'phoenix', 'los-angeles'],
  detBis: ['detroit', 'chicago', 'milwaukee', 'madison', 'minneapolis', 'fargo', 'bismarck'],
  jaxDen: ['jacksonville', 'atlanta', 'chattanooga', 'nashville', 'st-louis', 'kansas-city', 'denver'],
  i5n: ['san-diego', 'los-angeles', 'bakersfield', 'fresno', 'sacramento', 'redding', 'medford', 'portland', 'seattle'],
  miaChi: ['miami', 'tampa', 'atlanta', 'chattanooga', 'nashville', 'louisville', 'indianapolis', 'chicago'],
  dalNor: ['dallas', 'little-rock', 'memphis', 'nashville', 'knoxville', 'greensboro', 'raleigh', 'norfolk'],
  nycDet: ['nyc', 'albany', 'syracuse', 'rochester', 'buffalo', 'cleveland', 'toledo', 'detroit'],
  denLa: ['denver', 'grand-junction', 'las-vegas', 'barstow', 'los-angeles'],
  houSd: ['houston', 'san-antonio', 'el-paso', 'tucson', 'phoenix', 'san-diego'],
  kcFar: ['kansas-city', 'omaha', 'sioux-falls', 'fargo'],
  cltJax: ['charlotte', 'columbia-sc', 'charleston', 'savannah', 'jacksonville'],
  chiNyc: ['chicago', 'gary', 'fort-wayne', 'toledo', 'cleveland', 'pittsburgh', 'harrisburg', 'allentown', 'newark', 'nyc'],
  pwmDc: ['portland-me', 'boston', 'hartford', 'nyc', 'philadelphia', 'baltimore', 'dc'],
  slcNyc: ['salt-lake-city', 'rock-springs', 'cheyenne', 'denver', 'hays', 'salina', 'kansas-city', 'st-louis', 'indianapolis', 'columbus', 'pittsburgh', 'harrisburg', 'philadelphia', 'nyc'],
  tpaBos: ['tampa', 'orlando', 'jacksonville', 'savannah', 'charleston', 'raleigh', 'richmond', 'dc', 'baltimore', 'philadelphia', 'nyc', 'hartford', 'boston'],
  dalDen: ['dallas', 'oklahoma-city', 'wichita', 'salina', 'hays', 'denver'],
  seaPhx: ['seattle', 'pendleton', 'boise', 'salt-lake-city', 'las-vegas', 'phoenix'],
};
const rev = (r: string[]) => [...r].reverse();

const ROWS: SeedRow[] = [
  ['Marcus "Big Mac" Johnson', 'bigmac', R.nycDen70, 'peterbilt', '389', 2021, 'black', 'dryvan53', 260, 18000, '22 years on I-70. Climate-controlled van, blanket wrap for furniture.'],
  ['Rosa Delgado', 'rosaroads', R.nycDen80, 'kenworth', 'T680', 2023, 'red', 'dryvan53', 180, 14000, 'Team-trained, safety award 2024. Pallets and household goods.'],
  ['Tyrell Washington', 'ty_hauls', R.phlDen, 'freightliner', 'Cascadia', 2024, 'white', 'reefer53', 140, 12000, 'Reefer runs — produce, plants, temperature-sensitive goods.'],
  ['Hank Olsen', 'hank_w900', rev(R.nycDen70), 'kenworth', 'W900L', 2019, 'burgundy', 'dryvan53', 220, 16000, 'Old-school long hood. Denver back to the East Coast weekly.'],
  ['Priya Raman', 'priya_on_95', R.i95s, 'volvo', 'VNL 860', 2024, 'silver', 'dryvan53', 300, 20000, 'Boston to Miami all year round. Snowbird moves are my specialty.'],
  ['DeShawn Carter', 'dcarter', R.i40w, 'international', 'LT Series', 2022, 'blue', 'dryvan53', 200, 15000, 'Coast to coast on I-40. Motorcycles welcome, straps & chocks onboard.'],
  ['Luis "Lucho" Herrera', 'lucho10', R.i10w, 'peterbilt', '579', 2023, 'teal', 'flatbed48', 240, 22000, 'Flatbed on I-10. Machinery, lumber, boats.'],
  ['Kayla Brooks', 'kaylabrooks', R.i5s, 'kenworth', 'T680 Signature', 2025, 'purple', 'dryvan53', 160, 11000, 'West coast I-5 runner. Fast & careful with fragile pieces.'],
  ['Gunnar Lindqvist', 'gunnar94', R.i94e, 'westernstar', '57X', 2024, 'green', 'conestoga53', 280, 21000, 'Northern tier specialist. Conestoga keeps your cargo dry.'],
  ['Andre Moreau', 'andre_kc', R.kcSf, 'mack', 'Anthem', 2023, 'gray', 'dryvan53', 190, 15000, 'KC to the Bay through the Rockies, every week.'],
  ['Bobby Jo Tucker', 'bobbyjo', R.i80w, 'peterbilt', '589', 2025, 'yellow', 'dryvan53', 320, 24000, 'I-80 is my backyard. Room for cars, crates, and full pallets.'],
  ['Maria Santos', 'msantos35', R.i35s, 'freightliner', 'Cascadia', 2022, 'red', 'reefer53', 120, 9000, 'I-35 corridor, Minneapolis to Laredo. Reefer available.'],
  ['Jerome "Doc" Whitfield', 'doc75', R.i75s, 'volvo', 'VNL 760', 2021, 'navy', 'dryvan53', 210, 17000, 'Detroit to Miami. Auto parts, furniture, retail freight.'],
  ['Cheryl Nguyen', 'cherylnguyen', R.i65s, 'international', 'LT625', 2024, 'white', 'dryvan53', 150, 12000, 'Chicago to the Gulf on I-65.'],
  ['Earl Mitchell', 'earl55', R.i55s, 'kenworth', 'W990', 2023, 'black', 'stepdeck53', 260, 26000, 'Step deck — tall equipment, tractors, golf carts.'],
  ['Tamika Rhodes', 'tamikar', R.i20w, 'freightliner', 'Coronado', 2018, 'pink', 'dryvan53', 170, 13000, 'Atlanta to Dallas and back, twice a week.'],
  ['Clint Barrow', 'clintb', R.i25s, 'westernstar', '4900EX', 2020, 'brown', 'flatbed48', 220, 23000, 'Front Range + Big Sky. Ranch equipment and ATVs.'],
  ['Vanessa Ortiz', 'vortiz15', R.i15s, 'peterbilt', '579 UltraLoft', 2024, 'blue', 'dryvan53', 180, 14000, 'Boise to LA by way of Vegas.'],
  ['Patrick O\'Malley', 'paddyo', R.i90w, 'mack', 'Pinnacle', 2021, 'green', 'dryvan53', 230, 16000, 'Boston to Chicago on the Thruway. Lake-effect certified.'],
  ['Samira Haddad', 'samira81', R.i81s, 'volvo', 'VNL 740', 2023, 'gray', 'dryvan53', 140, 10000, 'Appalachian I-81 runs into Tennessee.'],
  ['Wade Simmons', 'wade44', R.i44w, 'kenworth', 'T880', 2022, 'orange', 'flatbed48', 200, 20000, 'Route 66 country. Heavy haul friendly.'],
  ['Chantel Price', 'chantelp', R.i45e, 'freightliner', 'Cascadia Evolution', 2019, 'silver', 'reefer53', 110, 8000, 'Texas to New Orleans. Reefer for seafood & produce.'],
  ['Jake Harmon', 'jakeharmon', R.i84e, 'peterbilt', '389X', 2024, 'red', 'dryvan53', 250, 19000, 'Portland to Denver across the Snake River plain.'],
  ['Ramon Castillo', 'ramonc', R.laChi, 'international', 'LoneStar', 2020, 'burgundy', 'dryvan53', 280, 21000, 'LA to Chicago via 40 and 44. Room for 2 cars.'],
  ['Darnell Hayes', 'dhayes', R.seaDal, 'volvo', 'VNL 860', 2025, 'black', 'dryvan53', 200, 15000, 'Seattle to Dallas monthly loop.'],
  ['Lorraine Fitzgerald', 'lfitz', R.houNyc, 'kenworth', 'T680', 2022, 'white', 'dryvan53', 330, 25000, 'Houston to NYC up the eastern seaboard.'],
  ['Tony Russo', 'tonyrusso', R.phxDen, 'mack', 'Anthem', 2024, 'red', 'dryvan53', 160, 12000, 'Desert to the Rockies.'],
  ['Brianna Lee', 'brilee', R.chiAtl, 'freightliner', 'Cascadia', 2023, 'blue', 'dryvan53', 190, 14000, 'Chicago to Atlanta express.'],
  ['Hector Morales', 'hectorm', R.epKc, 'peterbilt', '567', 2021, 'yellow', 'flatbed48', 210, 22000, 'Oil-field & ag equipment, West Texas to KC.'],
  ['Nadia Petrova', 'nadiap', R.i90wMsp, 'volvo', 'VNL 760', 2022, 'teal', 'dryvan53', 230, 17000, 'Minneapolis to Seattle along I-90.'],
  ['Calvin Brooks', 'calbrooks', R.bufDal, 'kenworth', 'W900B', 2018, 'green', 'dryvan53', 210, 16000, 'Buffalo to Dallas, every 10 days.'],
  ['Elena Vasquez', 'elenav', R.bosSf, 'tesla', 'Semi', 2025, 'silver', 'dryvan53', 170, 13000, 'All-electric coast to coast. Quiet, clean, on time.'],
  ['Reggie Thompson', 'reggiet', R.atlLa, 'international', 'LT Series', 2024, 'red', 'carhauler', 480, 30000, 'Car hauler — 9 slots, Atlanta to LA. Classic cars welcome.'],
  ['Stacy Kowalski', 'stacyk', R.detBis, 'westernstar', '5700XE', 2021, 'purple', 'dryvan53', 190, 14000, 'Detroit to the Dakotas on I-94.'],
  ['Omar Farouk', 'omarf', R.jaxDen, 'freightliner', 'Cascadia', 2024, 'navy', 'dryvan53', 210, 16000, 'Jacksonville to Denver by way of Nashville & KC.'],
  ['Jasmine Wright', 'jazwright', R.i5n, 'peterbilt', '579', 2022, 'pink', 'reefer53', 150, 11000, 'San Diego to Seattle. Reefer — wine, flowers, produce.'],
  ['Frank DiNapoli', 'frankd', R.miaChi, 'mack', 'Pinnacle', 2019, 'black', 'dryvan53', 240, 18000, 'Miami to Chicago non-stop schedule.'],
  ['Keisha Adams', 'keishaa', R.dalNor, 'volvo', 'VNR', 2023, 'white', 'dryvan28', 110, 8000, 'Pup van — perfect for small moves Dallas to Norfolk.'],
  ['Sean Gallagher', 'seang', R.nycDet, 'kenworth', 'T680', 2024, 'gray', 'dryvan53', 200, 15000, 'NYC to Detroit via upstate. Auto parts and household.'],
  ['Yolanda Pierce', 'yolandap', R.denLa, 'freightliner', '122SD', 2022, 'orange', 'stepdeck53', 230, 22000, 'Denver to LA through Vegas, step deck.'],
  ['Mateo Ramirez', 'mateor', R.houSd, 'international', 'ProStar', 2017, 'blue', 'dryvan53', 200, 15000, 'Houston to San Diego on I-10/I-8.'],
  ['Dale Jensen', 'dalej', R.kcFar, 'peterbilt', '389', 2016, 'green', 'flatbed48', 260, 24000, 'Ag country — KC up to Fargo.'],
  ['Monique Baptiste', 'moniqueb', R.cltJax, 'kenworth', 'T680', 2023, 'teal', 'dryvan53', 140, 10000, 'Carolina coast regional runs.'],
  ['Ray "Hammer" Hammond', 'hammer', R.chiNyc, 'mack', 'Super-Liner', 2011, 'yellow', 'dryvan53', 180, 14000, 'Chicago to NYC, 30 years no claims.'],
  ['Grace Kim', 'gracek', R.pwmDc, 'volvo', 'VNL 860', 2025, 'silver', 'dryvan53', 170, 12000, 'New England down to DC.'],
  ['Travis Coleman', 'travisc', R.slcNyc, 'peterbilt', '589', 2024, 'blue', 'dryvan53', 300, 22000, 'Salt Lake to NYC via Denver. Big empty van eastbound.'],
  ['Angela Russo', 'angrusso', R.tpaBos, 'freightliner', 'Cascadia', 2023, 'red', 'dryvan53', 220, 16000, 'Tampa to Boston up I-95.'],
  ['Curtis Bell', 'curtisb', R.dalDen, 'kenworth', 'W990', 2024, 'brown', 'dryvan53', 240, 18000, 'Dallas to Denver via Wichita.'],
  ['Ingrid Sorensen', 'ingrids', R.seaPhx, 'westernstar', '57X', 2025, 'white', 'reefer53', 130, 9000, 'Seattle to Phoenix, reefer, weekly.'],
  ['Victor Okafor', 'victoro', rev(R.nycDen80), 'international', 'LT625', 2025, 'black', 'dryvan53', 260, 20000, 'Denver to NYC on I-80 — eastbound capacity all month.'],
];

const AVATAR_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];
const H = 3_600_000;

// Deterministic PRNG so the seeded network is identical on every device.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// Fixed epoch so every client agrees on where each seeded truck is right now.
const EPOCH = Date.UTC(2026, 0, 5, 6, 0, 0);

export const SEED_DRIVERS: Driver[] = ROWS.map((row, i) => {
  const [name, handle, route, makeId, model, year, colorId, trailerId, sqft, lbs, bio] = row;
  const r = rng(i * 7919 + 17);
  const g = routeGeom(route);
  const tripMs = durationMs(g.totalMiles);
  const layover = (18 + Math.floor(r() * 30)) * H;
  const period = tripMs + layover;
  const phase = Math.floor(r() * period);
  return {
    id: `seed-${handle}`,
    name,
    handle,
    avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
    homeBase: route[0],
    rating: Math.round((4.55 + r() * 0.45) * 100) / 100,
    tripsCompleted: 40 + Math.floor(r() * 900),
    yearsDriving: 3 + Math.floor(r() * 28),
    bio,
    mcNumber: `MC-${(100000 + Math.floor(r() * 899999)).toString()}`,
    truck: { makeId, model, year, colorId },
    cargo: { trailerId, sqft, maxWeight: lbs },
    itinerary: { stops: route, departAt: EPOCH + phase, repeatEveryMs: period, roundTrip: true },
    online: true,
    seeded: true,
  };
});
