// Live nationwide map of SquadREN trucks and their itineraries.
// Google Maps when VITE_GOOGLE_MAPS_API_KEY is set; otherwise a self-contained
// SVG map of the lower 48 so local dev and keyless deploys still work.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, PolylineF } from '@react-google-maps/api';
import type { LatLng } from '../../lib/geo';
import { CITIES } from '../../lib/freight/cities';

export type MapTruck = {
  id: string;
  pos: LatLng;
  heading: number;
  color: string;
  label: string;
  route?: LatLng[];
  progressMile?: number;
  dim?: boolean;
};
export type MapPin = { pos: LatLng; kind: 'pickup' | 'dropoff' | 'me'; label?: string };

type Props = {
  trucks: MapTruck[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  pins?: MapPin[];
  showRoutes?: 'all' | 'selected' | 'none';
  fitTo?: LatLng[] | null;
  className?: string;
  offline?: boolean;        // force the SVG map (e.g. decorative landing hero)
};

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export default function NetworkMap(props: Props) {
  return KEY && !props.offline ? <GoogleNetworkMap {...props} apiKey={KEY} /> : <SvgNetworkMap {...props} />;
}

// ── Google Maps ──────────────────────────────────────────────────────────────
const LIBS: ('geometry')[] = ['geometry'];
const DARK = [
  { elementType: 'geometry', stylers: [{ color: '#0f1420' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7b8496' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f1420' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2b3446' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1b2230' }] },
  { featureType: 'road.local', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0e17' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#2e3a52' }] },
];

function truckIcon(color: string, heading: number, selected: boolean) {
  const s = selected ? 44 : 30;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="${selected ? 17 : 15}" fill="${color}" stroke="white" stroke-width="${selected ? 3 : 2}"/>
    <g transform="rotate(${heading} 20 20)"><path d="M20 8 L27 24 L20 20 L13 24 Z" fill="white"/></g></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}
