import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, PolylineF, InfoWindowF } from '@react-google-maps/api';
import {
  simulateFleet, STATIC_ROUTES, findHitchhikeMatches, computeApe,
  type SimVan, type StaticRoute, type HitchhikeMatch,
} from '../lib/rides';

// ─── Constants ────────────────────────────────────────────────────────────────

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

// Must be stable module-level const — inline arrays cause useJsApiLoader to reload on every render
const MAPS_LIBRARIES: ('geometry' | 'places')[] = ['geometry'];
const BUFFALO_CENTER = { lat: 42.8864, lng: -78.8784 };

const ROUTE_COLORS: Record<string, string> = {
  'nyc-shopping':   '#f59e0b',
  'toronto':        '#ef4444',
  'clifton-hill':   '#22d3ee',
  'darien-lake':    '#a855f7',
  'regional-jails': '#64748b',
};

const STATUS_COLORS: Record<string, string> = {
  on_route:    '#22c55e',
  available:   '#3b82f6',
  charter:     '#f59e0b',
  maintenance: '#6b7280',
};

const DARK_MAP_STYLE = [
  { elementType: 'geometry',        stylers: [{ color: '#0d1117' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a5568' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1117' }] },
  { featureType: 'road',            elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road.arterial',   elementType: 'geometry', stylers: [{ color: '#1e3a5f' }] },
  { featureType: 'road.highway',    elementType: 'geometry', stylers: [{ color: '#1e4d7a' }] },
  { featureType: 'water',           elementType: 'geometry', stylers: [{ color: '#060d1f' }] },
  { featureType: 'poi',             stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',         stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative',  elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
];

// ─── SVG Van Marker ───────────────────────────────────────────────────────────

function vanMarkerSvg(num: number, color: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="20" fill="${color}" opacity="0.9" stroke="white" stroke-width="2"/>
      <text x="22" y="27" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="white">${num}</text>
    </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg.trim());
}

// ─── APE Modal ────────────────────────────────────────────────────────────────

function ApeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fm-modal-backdrop" onClick={onClose}>
      <div className="fm-modal" onClick={e => e.stopPropagation()}>
        <div className="fm-modal-header">
          <span className="fm-modal-title">⚡ APE — Algorithmic Pricing Engine</span>
          <button className="fm-modal-close" onClick={onClose}>✕</button>
        </div>

        <p className="fm-modal-intro">
          SquadREN doesn't charge a flat rate. APE dynamically calculates the fairest price
          for every seat on every trip — so the more riders, the cheaper it gets for everyone.
        </p>

        <div className="fm-ape-grid">
          <div className="fm-ape-card">
            <div className="fm-ape-icon">👥</div>
            <div className="fm-ape-label">Rider Count</div>
            <div className="fm-ape-desc">More riders = deeper group discount. Up to 25% off base when the van fills up.</div>
          </div>
          <div className="fm-ape-card">
            <div className="fm-ape-icon">📍</div>
            <div className="fm-ape-label">Distance</div>
            <div className="fm-ape-desc">Longer routes spread fuel + driver cost over more miles per seat. NYC runs stay $45 while solo Uber is $140+.</div>
          </div>
          <div className="fm-ape-card">
            <div className="fm-ape-icon">🕐</div>
            <div className="fm-ape-label">Time of Day</div>
            <div className="fm-ape-desc">Peak demand hours (8–10 AM, 4–7 PM) add a small surcharge. Off-peak rides stay cheaper.</div>
          </div>
          <div className="fm-ape-card">
            <div className="fm-ape-icon">🎟️</div>
            <div className="fm-ape-label">Venue Popularity</div>
            <div className="fm-ape-desc">Concert nights, sold-out events, and holiday weekends factor into demand signals.</div>
          </div>
          <div className="fm-ape-card">
            <div className="fm-ape-icon">📊</div>
            <div className="fm-ape-label">Market Demand</div>
            <div className="fm-ape-desc">Real-time booking velocity for each route adjusts prices to balance fill rate and affordability.</div>
          </div>
          <div className="fm-ape-card highlight">
            <div className="fm-ape-icon">💸</div>
            <div className="fm-ape-label">The Result</div>
            <div className="fm-ape-desc">Save 50–70% vs Uber XL. A full van to NYC costs $45/seat vs $140+ going solo. APE makes group transit the obvious choice.</div>
          </div>
        </div>

        <div className="fm-ape-formula">
          <span className="fm-ape-formula-label">Final Price =</span>
          <span className="fm-ape-formula-expr">Base × (1 − Rider Discount − Fill Discount + Demand Surcharge)</span>
        </div>

        <div className="fm-modal-footer">
          <button className="fm-cta" onClick={onClose}>Got it ✓</button>
        </div>
      </div>
    </div>
  );
}

