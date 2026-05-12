// Geo helpers — distance + proximity detection for badge engine.
export type LatLng = { lat: number; lng: number };

const R = 6371000; // meters
export function haversine(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function withinMeters(a: LatLng, b: LatLng, meters: number) {
  return haversine(a, b) <= meters;
}