function pinIcon(kind: MapPin['kind']) {
  const color = kind === 'pickup' ? '#22c55e' : kind === 'dropoff' ? '#ef4444' : '#3b82f6';
  const svg = kind === 'me'
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="8" fill="${color}" stroke="white" stroke-width="3"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 0C7 0 1 6 1 14c0 10 14 26 14 26s14-16 14-26C29 6 23 0 15 0z" fill="${color}" stroke="white" stroke-width="2"/><text x="15" y="19" font-size="13" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold">${kind === 'pickup' ? 'A' : 'B'}</text></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

function GoogleNetworkMap({ trucks, selectedId, onSelect, pins = [], showRoutes = 'all', fitTo, className, apiKey }: Props & { apiKey: string }) {
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: apiKey, libraries: LIBS });
  const mapRef = useRef<google.maps.Map | null>(null);
  const onLoad = useCallback((m: google.maps.Map) => { mapRef.current = m; }, []);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !fitTo?.length) return;
    const b = new google.maps.LatLngBounds();
    fitTo.forEach(p => b.extend(p));
    mapRef.current.fitBounds(b, 60);
  }, [isLoaded, fitTo]);

  if (loadError) return <SvgNetworkMap trucks={trucks} selectedId={selectedId} onSelect={onSelect} pins={pins} showRoutes={showRoutes} fitTo={fitTo} className={className} />;
  if (!isLoaded) return <div className={`net-map ${className ?? ''}`}><div className="center">Loading map…</div></div>;

  return (
    <div className={`net-map ${className ?? ''}`}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={{ lat: 39.5, lng: -97 }}
        zoom={4}
        onLoad={onLoad}
        options={{ styles: DARK, disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', backgroundColor: '#0f1420' }}
      >
        {showRoutes !== 'none' && trucks.filter(t => t.route && (showRoutes === 'all' || t.id === selectedId)).map(t => (
          <PolylineF key={`r-${t.id}`} path={t.route!}
            options={{ strokeColor: t.color, strokeOpacity: t.id === selectedId ? 0.95 : t.dim ? 0.12 : 0.35, strokeWeight: t.id === selectedId ? 5 : 2.5, zIndex: t.id === selectedId ? 5 : 1 }} />
        ))}
        {trucks.map(t => (
          <MarkerF key={t.id} position={t.pos} title={t.label}
            icon={{ url: truckIcon(t.dim ? '#475569' : t.color, t.heading, t.id === selectedId), anchor: new google.maps.Point(t.id === selectedId ? 22 : 15, t.id === selectedId ? 22 : 15) }}
            zIndex={t.id === selectedId ? 100 : t.dim ? 1 : 10}
            onClick={() => onSelect?.(t.id)} />
        ))}
        {pins.map((p, i) => (
          <MarkerF key={`p-${i}`} position={p.pos} title={p.label} icon={{ url: pinIcon(p.kind), anchor: p.kind === 'me' ? new google.maps.Point(12, 12) : new google.maps.Point(15, 40) }} zIndex={200} />
        ))}
      </GoogleMap>
    </div>
  );
}

// ── Offline SVG map ──────────────────────────────────────────────────────────
const K = 20;
const COS = Math.cos((39 * Math.PI) / 180);
const proj = (p: LatLng) => ({ x: (p.lng + 125) * K * COS, y: (50 - p.lat) * K });
const VB = { x: 0, y: 0, w: (125 - 66.5) * K * COS, h: (50 - 24) * K };

// Simplified outline of the contiguous United States (lng, lat).
const US_OUTLINE: [number, number][] = [
  [-124.73, 48.38], [-124.1, 46.9], [-124.0, 46.2], [-123.9, 45.5], [-124.1, 44.0], [-124.5, 42.8], [-124.2, 41.9], [-124.4, 40.4],
  [-123.8, 39.6], [-123.0, 38.0], [-122.5, 37.7], [-121.9, 36.6], [-121.3, 35.6], [-120.6, 34.6], [-119.2, 34.1], [-118.4, 33.8],
  [-117.2, 32.7], [-114.7, 32.7], [-111.1, 31.33], [-108.2, 31.33], [-108.2, 31.78], [-106.5, 31.78], [-104.9, 30.6], [-104.0, 29.3],
  [-103.1, 29.0], [-102.4, 29.8], [-101.4, 29.8], [-100.3, 28.3], [-99.5, 27.5], [-97.4, 25.9], [-97.2, 27.8], [-96.0, 28.6],
  [-94.7, 29.4], [-93.8, 29.7], [-92.0, 29.6], [-90.2, 29.1], [-89.4, 29.0], [-89.6, 30.2], [-88.0, 30.4], [-87.2, 30.4],
  [-85.3, 29.7], [-84.0, 30.1], [-83.0, 29.2], [-82.7, 28.0], [-82.6, 27.0], [-81.8, 26.1], [-81.1, 25.2], [-80.4, 25.2],
  [-80.0, 26.7], [-80.6, 28.4], [-81.3, 30.0], [-81.4, 31.4], [-80.8, 32.1], [-79.2, 33.2], [-78.0, 33.9], [-76.6, 34.7],
  [-75.5, 35.3], [-75.9, 36.6], [-76.0, 37.3], [-75.0, 38.5], [-74.9, 38.9], [-74.0, 39.8], [-74.0, 40.5], [-72.0, 41.1],
  [-71.4, 41.4], [-70.6, 41.6], [-70.0, 41.8], [-70.6, 42.6], [-70.8, 43.1], [-70.2, 43.7], [-69.0, 44.1], [-67.0, 44.8],
  [-67.8, 45.7], [-67.8, 47.1], [-69.2, 47.4], [-70.0, 46.7], [-71.5, 45.0], [-74.7, 45.0], [-76.3, 44.2], [-76.2, 43.5],
  [-79.0, 43.3], [-79.0, 42.8], [-81.5, 41.6], [-83.4, 41.7], [-83.1, 42.3], [-82.5, 43.0], [-82.4, 43.9], [-83.4, 44.0],
  [-83.3, 45.0], [-84.6, 45.8], [-85.5, 45.2], [-86.3, 44.0], [-86.5, 42.2], [-87.5, 41.6], [-87.8, 42.5], [-87.9, 43.5],
  [-87.6, 44.8], [-87.0, 45.6], [-86.0, 46.0], [-84.6, 46.4], [-84.9, 46.9], [-86.5, 46.5], [-88.0, 47.3], [-90.0, 46.6],
  [-92.1, 46.7], [-89.6, 48.0], [-91.4, 48.05], [-93.0, 48.6], [-94.8, 49.3], [-95.15, 49.38], [-95.15, 49.0], [-123.1, 49.0],
  [-122.8, 48.9], [-123.0, 48.3],
];
const OUTLINE_D = US_OUTLINE.map(([lng, lat], i) => {
  const p = proj({ lat, lng });
  return `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
}).join(' ') + ' Z';

const LABEL_CITIES = ['seattle', 'portland', 'san-francisco', 'los-angeles', 'las-vegas', 'phoenix', 'salt-lake-city', 'denver', 'albuquerque', 'el-paso',
  'dallas', 'houston', 'kansas-city', 'omaha', 'minneapolis', 'chicago', 'st-louis', 'memphis', 'nashville', 'atlanta', 'new-orleans',
  'miami', 'orlando', 'charlotte', 'dc', 'nyc', 'boston', 'detroit', 'cleveland', 'pittsburgh', 'billings', 'boise', 'oklahoma-city'];
const LABELS = CITIES.filter(c => LABEL_CITIES.includes(c.id));

const SvgNetworkMap = memo(function SvgNetworkMap({ trucks, selectedId, onSelect, pins = [], showRoutes = 'all', fitTo, className }: Props) {
  const [view, setView] = useState(VB);
  const drag = useRef<{ x: number; y: number; v: typeof VB } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!fitTo?.length) { setView(VB); return; }
    const pts = fitTo.map(proj);
    const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
    const pad = 60;
    let w = Math.max(200, maxX - minX + pad * 2), h = Math.max(120, maxY - minY + pad * 2);
    const aspect = VB.w / VB.h;
    if (w / h > aspect) h = w / aspect; else w = h * aspect;
    setView({ x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - h / 2, w, h });
  }, [fitTo]);

  const zoomBy = (f: number, cx?: number, cy?: number) => setView(v => {
    const w = Math.min(VB.w * 1.2, Math.max(120, v.w * f));
    const h = w * (VB.h / VB.w);
    const ox = cx ?? v.x + v.w / 2, oy = cy ?? v.y + v.h / 2;
    return { x: ox - (ox - v.x) * (w / v.w), y: oy - (oy - v.y) * (h / v.h), w, h };
  });

  const toSvg = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    const scale = Math.max(view.w / r.width, view.h / r.height);
    const offX = (r.width * scale - view.w) / 2, offY = (r.height * scale - view.h) / 2;
    return { x: view.x - offX + (e.clientX - r.left) * scale, y: view.y - offY + (e.clientY - r.top) * scale, scale };
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toSvg(e);
      zoomBy(e.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const zoom = view.w / VB.w;               // <1 when zoomed in
  const r = Math.max(5, 9 * zoom);
  const routeD = (pts: LatLng[]) => pts.map((p, i) => { const q = proj(p); return `${i ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(' ');

  const sorted = useMemo(() => [...trucks].sort((a, b) => (a.id === selectedId ? 1 : 0) - (b.id === selectedId ? 1 : 0) || (a.dim ? -1 : 0) - (b.dim ? -1 : 0)), [trucks, selectedId]);

  return (
    <div className={`net-map svg ${className ?? ''}`}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY, v: view }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
        onPointerMove={e => {
          if (!drag.current) return;
          const rect = svgRef.current!.getBoundingClientRect();
          const scale = Math.max(view.w / rect.width, view.h / rect.height);
          const d = drag.current;
          setView({ ...d.v, x: d.v.x - (e.clientX - d.x) * scale, y: d.v.y - (e.clientY - d.y) * scale });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerLeave={() => { drag.current = null; }}
      >
        <defs>
          <linearGradient id="landfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#172033" />
            <stop offset="1" stopColor="#111827" />
          </linearGradient>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a2232" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x={-500} y={-500} width={VB.w + 1000} height={VB.h + 1000} fill="#0a0e17" />
        <rect x={-500} y={-500} width={VB.w + 1000} height={VB.h + 1000} fill="url(#grid)" />
        <path d={OUTLINE_D} fill="url(#landfill)" stroke="#334155" strokeWidth={2 * zoom + 0.5} strokeLinejoin="round" />
        {LABELS.map(c => {
          const p = proj(c);
          return (
            <g key={c.id} pointerEvents="none">
              <circle cx={p.x} cy={p.y} r={2.5 * zoom + 0.8} fill="#475569" />
              <text x={p.x + 5 * zoom + 2} y={p.y + 3 * zoom} fontSize={11 * zoom + 2} fill="#64748b" fontWeight={700}>{c.name}</text>
            </g>
          );
        })}
        {showRoutes !== 'none' && sorted.filter(t => t.route && (showRoutes === 'all' || t.id === selectedId)).map(t => (
          <path key={`r-${t.id}`} d={routeD(t.route!)} fill="none" stroke={t.color}
            strokeOpacity={t.id === selectedId ? 0.95 : t.dim ? 0.08 : 0.3}
            strokeWidth={(t.id === selectedId ? 5 : 2.2) * zoom + 0.6} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
        ))}
        {sorted.map(t => {
          const p = proj(t.pos);
          const sel = t.id === selectedId;
          const rr = sel ? r * 1.5 : r;
          return (
            <g key={t.id} transform={`translate(${p.x},${p.y})`} className="map-truck" onClick={e => { e.stopPropagation(); onSelect?.(t.id); }} style={{ cursor: 'pointer' }}>
              {sel && <circle r={rr * 1.9} fill={t.color} opacity={0.25} className="pulse-ring" />}
              <circle r={rr} fill={t.dim ? '#475569' : t.color} stroke="#fff" strokeWidth={rr * 0.18} />
              <path d={`M0,${-rr * 0.62} L${rr * 0.42},${rr * 0.42} L0,${rr * 0.18} L${-rr * 0.42},${rr * 0.42} Z`} fill="#fff" transform={`rotate(${t.heading})`} />
              <title>{t.label}</title>
            </g>
          );
        })}
        {pins.map((pin, i) => {
          const p = proj(pin.pos);
          const s = 14 * zoom + 6;
          if (pin.kind === 'me') return <circle key={i} cx={p.x} cy={p.y} r={s * 0.45} fill="#3b82f6" stroke="#fff" strokeWidth={s * 0.16} />;
          return (
            <g key={i} transform={`translate(${p.x},${p.y})`} pointerEvents="none">
              <path d={`M0,0 C ${-s * 0.2},${-s * 0.6} ${-s * 0.7},${-s * 0.9} ${-s * 0.7},${-s * 1.4} A ${s * 0.7} ${s * 0.7} 0 1 1 ${s * 0.7},${-s * 1.4} C ${s * 0.7},${-s * 0.9} ${s * 0.2},${-s * 0.6} 0,0 Z`}
                fill={pin.kind === 'pickup' ? '#22c55e' : '#ef4444'} stroke="#fff" strokeWidth={s * 0.08} />
              <text y={-s * 1.22} textAnchor="middle" fontSize={s * 0.75} fontWeight={900} fill="#fff">{pin.kind === 'pickup' ? 'A' : 'B'}</text>
            </g>
          );
        })}
      </svg>
      <div className="map-zoom">
        <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom in">＋</button>
        <button type="button" onClick={() => zoomBy(1.4)} aria-label="Zoom out">－</button>
        <button type="button" onClick={() => setView(VB)} aria-label="Reset view">⤢</button>
      </div>
    </div>
  );
});
