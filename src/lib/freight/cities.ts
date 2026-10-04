// US city gazetteer used for route search, itinerary building and the
// offline map. Kept local so search works instantly without a geocoding API.
import type { LatLng } from '../geo';

export type City = LatLng & { id: string; name: string; state: string; aliases?: string[] };

const C = (id: string, name: string, state: string, lat: number, lng: number, aliases: string[] = []): City =>
  ({ id, name, state, lat, lng, aliases });

export const CITIES: City[] = [
  // Northeast
  C('nyc', 'New York', 'NY', 40.7128, -74.006, ['nyc', 'new york city', 'manhattan', 'brooklyn', 'queens', 'bronx']),
  C('newark', 'Newark', 'NJ', 40.7357, -74.1724, ['jersey', 'nj']),
  C('philadelphia', 'Philadelphia', 'PA', 39.9526, -75.1652, ['philly']),
  C('boston', 'Boston', 'MA', 42.3601, -71.0589),
  C('hartford', 'Hartford', 'CT', 41.7658, -72.6734),
  C('providence', 'Providence', 'RI', 41.824, -71.4128),
  C('albany', 'Albany', 'NY', 42.6526, -73.7562),
  C('syracuse', 'Syracuse', 'NY', 43.0481, -76.1474),
  C('buffalo', 'Buffalo', 'NY', 42.8864, -78.8784),
  C('rochester', 'Rochester', 'NY', 43.1566, -77.6088),
  C('scranton', 'Scranton', 'PA', 41.4089, -75.6624),
  C('harrisburg', 'Harrisburg', 'PA', 40.2732, -76.8867),
  C('allentown', 'Allentown', 'PA', 40.6084, -75.4902),
  C('pittsburgh', 'Pittsburgh', 'PA', 40.4406, -79.9959),
  C('portland-me', 'Portland', 'ME', 43.6591, -70.2568),
  C('baltimore', 'Baltimore', 'MD', 39.2904, -76.6122),
  C('dc', 'Washington', 'DC', 38.9072, -77.0369, ['dc', 'washington dc', 'd.c.']),
  // Southeast
  C('richmond', 'Richmond', 'VA', 37.5407, -77.436),
  C('norfolk', 'Norfolk', 'VA', 36.8508, -76.2859),
  C('raleigh', 'Raleigh', 'NC', 35.7796, -78.6382),
  C('charlotte', 'Charlotte', 'NC', 35.2271, -80.8431),
  C('greensboro', 'Greensboro', 'NC', 36.0726, -79.792),
  C('columbia-sc', 'Columbia', 'SC', 34.0007, -81.0348),
  C('charleston', 'Charleston', 'SC', 32.7765, -79.9311),
  C('savannah', 'Savannah', 'GA', 32.0809, -81.0912),
  C('atlanta', 'Atlanta', 'GA', 33.749, -84.388, ['atl']),
  C('jacksonville', 'Jacksonville', 'FL', 30.3322, -81.6557),
  C('orlando', 'Orlando', 'FL', 28.5383, -81.3792),
  C('tampa', 'Tampa', 'FL', 27.9506, -82.4572),
  C('miami', 'Miami', 'FL', 25.7617, -80.1918),
  C('tallahassee', 'Tallahassee', 'FL', 30.4383, -84.2807),
  C('birmingham', 'Birmingham', 'AL', 33.5186, -86.8104),
  C('montgomery', 'Montgomery', 'AL', 32.3792, -86.3077),
  C('mobile', 'Mobile', 'AL', 30.6954, -88.0399),
  C('nashville', 'Nashville', 'TN', 36.1627, -86.7816),
  C('knoxville', 'Knoxville', 'TN', 35.9606, -83.9207),
  C('chattanooga', 'Chattanooga', 'TN', 35.0456, -85.3097),
  C('memphis', 'Memphis', 'TN', 35.1495, -90.049),
  C('louisville', 'Louisville', 'KY', 38.2527, -85.7585),
  C('lexington', 'Lexington', 'KY', 38.0406, -84.5037),
  C('jackson-ms', 'Jackson', 'MS', 32.2988, -90.1848),
  C('new-orleans', 'New Orleans', 'LA', 29.9511, -90.0715, ['nola']),
  C('baton-rouge', 'Baton Rouge', 'LA', 30.4515, -91.1871),
  C('shreveport', 'Shreveport', 'LA', 32.5252, -93.7502),
  C('little-rock', 'Little Rock', 'AR', 34.7465, -92.2896),
  C('charleston-wv', 'Charleston', 'WV', 38.3498, -81.6326),
  // Midwest
  C('chicago', 'Chicago', 'IL', 41.8781, -87.6298, ['chi', 'chi-town']),
  C('detroit', 'Detroit', 'MI', 42.3314, -83.0458),
  C('grand-rapids', 'Grand Rapids', 'MI', 42.9634, -85.6681),
  C('cleveland', 'Cleveland', 'OH', 41.4993, -81.6944),
  C('toledo', 'Toledo', 'OH', 41.6528, -83.5379),
  C('columbus', 'Columbus', 'OH', 39.9612, -82.9988),
  C('cincinnati', 'Cincinnati', 'OH', 39.1031, -84.512),
  C('dayton', 'Dayton', 'OH', 39.7589, -84.1916),
  C('indianapolis', 'Indianapolis', 'IN', 39.7684, -86.1581, ['indy']),
  C('fort-wayne', 'Fort Wayne', 'IN', 41.0793, -85.1394),
  C('gary', 'Gary', 'IN', 41.5934, -87.3464),
  C('milwaukee', 'Milwaukee', 'WI', 43.0389, -87.9065),
  C('madison', 'Madison', 'WI', 43.0731, -89.4012),
  C('minneapolis', 'Minneapolis', 'MN', 44.9778, -93.265, ['twin cities', 'st paul', 'msp']),
  C('duluth', 'Duluth', 'MN', 46.7867, -92.1005),
  C('fargo', 'Fargo', 'ND', 46.8772, -96.7898),
  C('bismarck', 'Bismarck', 'ND', 46.8083, -100.7837),
  C('sioux-falls', 'Sioux Falls', 'SD', 43.5446, -96.7311),
  C('rapid-city', 'Rapid City', 'SD', 44.0805, -103.231),
  C('des-moines', 'Des Moines', 'IA', 41.5868, -93.625),
  C('davenport', 'Davenport', 'IA', 41.5236, -90.5776, ['quad cities']),
  C('omaha', 'Omaha', 'NE', 41.2565, -95.9345),
  C('lincoln', 'Lincoln', 'NE', 40.8136, -96.7026),
  C('north-platte', 'North Platte', 'NE', 41.1403, -100.7601),
  C('kansas-city', 'Kansas City', 'MO', 39.0997, -94.5786, ['kc', 'kcmo']),
  C('st-louis', 'St. Louis', 'MO', 38.627, -90.1994, ['stl', 'saint louis']),
  C('springfield-mo', 'Springfield', 'MO', 37.209, -93.2923),
  C('springfield-il', 'Springfield', 'IL', 39.7817, -89.6501),
  C('peoria', 'Peoria', 'IL', 40.6936, -89.589),
  C('wichita', 'Wichita', 'KS', 37.6872, -97.3301),
  C('salina', 'Salina', 'KS', 38.8403, -97.6114),
  C('hays', 'Hays', 'KS', 38.8792, -99.3268),
  C('topeka', 'Topeka', 'KS', 39.0473, -95.6752),
  // South / Texas
  C('dallas', 'Dallas', 'TX', 32.7767, -96.797, ['dfw', 'fort worth']),
  C('houston', 'Houston', 'TX', 29.7604, -95.3698, ['htx']),
  C('austin', 'Austin', 'TX', 30.2672, -97.7431),
  C('san-antonio', 'San Antonio', 'TX', 29.4241, -98.4936),
  C('el-paso', 'El Paso', 'TX', 31.7619, -106.485),
  C('amarillo', 'Amarillo', 'TX', 35.222, -101.8313),
  C('lubbock', 'Lubbock', 'TX', 33.5779, -101.8552),
  C('midland', 'Midland', 'TX', 31.9973, -102.0779),
  C('laredo', 'Laredo', 'TX', 27.5306, -99.4803),
  C('beaumont', 'Beaumont', 'TX', 30.0802, -94.1266),
  C('oklahoma-city', 'Oklahoma City', 'OK', 35.4676, -97.5164, ['okc']),
  C('tulsa', 'Tulsa', 'OK', 36.154, -95.9928),
  // Mountain
  C('denver', 'Denver', 'CO', 39.7392, -104.9903, ['den']),
  C('colorado-springs', 'Colorado Springs', 'CO', 38.8339, -104.8214),
  C('grand-junction', 'Grand Junction', 'CO', 39.0639, -108.5506),
  C('cheyenne', 'Cheyenne', 'WY', 41.14, -104.8202),
  C('rock-springs', 'Rock Springs', 'WY', 41.5875, -109.2029),
  C('casper', 'Casper', 'WY', 42.8666, -106.3131),
  C('billings', 'Billings', 'MT', 45.7833, -108.5007),
  C('bozeman', 'Bozeman', 'MT', 45.677, -111.0429),
  C('missoula', 'Missoula', 'MT', 46.8721, -113.994),
  C('salt-lake-city', 'Salt Lake City', 'UT', 40.7608, -111.891, ['slc']),
  C('boise', 'Boise', 'ID', 43.615, -116.2023),
  C('albuquerque', 'Albuquerque', 'NM', 35.0844, -106.6504, ['abq']),
  C('santa-fe', 'Santa Fe', 'NM', 35.687, -105.9378),
  C('flagstaff', 'Flagstaff', 'AZ', 35.1983, -111.6513),
  C('phoenix', 'Phoenix', 'AZ', 33.4484, -112.074, ['phx']),
  C('tucson', 'Tucson', 'AZ', 32.2226, -110.9747),
  C('las-vegas', 'Las Vegas', 'NV', 36.1699, -115.1398, ['vegas', 'lv']),
  C('reno', 'Reno', 'NV', 39.5296, -119.8138),
  C('elko', 'Elko', 'NV', 40.8324, -115.7631),
  // West coast
  C('los-angeles', 'Los Angeles', 'CA', 34.0522, -118.2437, ['la', 'l.a.', 'socal']),
  C('san-diego', 'San Diego', 'CA', 32.7157, -117.1611, ['sd']),
  C('barstow', 'Barstow', 'CA', 34.8958, -117.0173),
  C('bakersfield', 'Bakersfield', 'CA', 35.3733, -119.0187),
  C('fresno', 'Fresno', 'CA', 36.7378, -119.7871),
  C('sacramento', 'Sacramento', 'CA', 38.5816, -121.4944),
  C('san-francisco', 'San Francisco', 'CA', 37.7749, -122.4194, ['sf', 'bay area', 'oakland']),
  C('redding', 'Redding', 'CA', 40.5865, -122.3917),
  C('medford', 'Medford', 'OR', 42.3265, -122.8756),
  C('portland', 'Portland', 'OR', 45.5152, -122.6784, ['pdx']),
  C('seattle', 'Seattle', 'WA', 47.6062, -122.3321, ['sea', 'tacoma']),
  C('spokane', 'Spokane', 'WA', 47.6588, -117.426),
  C('pendleton', 'Pendleton', 'OR', 45.6721, -118.7886),
];