// ─── Hitchhiker Panel ─────────────────────────────────────────────────────────

function HitchhikerPanel({
  matches,
  destination,
  onDestChange,
  onSearch,
  loading,
  onClose,
}: {
  matches: HitchhikeMatch[];
  destination: string;
  onDestChange: (v: string) => void;
  onSearch: () => void;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fm-hh-panel">
      <div className="fm-hh-header">
        <span className="fm-hh-title">🤖 Hitchhiker AI</span>
        <button className="fm-modal-close" onClick={onClose}>✕</button>
      </div>
      <p className="fm-hh-desc">
        Enter your destination. We'll find vans already in motion that can pick you up en route.
      </p>
      <div className="fm-hh-search">
        <input
          className="fm-hh-input"
          placeholder="e.g. New York City, Toronto, Niagara…"
          value={destination}
          onChange={e => onDestChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearch()}
        />
        <button className="fm-hh-btn" onClick={onSearch} disabled={loading}>
          {loading ? '…' : 'Search'}
        </button>
      </div>

      {matches.length === 0 && destination && !loading && (
        <p className="fm-hh-empty">No vans currently heading that way with open seats. Check back soon or book a scheduled ride.</p>
      )}

      {matches.map((m, idx) => {
        const routeColor = ROUTE_COLORS[m.route.id] || '#6b7280';
        return (
          <div key={idx} className="fm-hh-card" style={{ borderColor: routeColor }}>
            <div className="fm-hh-card-top">
              <span className="fm-hh-van">{m.van.label}</span>
              <span className="fm-hh-badge" style={{ background: routeColor }}>{m.route.emoji} {m.route.name}</span>
            </div>
            <div className="fm-hh-detail">
              <span>📍 Pickup: <strong>{m.pickupName}</strong></span>
              <span>⏱ ~{m.minutesToPickup} min away</span>
              <span>💺 {m.van.seatsAvailable} seat{m.van.seatsAvailable !== 1 ? 's' : ''} left</span>
            </div>
            <div className="fm-hh-price-row">
              <div>
                <div className="fm-hh-price">${m.pricePerSeat}/seat</div>
                <div className="fm-hh-savings">{m.ape.label} · Save {m.ape.savingsPct}% vs Uber</div>
              </div>
              <button className="fm-hh-book">Book Seat →</button>
            </div>
          </div>
        );
      })}

      {matches.length > 0 && (
        <p className="fm-hh-footnote">
          Booking confirms your pickup slot. Driver will be notified.
        </p>
      )}
    </div>
  );
}

// ─── Van Info Window ──────────────────────────────────────────────────────────

