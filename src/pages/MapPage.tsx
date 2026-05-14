import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, CircleF, HeatmapLayerF
} from '@react-google-maps/api';
import { useAuth, defaultAvatar } from '../lib/AuthContext';
import { useLocation } from '../lib/useLocation';
import {
  updatePresence, watchSquadPresence, watchUserSquads, watchVisitedPlaces,
  watchMyVisitedPlaces, maybeAutoLogVisit, parseGoogleTimeline, importTimelinePins,
  logVisitedPlace,
  type Presence, type Squad, type VisitedPlace
} from '../lib/data';
import { tickBadges } from '../lib/badges';
import Avatar, { avatarToDataUrl } from '../components/Avatar';
import {
  createPublicPin, watchPublicPins, addComment, watchComments,
  type PublicPin, type PinComment
} from '../lib/publicPins';
import { awardXp, XP } from '../lib/prestige';

const containerStyle: React.CSSProperties = { width: '100%', height: '100%' };
const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

// `visualization` library required for HeatmapLayer. Static array reference
// because the loader requires a stable identity to avoid re-loading.
const LIBRARIES: ('visualization')[] = ['visualization'];

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

type Layer = 'squad' | 'mine' | 'public';

const CATEGORIES = ['Coffee', 'Food', 'Bar', 'Venue', 'Park', 'Shopping', 'Work', 'Other'];

