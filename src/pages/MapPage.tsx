import { useEffect, useMemo, useState } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { useAuth } from '../lib/AuthContext';
import { useLocation } from '../lib/useLocation';
import {
  updatePresence, watchSquadPresence, watchUserSquads, watchVisitedPlaces,
  type Presence, type Squad, type VisitedPlace
} from '../lib/data';
import { tickBadges } from '../lib/badges';

const containerStyle: React.CSSProperties = { width: '100%', height: '100%' };
const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

// Dark map styling so it matches the app theme.
const mapStyles: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#faf7ff' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a4670' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#ede1ff' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d9f3ff' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#fff5f8' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e6f9ee' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'simplified' }] }
];

export default function MapPage() {
  const { user } = useAuth();
  const [share, setShare] = useState<boolean>(() => localStorage.getItem('squadren.share') !== 'false');
  const [squads, setSquads] = useState<Squad[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [places, setPlaces] = useState<VisitedPlace[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const { pos, error } = useLocation({ enabled: !!user });

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    id: 'squadren-google-map'
  });

  useEffect(() => { localStorage.setItem('squadren.share', String(share)); }, [share]);

  useEffect(() => {
    if (!user) return;
    return watchUserSquads(user.uid, setSquads);
  }, [user?.uid]);

  const squadIds = useMemo(() => squads.map(s => s.id), [squads]);

  useEffect(() => {
    if (!user) return;
    return watchSquadPresence(squadIds, setPresence);
  }, [squadIds.join(',')]);

  useEffect(() => watchVisitedPlaces(setPlaces), []);

  // Push presence + run badge engine on every position update.
  useEffect(() => {
    if (!user || !pos) return;
    updatePresence({
      uid: user.uid,
      displayName: user.displayName,
      lat: pos.lat,
      lng: pos.lng,
      placeName: null,
      squadIds,
      shareLocation: share
    });
    const mates = presence.filter(p => p.uid !== user.uid).map(p => ({ lat: p.lat, lng: p.lng }));
    tickBadges(pos, mates);
  }, [pos?.lat, pos?.lng, share, squadIds.join(',')]);

  const center = pos || { lat: 37.7749, lng: -122.4194 };

  if (loadError) {
    return (
      <div className="page">
        <h1>Map</h1>
        <div className="card">
          <p className="error">Failed to load Google Maps. Check your API key.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-wrap" style={{ height: 'calc(100dvh - 76px)' }}>
      <div className="map-overlay">
        <div className="map-card">
          <div className="row">
            <span className="pill good">●</span>
            <span>{presence.filter(p => p.uid !== user?.uid).length} squad nearby</span>
          </div>
        </div>
        <button className={'share-toggle ' + (share ? 'on' : '')} onClick={() => setShare(s => !s)}>
          {share ? '📍 Sharing' : '🚫 Hidden'}
        </button>
      </div>

      {!GOOGLE_MAPS_KEY ? (
        <div className="center" style={{ flexDirection: 'column', padding: 24, textAlign: 'center' }}>
          <h2 style={{ color: 'var(--fg)' }}>Add a Google Maps API key</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 360 }}>
            Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>.env.local</code> (see <code>.env.example</code>),
            then restart the dev server.
          </p>
          {pos && <p style={{ color: 'var(--muted)' }}>You are at {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}.</p>}
          {error && <p className="error">{error}</p>}
        </div>
      ) : !isLoaded ? (
        <div className="center">Loading map…</div>
      ) : (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={pos ? 15 : 12}
          options={{
            styles: mapStyles,
            disableDefaultUI: true,
            zoomControl: true,
            clickableIcons: false,
            gestureHandling: 'greedy'
          }}
        >
          {pos && (
            <MarkerF
              position={pos}
              title="You"
              icon={meIcon()}
              onClick={() => setSelected('me')}
            >
              {selected === 'me' && (
                <InfoWindowF position={pos} onCloseClick={() => setSelected(null)}>
                  <div style={{ color: '#111' }}>You ({user?.displayName})</div>
                </InfoWindowF>
              )}
            </MarkerF>
          )}

          {presence.filter(p => p.uid !== user?.uid).map(p => (
            <MarkerF
              key={p.uid}
              position={{ lat: p.lat, lng: p.lng }}
              title={p.displayName}
              icon={squadIcon()}
              onClick={() => setSelected(p.uid)}
            >
              {selected === p.uid && (
                <InfoWindowF position={{ lat: p.lat, lng: p.lng }} onCloseClick={() => setSelected(null)}>
                  <div style={{ color: '#111' }}>
                    <strong>{p.displayName}</strong>
                    {p.placeName && <div>at {p.placeName}</div>}
                  </div>
                </InfoWindowF>
              )}
            </MarkerF>
          ))}

          {places.slice(0, 100).map((pl, i) => (
            <MarkerF
              key={`place-${i}`}
              position={{ lat: pl.lat, lng: pl.lng }}
              title={pl.placeName}
              icon={placeIcon()}
            />
          ))}
        </GoogleMap>
      )}
    </div>
  );
}

function svgMarker(fill: string, label = ''): google.maps.Icon {
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="56" viewBox="0 0 44 56">
  <path d="M22 0C9.85 0 0 9.4 0 21c0 15.4 22 35 22 35s22-19.6 22-35C44 9.4 34.15 0 22 0z" fill="${fill}"/>
  <circle cx="22" cy="21" r="11" fill="#fff"/>
  <text x="22" y="26" text-anchor="middle" font-size="14" font-family="system-ui" fill="${fill}" font-weight="700">${label}</text>
</svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(36, 46),
    anchor: new google.maps.Point(18, 46)
  };
}
function meIcon()    { return svgMarker('#8b5cf6', '★'); }
function squadIcon() { return svgMarker('#ec4899', '●'); }
function placeIcon() { return svgMarker('#f59e0b', '☕'); }