function VanInfoWindow({ van, route, onClose }: { van: SimVan; route?: StaticRoute; onClose: () => void }) {
  const ape = route
    ? computeApe(route, route.maxPassengers - van.seatsAvailable)
    : null;
  const color = STATUS_COLORS[van.status] || '#6b7280';

  return (
    <InfoWindowF position={{ lat: van.lat, lng: van.lng }} onCloseClick={onClose}>
      <div className="fm-info">
        <div className="fm-info-header">
          <span className="fm-info-dot" style={{ background: color }} />
          <strong>{van.label}</strong>
          <span className="fm-info-status">{van.status.replace('_', ' ')}</span>
        </div>
        {route && (
          <>
            <div className="fm-info-route">{route.emoji} {route.name}</div>
            <div className="fm-info-row">
              <span>💺 {van.seatsAvailable} seats open</span>
              {ape && <span className="fm-info-price">${ape.finalPrice}/seat</span>}
            </div>
            {ape && <div className="fm-info-savings">Save {ape.savingsPct}% vs Uber XL</div>}
          </>
        )}
        {van.status === 'available' && <div className="fm-info-available">Ready for charter at Buffalo Hub</div>}
        {van.status === 'maintenance' && <div className="fm-info-maint">In maintenance — back soon</div>}
      </div>
    </InfoWindowF>
  );
}

// ─── Fleet Legend ─────────────────────────────────────────────────────────────

