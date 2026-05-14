import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, CircleF } from '@react-google-maps/api';
import { useAuth } from '../lib/AuthContext';
import { useLocation } from '../lib/useLocation';
import {
  updatePresence, watchSquadPresence, watchUserSquads, watchVisitedPlaces,
  watchMyVisitedPlaces, maybeAutoLogVisit, parseGoogleTimeline, importTimelinePins,
  type Presence, type Squad, type VisitedPlace
} from '../lib/data';
import { tickBadges } from '../lib/badges';
import { avatarToDataUrl } from '../components/Avatar';
import { defaultAvatar } from '../lib/AuthContext';

const containerStyle: React.CSSProperties = { width: '100%', height: '100%' };
const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

// Bright/pastel map styling so it matches the app theme.
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

type Layer = 'squad' | 'mine';

export default function MapPage() {
  const { user } = useAuth();
  const [share, setShare] = useState<boolean>(() => localStorage.getItem('squadren.share') !== 'false');
  const [layer, setLayer] = useState<Layer>('squad');
  const [squads, setSquads] = useState<Squad[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [squadPlaces, setSquadPlaces] = useState<VisitedPlace[]>([]);
  const [myPlaces, setMyPlaces] = useState<VisitedPlace[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => watchVisitedPlaces(setSquadPlaces), []);
  useEffect(() => {
    if (!user) return;
    return watchMyVisitedPlaces(user.uid, setMyPlaces);
  }, [user?.uid]);

  // Push presence, run badge engine, AND auto-log unique visit pins as the
  // user moves around. Auto-log is gated by distance + cooldown inside
  // maybeAutoLogVisit so static users don't spam the DB.
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
    maybeAutoLogVisit(user.uid, user.displayName, pos, myPlaces).catch(() => {});
  }, [pos?.lat, pos?.lng, share, squadIds.join(',')]);

  const center = pos || { lat: 37.7749, lng: -122.4194 };
  const myAvatar = user?.avatar || defaultAvatar;
  const meIconUrl = useMemo(() => avatarToDataUrl(myAvatar), [JSON.stringify(myAvatar)]);

  async function onTimelineFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    setImportMsg(null);
    const text = await f.text();
    const pins = parseGoogleTimeline(text);
    if (pins.length === 0) {
      setImportMsg('Could not find any places in that file. Try Records.json, Semantic Location History month files, or the new Timeline.json from Google Takeout.');
      return;
    }
    // Hard cap to keep the map snappy and Firestore costs low.
    const capped = pins.slice(0, 2000);
    setImporting({ done: 0, total: capped.length });
    try {
      await importTimelinePins(user.uid, user.displayName, capped, (done, total) => setImporting({ done, total }));
      setImportMsg(`Imported ${capped.length} places from Google Timeline.`);
      setLayer('mine');
    } catch (err: any) {
      setImportMsg('Import failed: ' + (err?.message || err));
    } finally {
      setImporting(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (loadError) {
    return (
      <div className="page">
        <h1>Map</h1>
        <div className="card"><p className="error">Failed to load Google Maps. Check your API key.</p></div>
      </div>
    );
  }

  const placesToShow = layer === 'mine' ? myPlaces : squadPlaces;

  return (
    <div className="map-wrap" style={{ height: 'calc(100dvh - 76px)' }}>
      <div className="map-overlay">
        <div className="map-card">
          <div className="row">
            <span className="pill good">●</span>
            <span>{presence.filter(p => p.uid !== user?.uid).length} squad nearby</span>
            <span className="pill">{myPlaces.length} of your places</span>
          </div>
          <div className="layer-toggle" style={{ marginTop: 8 }}>
            <button className={'chip ' + (layer === 'squad' ? 'active' : '')} onClick={() => setLayer('squad')}>Squad</button>
            <button className={'chip ' + (layer === 'mine' ? 'active' : '')} onClick={() => setLayer('mine')}>My places</button>
            <button className="chip" onClick={() => fileRef.current?.click()}>📥 Timeline</button>
          </div>
          {importing && (
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Importing… {importing.done}/{importing.total}
            </div>
          )}
          {importMsg && (
            <div style={{ fontSize: 12, marginTop: 6, color: 'var(--muted)' }}>{importMsg}</div>
          )}
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onTimelineFile} />
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
          zoom={pos ? 14 : 11}
          options={{
            styles: mapStyles,
            disableDefaultUI: true,
            zoomControl: true,
            clickableIcons: false,
            gestureHandling: 'greedy'
          }}
        >
          {pos && (
            <>
              <CircleF
                center={pos}
                radius={60}
                options={{
                  fillColor: '#8b5cf6', fillOpacity: 0.12,
                  strokeColor: '#8b5cf6', strokeOpacity: 0.4, strokeWeight: 2
                }}
              />
              <MarkerF
                position={pos}
                title="You"
                icon={{
                  url: meIconUrl,
                  scaledSize: new google.maps.Size(64, 70),
                  anchor: new google.maps.Point(32, 70)
                }}
                onClick={() => setSelected('me')}
              >
                {selected === 'me' && (
                  <InfoWindowF position={pos} onCloseClick={() => setSelected(null)}>
                    <div style={{ color: '#111' }}>You ({user?.displayName})</div>
                  </InfoWindowF>
                )}
              </MarkerF>
            </>
          )}

          {layer === 'squad' && presence.filter(p => p.uid !== user?.uid).map(p => (
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

          {placesToShow.slice(0, 500).map((pl, i) => (
            <MarkerF
              key={`place-${layer}-${i}`}
              position={{ lat: pl.lat, lng: pl.lng }}
              title={pl.placeName}
              icon={placeIcon(layer === 'mine' ? '#8b5cf6' : '#f59e0b')}
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
    scaledSize: new google.maps.Size(34, 44),
    anchor: new google.maps.Point(17, 44)
  };
}
function squadIcon() { return svgMarker('#ec4899', '●'); }
function placeIcon(color: string) { return svgMarker(color, '★'); }