export const CITY_BY_ID: Record<string, City> = Object.fromEntries(CITIES.map(c => [c.id, c]));

export function cityLabel(c: City) {
  return `${c.name}, ${c.state}`;
}

// Fuzzy resolve user text ("NYC", "denver co", "Kansas City, MO") to a city.
export function findCity(q: string): City | null {
  const s = q.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  for (const c of CITIES) {
    const full = `${c.name}, ${c.state}`.toLowerCase();
    if (s === full || s === `${c.name} ${c.state}`.toLowerCase()) return c;
  }
  for (const c of CITIES) {
    if (c.aliases?.includes(s)) return c;
  }
  // Prefer the bigger/first-listed city on bare-name ambiguity (Portland → OR is listed later
  // than ME, so special-case the obvious intent).
  if (s === 'portland') return CITY_BY_ID['portland'];
  if (s === 'springfield') return CITY_BY_ID['springfield-mo'];
  if (s === 'charleston') return CITY_BY_ID['charleston'];
  for (const c of CITIES) {
    if (c.name.toLowerCase() === s) return c;
  }
  for (const c of CITIES) {
    if (c.name.toLowerCase().startsWith(s) || `${c.name}, ${c.state}`.toLowerCase().startsWith(s)) return c;
  }
  return null;
}

export function nearestCity(p: LatLng): City {
  let best = CITIES[0];
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = (c.lat - p.lat) ** 2 + ((c.lng - p.lng) * Math.cos((p.lat * Math.PI) / 180)) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