function FleetLegend() {
  return (
    <div className="fm-legend">
      {STATIC_ROUTES.map(r => (
        <div key={r.id} className="fm-legend-row">
          <span className="fm-legend-dot" style={{ background: ROUTE_COLORS[r.id] || '#6b7280' }} />
          <span>{r.emoji} {r.name}</span>
          <span className="fm-legend-price">${r.pricePerRider}/seat</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// Split into inner+outer so hooks aren't conditional but Maps SDK only loads when key present
function FleetMapInner() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: MAPS_LIBRARIES,
  });

  const [vans, setVans] = useState<SimVan[]>([]);
  const [selectedVan, setSelectedVan] = useState<SimVan | null>(null);
  const [showApe, setShowApe] = useState(false);
  const [showHH, setShowHH] = useState(false);
  const [hhDest, setHhDest] = useState('');
  const [hhMatches, setHhMatches] = useState<HitchhikeMatch[]>([]);
  const [hhLoading, setHhLoading] = useState(false);
  const [tab, setTab] = useState<'fleet' | 'routes'>('fleet');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => setVans(simulateFleet()), []);

  useEffect(() => {
    tick();
    timerRef.current = setInterval(tick, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [tick]);

  const onRoute = vans.filter(v => v.status === 'on_route').length;
  const available = vans.filter(v => v.status === 'available').length;

  function handleHHSearch() {
    if (!hhDest.trim()) return;
    setHhLoading(true);
    setTimeout(() => {
      setHhMatches(findHitchhikeMatches(hhDest));
      setHhLoading(false);
    }, 600);
  }

  return (
    <div className="fm-shell">
      {/* ── Top HUD ── */}
      <div className="fm-hud">
        <div className="fm-hud-brand">
          <span className="fm-hud-icon">🚐</span>
          <span className="fm-hud-title">Squadron Fleet</span>
          <span className="fm-hud-live">● LIVE</span>
        </div>
        <div className="fm-hud-stats">
          <span className="fm-stat on"><span className="fm-stat-num">{onRoute}</span> on route</span>
          <span className="fm-stat av"><span className="fm-stat-num">{available}</span> available</span>
        </div>
        <div className="fm-hud-actions">
          <button className="fm-hud-btn hh" onClick={() => setShowHH(v => !v)}>
            🤖 Hitchhiker AI
          </button>
          <button className="fm-hud-btn ape" onClick={() => setShowApe(true)}>
            ⚡ How Pricing Works
          </button>
        </div>
      </div>

      {/* ── Map ── */}
      <div className="fm-map-wrap">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={BUFFALO_CENTER}
            zoom={8}
            options={{
              styles: DARK_MAP_STYLE,
              disableDefaultUI: true,
              zoomControl: true,
              gestureHandling: 'greedy',
            }}
          >
            {/* Route polylines */}
            {STATIC_ROUTES.map(route => (
              <PolylineF
                key={route.id}
                path={route.waypoints}
                options={{
                  strokeColor: ROUTE_COLORS[route.id] || '#6b7280',
                  strokeOpacity: 0.45,
                  strokeWeight: 3,
                }}
              />
            ))}

            {/* Van markers */}
            {vans.map(van => (
              <MarkerF
                key={van.id}
                position={{ lat: van.lat, lng: van.lng }}
                icon={{
                  url: vanMarkerSvg(van.number, STATUS_COLORS[van.status] || '#6b7280'),
                  scaledSize: new window.google.maps.Size(44, 44),
                  anchor: new window.google.maps.Point(22, 22),
                }}
                title={van.label}
                onClick={() => setSelectedVan(van)}
              />
            ))}

            {/* Van info window */}
            {selectedVan && (
              <VanInfoWindow
                van={selectedVan}
                route={STATIC_ROUTES.find(r => r.id === selectedVan.routeId) ?? undefined}
                onClose={() => setSelectedVan(null)}
              />
            )}
          </GoogleMap>
        ) : (
          <div className="fm-loading">Loading fleet map…</div>
        )}
      </div>

      {/* ── Bottom Panel ── */}
      <div className="fm-panel">
        <div className="fm-panel-tabs">
          <button
            className={`fm-tab ${tab === 'fleet' ? 'active' : ''}`}
            onClick={() => setTab('fleet')}
          >Fleet Board</button>
          <button
            className={`fm-tab ${tab === 'routes' ? 'active' : ''}`}
            onClick={() => setTab('routes')}
          >Routes & Pricing</button>
        </div>

        {tab === 'fleet' && (
          <div className="fm-fleet-board">
            {vans.map(van => {
              const color = STATUS_COLORS[van.status] || '#6b7280';
              const routeColor = van.routeId ? (ROUTE_COLORS[van.routeId] || '#6b7280') : color;
              return (
                <div
                  key={van.id}
                  className="fm-van-row"
                  style={{ borderLeftColor: routeColor }}
                  onClick={() => setSelectedVan(van)}
                >
                  <span className="fm-van-dot" style={{ background: color }} />
                  <span className="fm-van-label">{van.label}</span>
                  <span className="fm-van-route">{van.routeName ?? (van.status === 'maintenance' ? 'Maintenance' : 'Available')}</span>
                  {van.seatsAvailable > 0 && van.status === 'on_route' && (
                    <span className="fm-van-seats">{van.seatsAvailable} seats</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'routes' && (
          <div className="fm-routes-board">
            <FleetLegend />
            <div className="fm-routes-ape-note">
              <span>Prices shown are base rates.</span>
              <button className="fm-ape-link" onClick={() => setShowApe(true)}>How APE sets your real price ⚡</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Hitchhiker Panel (slide-in) ── */}
      {showHH && (
        <div className="fm-hh-overlay">
          <HitchhikerPanel
            matches={hhMatches}
            destination={hhDest}
            onDestChange={setHhDest}
            onSearch={handleHHSearch}
            loading={hhLoading}
            onClose={() => setShowHH(false)}
          />
        </div>
      )}

      {/* ── APE Modal ── */}
      {showApe && <ApeModal onClose={() => setShowApe(false)} />}
    </div>
  );
}

export default function FleetMapPage() {
  if (!GOOGLE_MAPS_KEY) {
    return (
      <div className="fm-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 48 }}>🚐</div>
        <div style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700 }}>Fleet Map</div>
        <div style={{ color: '#64748b', fontSize: 14, textAlign: 'center', maxWidth: 300 }}>
          Google Maps API key is not configured.<br/>
          Add <code style={{ color: '#f59e0b' }}>VITE_GOOGLE_MAPS_API_KEY</code> to GitHub Actions secrets.
        </div>
      </div>
    );
  }
  return <FleetMapInner />;
}