export default function MapPage() {
  const { user } = useAuth();
  const [share, setShare] = useState<boolean>(() => localStorage.getItem('squadren.share') !== 'false');
  const [layer, setLayer] = useState<Layer>('public');
  const [heat, setHeat] = useState<boolean>(true);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [squadPlaces, setSquadPlaces] = useState<VisitedPlace[]>([]);
  const [myPlaces, setMyPlaces] = useState<VisitedPlace[]>([]);
  const [publicPins, setPublicPins] = useState<PublicPin[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { pos, error } = useLocation({ enabled: !!user });

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    id: 'squadren-google-map',
    libraries: LIBRARIES
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
  useEffect(() => watchPublicPins(setPublicPins), []);
  useEffect(() => {
    if (!user) return;
    return watchMyVisitedPlaces(user.uid, setMyPlaces);
  }, [user?.uid]);

  useEffect(() => {
    if (!user || !pos) return;
    updatePresence({
      uid: user.uid, displayName: user.displayName,
      lat: pos.lat, lng: pos.lng,
      placeName: null, squadIds, shareLocation: share
    });
    const mates = presence.filter(p => p.uid !== user.uid).map(p => ({ lat: p.lat, lng: p.lng }));
    tickBadges(pos, mates);
    maybeAutoLogVisit(user.uid, user.displayName, pos, myPlaces).catch(() => {});
  }, [pos?.lat, pos?.lng, share, squadIds.join(',')]);

  const center = pos || { lat: 37.7749, lng: -122.4194 };
  const myAvatar = user?.avatar || defaultAvatar;
  const meIconUrl = useMemo(() => avatarToDataUrl(myAvatar), [JSON.stringify(myAvatar)]);

  // Heat map points combine live presence + public pins + (when relevant)
  // squad check-ins. Only generated after the maps API is ready because
  // google.maps.LatLng must exist.
  const heatPoints = useMemo(() => {
    if (!isLoaded || !heat) return [] as google.maps.LatLng[];
    const out: google.maps.LatLng[] = [];
    presence.forEach(p => p.shareLocation && out.push(new google.maps.LatLng(p.lat, p.lng)));
    publicPins.forEach(p => out.push(new google.maps.LatLng(p.lat, p.lng)));
    squadPlaces.slice(0, 300).forEach(p => out.push(new google.maps.LatLng(p.lat, p.lng)));
    return out;
  }, [isLoaded, heat, presence, publicPins, squadPlaces]);

  async function onTimelineFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    setImportMsg(null);
    const text = await f.text();
    const pins = parseGoogleTimeline(text);
    if (pins.length === 0) {
      setImportMsg('Could not find places in that file. Try Records.json, monthly Semantic Location History, or the new Timeline.json.');
      return;
    }
    const capped = pins.slice(0, 2000);
    setImporting({ done: 0, total: capped.length });
    try {
      await importTimelinePins(user.uid, user.displayName, capped, (d, t) => setImporting({ done: d, total: t }));
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

  return (
    <div className="map-wrap" style={{ height: 'calc(100dvh - 76px)' }}>
      <div className="map-overlay">
        <div className="map-card">
          <div className="row">
            <span className="pill good">●</span>
            <span>{presence.filter(p => p.uid !== user?.uid).length} squad nearby</span>
            <span className="pill">{publicPins.length} public pins</span>
          </div>
          <div className="layer-toggle" style={{ marginTop: 8 }}>
            <button className={'chip ' + (layer === 'public' ? 'active' : '')} onClick={() => setLayer('public')}>🌎 Public</button>
            <button className={'chip ' + (layer === 'squad' ? 'active' : '')} onClick={() => setLayer('squad')}>👥 Squad</button>
            <button className={'chip ' + (layer === 'mine' ? 'active' : '')} onClick={() => setLayer('mine')}>📍 Mine</button>
            <button className={'chip ' + (heat ? 'active' : '')} onClick={() => setHeat(h => !h)}>🔥 Heat</button>
            <button className="chip" onClick={() => fileRef.current?.click()}>📥 Timeline</button>
          </div>
          {importing && (
            <div style={{ fontSize: 12, marginTop: 6 }}>Importing… {importing.done}/{importing.total}</div>
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
            Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>.env.local</code>, then restart the dev server.
          </p>
        </div>
      ) : !isLoaded ? (
        <div className="center">Loading map…</div>
      ) : (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={pos ? 14 : 11}
          options={{
            styles: mapStyles, disableDefaultUI: true, zoomControl: true,
            clickableIcons: false, gestureHandling: 'greedy'
          }}
        >
          {heat && heatPoints.length > 0 && (
            <HeatmapLayerF
              data={heatPoints}
              options={{
                radius: 38,
                opacity: 0.6,
                gradient: [
                  'rgba(139, 92, 246, 0)',
                  'rgba(139, 92, 246, 0.5)',
                  'rgba(236, 72, 153, 0.6)',
                  'rgba(251, 191, 36, 0.7)',
                  'rgba(239, 68, 68, 0.85)'
                ]
              }}
            />
          )}

          {pos && (
            <>
              <CircleF center={pos} radius={60}
                options={{ fillColor: '#8b5cf6', fillOpacity: 0.12, strokeColor: '#8b5cf6', strokeOpacity: 0.4, strokeWeight: 2 }} />
              <MarkerF
                position={pos} title="You"
                icon={{ url: meIconUrl, scaledSize: new google.maps.Size(64, 70), anchor: new google.maps.Point(32, 70) }}
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
            <MarkerF key={p.uid} position={{ lat: p.lat, lng: p.lng }} title={p.displayName}
              icon={squadIcon()} onClick={() => setSelected(p.uid)}>
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

          {layer === 'mine' && myPlaces.slice(0, 500).map((pl, i) => (
            <MarkerF key={`mine-${i}`} position={{ lat: pl.lat, lng: pl.lng }}
              title={pl.placeName} icon={placeIcon('#8b5cf6')} />
          ))}

          {layer === 'public' && publicPins.map(pp => (
            <MarkerF key={pp.id} position={{ lat: pp.lat, lng: pp.lng }} title={pp.placeName}
              icon={publicIcon(pp.category)} onClick={() => setSelected('pp:' + pp.id)}>
              {selected === 'pp:' + pp.id && (
                <InfoWindowF position={{ lat: pp.lat, lng: pp.lng }} onCloseClick={() => setSelected(null)}>
                  <PublicPinDetail pin={pp} />
                </InfoWindowF>
              )}
            </MarkerF>
          ))}
        </GoogleMap>
      )}

      <button className="fab" onClick={() => setDropOpen(true)} disabled={!pos}
        title={pos ? 'Drop a public pin here' : 'Waiting for GPS…'}>
        ＋
      </button>

      {dropOpen && pos && user && (
        <DropPinModal
          pos={pos}
          onClose={() => setDropOpen(false)}
          onSubmit={async (data) => {
            const id = await createPublicPin({
              uid: user.uid,
              displayName: user.displayName,
              avatar: user.avatar || defaultAvatar,
              placeName: data.placeName,
              category: data.category,
              comment: data.comment,
              rating: data.rating,
              lat: pos.lat, lng: pos.lng
            });
            // Also log a private check-in + XP.
            await logVisitedPlace({
              uid: user.uid, displayName: user.displayName,
              placeName: data.placeName, category: data.category,
              lat: pos.lat, lng: pos.lng
            }).catch(() => {});
            await awardXp(user.uid, {
              xp: XP.PUBLIC_PIN + XP.CHECK_IN + (data.rating ? XP.REVIEW : 0),
              publicPins: 1, checkIns: 1, reviews: data.rating ? 1 : 0
            });
            setDropOpen(false);
            setSelected('pp:' + id);
          }}
        />
      )}
    </div>
  );
}

function svgMarker(fill: string, label = ''): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="56" viewBox="0 0 44 56">
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
function placeIcon(c: string) { return svgMarker(c, '★'); }
function publicIcon(category: string) {
  const map: Record<string, [string, string]> = {
    Coffee:   ['#92400e', '☕'],
    Food:     ['#dc2626', '🍔'],
    Bar:      ['#7c3aed', '🍻'],
    Venue:    ['#0ea5e9', '🎤'],
    Park:     ['#16a34a', '🌳'],
    Shopping: ['#ec4899', '🛍'],
    Work:     ['#475569', '💼'],
    Other:    ['#f59e0b', '⭐']
  };
  const [color, emoji] = map[category] || map.Other;
  return svgMarker(color, emoji);
}

function PublicPinDetail({ pin }: { pin: PublicPin }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<PinComment[]>([]);
  const [text, setText] = useState('');
  const [rating, setRating] = useState(0);
  const [posting, setPosting] = useState(false);

  useEffect(() => watchComments(pin.id, setComments), [pin.id]);

  async function submit() {
    if (!user || (!text.trim() && !rating)) return;
    setPosting(true);
    try {
      await addComment(pin.id, {
        uid: user.uid,
        displayName: user.displayName,
        avatar: user.avatar || defaultAvatar,
        text: text.trim(),
        rating
      });
      await awardXp(user.uid, {
        xp: rating ? XP.REVIEW : XP.COMMENT,
        comments: 1,
        reviews: rating ? 1 : 0
      });
      setText(''); setRating(0);
    } finally { setPosting(false); }
  }

  const avgFromList = comments.filter(c => c.rating > 0);
  const avg = avgFromList.length
    ? avgFromList.reduce((s, c) => s + c.rating, 0) / avgFromList.length
    : (pin.avgRating || pin.rating || 0);

  return (
    <div style={{ color: '#111', minWidth: 240, maxWidth: 280 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden', background: '#fef3c7', flex: '0 0 36px' }}>
          {pin.avatar && <Avatar config={pin.avatar} size={36} headOnly />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{pin.placeName}</div>
          <div style={{ fontSize: 11, color: '#666' }}>
            {pin.category} · by {pin.displayName}
          </div>
        </div>
      </div>
      {avg > 0 && (
        <div style={{ marginTop: 6 }}>
          <Stars value={avg} /> <span style={{ fontSize: 11, color: '#666' }}>({avgFromList.length || (pin.reviewCount || 0)})</span>
        </div>
      )}
      {pin.comment && <div style={{ marginTop: 6, fontSize: 13 }}>{pin.comment}</div>}

      <div style={{ marginTop: 10, borderTop: '1px solid #eee', paddingTop: 8, maxHeight: 140, overflowY: 'auto' }}>
        {comments.length === 0 && <div style={{ fontSize: 11, color: '#999' }}>Be the first to comment.</div>}
        {comments.map(c => (
          <div key={c.id} style={{ fontSize: 12, marginBottom: 6 }}>
            <strong>{c.displayName}</strong>
            {c.rating > 0 && <> <Stars value={c.rating} small /></>}
            <div>{c.text}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexDirection: 'column' }}>
        <StarPicker value={rating} onChange={setRating} />
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Leave a comment or review…"
          rows={2}
          style={{ width: '100%', boxSizing: 'border-box', resize: 'none', fontSize: 12, padding: 6, borderRadius: 8, border: '1px solid #ddd' }}
        />
        <button className="btn" disabled={posting || (!text.trim() && !rating)} onClick={submit} style={{ padding: '6px 10px' }}>
          {posting ? 'Posting…' : (rating ? 'Post review' : 'Post comment')}
        </button>
      </div>
    </div>
  );
}

function Stars({ value, small }: { value: number; small?: boolean }) {
  const full = Math.round(value);
  return (
    <span style={{ color: '#f59e0b', fontSize: small ? 11 : 13 }}>
      {'★'.repeat(full)}<span style={{ color: '#ddd' }}>{'★'.repeat(5 - full)}</span>
    </span>
  );
}
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(value === n ? 0 : n)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 0, color: n <= value ? '#f59e0b' : '#ccc' }}>
          ★
        </button>
      ))}
    </div>
  );
}

type DropData = { placeName: string; category: string; comment: string; rating: number };

function DropPinModal({ pos, onClose, onSubmit }: {
  pos: { lat: number; lng: number };
  onClose: () => void;
  onSubmit: (d: DropData) => Promise<void>;
}) {
  const [placeName, setPlaceName] = useState('');
  const [category, setCategory] = useState('Coffee');
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!placeName.trim()) return;
    setBusy(true);
    try { await onSubmit({ placeName: placeName.trim(), category, comment: comment.trim(), rating }); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>📍 Drop a public pin</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          Anyone in the world using Squad REN will see this pin and can comment on it.
        </p>
        <label>Place name</label>
        <input className="input" value={placeName} onChange={e => setPlaceName(e.target.value)} placeholder="e.g. Joe's Coffee" />
        <label>Category</label>
        <select className="select" value={category} onChange={e => setCategory(e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <label>Your review (optional)</label>
        <StarPicker value={rating} onChange={setRating} />
        <textarea className="input" value={comment} onChange={e => setComment(e.target.value)}
          placeholder="What's it like? Any tips?" rows={3} style={{ resize: 'none' }} />
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          Location: {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <button className="btn secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn" onClick={go} disabled={busy || !placeName.trim()} style={{ flex: 2 }}>
            {busy ? 'Posting…' : 'Drop pin'}
          </button>
        </div>
      </div>
    </div>
  );
}
