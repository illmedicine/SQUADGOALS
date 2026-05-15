import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';
import { useAuth } from '../lib/AuthContext';
import { useLocation } from '../lib/useLocation';
import { watchUserSquads, type Squad } from '../lib/data';
import {
  watchMyTrips, createTrip, startTrip, completeTrip, deleteTrip, updateTrip,
  pathDistanceKm, type Trip, type TripStop, type TripVisibility
} from '../lib/trips';
import { awardXp, XP } from '../lib/prestige';

const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';
// Match the loader id used by MapPage so we don't double-load the SDK.
const MAP_LIBS: ('places')[] = ['places'];

function fmtDate(t: any): string {
  if (!t) return '';
  const ms = typeof t === 'number' ? t : (t?.toDate?.()?.getTime?.() || Date.parse(String(t)) || 0);
  if (!ms) return '';
  return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function TripsPage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (!user) return;
    return watchMyTrips(user.uid, setTrips);
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    return watchUserSquads(user.uid, setSquads);
  }, [user?.uid]);

  const active = useMemo(() => trips.filter(t => t.status === 'active'), [trips]);
  const planned = useMemo(() => trips.filter(t => t.status === 'planned'), [trips]);
  const past = useMemo(() => trips.filter(t => t.status === 'completed' || t.status === 'cancelled'), [trips]);

  if (!user) return null;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>🧭 Trips</h1>
        <button className="btn" style={{ width: 'auto' }} onClick={() => setShowNew(true)}>＋ New trip</button>
      </div>
      <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 13 }}>
        Plan stops in advance. Physically check in at each stop to earn achievements.
        Your squad watches your path cross the map in real time.
      </p>

      {active.length > 0 && (
        <>
          <h2 style={{ marginTop: 16, marginBottom: 6 }}>Active</h2>
          {active.map(t => <TripCard key={t.id} trip={t} squads={squads} live />)}
        </>
      )}

      {planned.length > 0 && (
        <>
          <h2 style={{ marginTop: 16, marginBottom: 6 }}>Planned</h2>
          {planned.map(t => <TripCard key={t.id} trip={t} squads={squads} />)}
        </>
      )}

      {past.length > 0 && (
        <>
          <h2 style={{ marginTop: 16, marginBottom: 6 }}>History</h2>
          {past.slice(0, 10).map(t => <TripCard key={t.id} trip={t} squads={squads} />)}
        </>
      )}

      {trips.length === 0 && (
        <div className="empty">No trips yet. Plan your first one — coffee crawl, road trip, gym circuit, anything with stops.</div>
      )}

      {showNew && (
        <NewTripModal
          squads={squads}
          onClose={() => setShowNew(false)}
          onCreate={async (draft) => {
          await createTrip({
            ownerId: user.uid,
            ownerName: user.displayName,
            title: draft.title,
            stops: draft.stops,
            visibility: draft.visibility,
            squadIds: draft.squadIds
          });
          setShowNew(false);
        }}
        />
      )}
    </div>
  );
}

function TripCard({ trip, squads, live }: { trip: Trip; squads: Squad[]; live?: boolean }) {
  const reached = trip.stops.filter(s => s.reachedAt).length;
  const total = trip.stops.length;
  const km = pathDistanceKm(trip.path);
  const vis = trip.visibility;
  const squadNames = trip.squadIds
    .map(id => squads.find(s => s.id === id)?.name)
    .filter(Boolean) as string[];

  async function onStart() {
    await startTrip(trip.id);
  }
  async function onComplete() {
    await completeTrip(trip.id);
    // Bank XP for finishing a planned journey.
    await awardXp(trip.ownerId, { xp: XP.PUBLIC_PIN, checkIns: reached });
  }
  async function onCancel() {
    if (!confirm('Cancel this trip?')) return;
    await updateTrip(trip.id, { status: 'cancelled', completedAt: Date.now() });
  }
  async function onDelete() {
    if (!confirm('Delete this trip permanently?')) return;
    await deleteTrip(trip.id);
  }

  return (
    <div className="card" style={live ? { background: 'linear-gradient(135deg,#0ea5e922,#8b5cf622)' } : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>
          {trip.title}
          {live && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', borderRadius: 999, background: '#ef4444', color: '#fff', fontWeight: 700 }}>● LIVE</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          {vis === 'public' ? '🌎 Public' : vis === 'squad' ? '👥 Squad' : '🔒 Private'}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
        {reached}/{total} stops reached
        {km > 0 && ` · ${km.toFixed(1)} km traveled`}
        {trip.startedAt && ` · started ${fmtDate(trip.startedAt)}`}
        {squadNames.length > 0 && ` · ${squadNames.join(', ')}`}
      </div>

      <ol style={{ margin: '8px 0 4px 18px', padding: 0, fontSize: 13 }}>
        {trip.stops.map((s, i) => (
          <li key={i} style={{ color: s.reachedAt ? '#22c55e' : '#334155', marginBottom: 2 }}>
            {s.reachedAt ? '✅ ' : '○ '}
            <strong>{s.placeName}</strong>
            {s.reachedAt && <span style={{ color: 'var(--muted)', fontSize: 11 }}> · {fmtDate(s.reachedAt)}</span>}
          </li>
        ))}
      </ol>

      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        {trip.status === 'planned' && (
          <button className="btn" style={{ width: 'auto', flex: 1 }} onClick={onStart}>▶ Start trip</button>
        )}
        {trip.status === 'active' && (
          <>
            <Link to="/" className="btn secondary" style={{ width: 'auto', flex: 1, textDecoration: 'none', textAlign: 'center' }}>
              View on map →
            </Link>
            <button className="btn" style={{ width: 'auto', flex: 1 }} onClick={onComplete}>✓ Finish</button>
          </>
        )}
        {(trip.status === 'planned' || trip.status === 'active') && (
          <button className="btn ghost" style={{ width: 'auto' }} onClick={onCancel}>Cancel</button>
        )}
        {(trip.status === 'completed' || trip.status === 'cancelled') && (
          <button className="btn ghost" style={{ width: 'auto' }} onClick={onDelete}>Delete</button>
        )}
      </div>
    </div>
  );
}

type Draft = {
  title: string;
  stops: TripStop[];
  visibility: TripVisibility;
  squadIds: string[];
};

function NewTripModal({ squads, onClose, onCreate }: {
  squads: Squad[];
  onClose: () => void;
  onCreate: (d: Draft) => Promise<void> | void;
}) {
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<TripVisibility>('squad');
  const [selectedSquads, setSelectedSquads] = useState<string[]>(squads.map(s => s.id));
  const [stops, setStops] = useState<TripStop[]>([
    { placeName: '', lat: 0, lng: 0 }
  ]);
  // Which stop is currently being placed via the embedded map (-1 = none).
  const [pickingIndex, setPickingIndex] = useState<number>(-1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pos } = useLocation({ enabled: true });

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    id: 'squadren-google-map',  // same id as MapPage — shares the loaded SDK
    libraries: MAP_LIBS
  });

  function updateStop(i: number, patch: Partial<TripStop>) {
    setStops(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }
  function addStop() {
    setStops(prev => [...prev, { placeName: '', lat: 0, lng: 0 }]);
  }
  function removeStop(i: number) {
    setStops(prev => prev.filter((_, idx) => idx !== i));
  }

  function canSave() {
    if (!title.trim()) return false;
    if (stops.length < 1) return false;
    return stops.every(s => s.placeName.trim() && isFinite(s.lat) && isFinite(s.lng) && (s.lat !== 0 || s.lng !== 0));
  }

  function submit() {
    if (!canSave() || submitting) return;
    // Build the payload by hand so we never send `undefined` fields —
    // Firestore rejects writes that contain undefined values, which was
    // silently breaking the Create button before.
    const cleanStops: TripStop[] = stops.map(s => {
      const stop: TripStop = {
        placeName: s.placeName.trim(),
        lat: Number(s.lat),
        lng: Number(s.lng)
      };
      if (s.note && s.note.trim()) stop.note = s.note.trim();
      return stop;
    });
    setSubmitting(true);
    setError(null);
    Promise.resolve(onCreate({
      title: title.trim(),
      stops: cleanStops,
      visibility,
      squadIds: visibility === 'squad' ? selectedSquads : []
    }))
      .catch(e => setError(e?.message || 'Could not create trip.'))
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Plan a trip</h2>
          <button onClick={onClose} aria-label="Close"
            style={{ background: '#eee', border: 'none', borderRadius: 999, width: 32, height: 32, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <label style={{ marginTop: 8, display: 'block' }}>Title</label>
        <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Saturday coffee crawl" />

        <label style={{ marginTop: 8, display: 'block' }}>Visibility</label>
        <select className="select" value={visibility} onChange={e => setVisibility(e.target.value as TripVisibility)}>
          <option value="private">🔒 Private (only me)</option>
          <option value="squad">👥 Squad (selected squads see live)</option>
          <option value="public">🌎 Public (world sees live)</option>
        </select>

        {visibility === 'squad' && squads.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {squads.map(s => {
              const on = selectedSquads.includes(s.id);
              return (
                <button key={s.id} type="button"
                  onClick={() => setSelectedSquads(prev => on ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                  style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 12, border: 'none', cursor: 'pointer',
                    background: on ? '#111' : '#f1f5f9', color: on ? '#fff' : '#334155', fontWeight: 600
                  }}>{s.name}</button>
              );
            })}
          </div>
        )}

        <h3 style={{ marginTop: 16, marginBottom: 4 }}>Stops</h3>
        <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>
          Add each place. You'll check in physically when your GPS gets within ~80m.
          Tip: paste lat,lng from Google Maps for accuracy.
        </p>

        {stops.map((s, i) => (
          <StopEditor
            key={i}
            stop={s}
            index={i}
            canRemove={stops.length > 1}
            picking={pickingIndex === i}
            onPick={() => setPickingIndex(pickingIndex === i ? -1 : i)}
            onUseMyLocation={pos ? () => updateStop(i, { lat: pos.lat, lng: pos.lng }) : undefined}
            onChange={patch => updateStop(i, patch)}
            onRemove={() => removeStop(i)}
          />
        ))}

        {pickingIndex >= 0 && (
          <MapPicker
            isLoaded={isLoaded}
            center={
              stops[pickingIndex] && (stops[pickingIndex].lat || stops[pickingIndex].lng)
                ? { lat: stops[pickingIndex].lat, lng: stops[pickingIndex].lng }
                : pos || { lat: 37.7749, lng: -122.4194 }
            }
            markedStops={stops.map((s, i) => ({ lat: s.lat, lng: s.lng, idx: i }))
              .filter(s => s.lat || s.lng)}
            activeIndex={pickingIndex}
            onPick={(lat, lng) => updateStop(pickingIndex, { lat, lng })}
            onDone={() => setPickingIndex(-1)}
          />
        )}

        <button type="button" className="btn ghost" style={{ marginTop: 6 }} onClick={addStop}>＋ Add stop</button>

        {error && (
          <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>⚠ {error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn" style={{ flex: 2 }} disabled={!canSave() || submitting} onClick={submit}>
            {submitting ? 'Creating…' : 'Create trip'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StopEditor({ stop, index, canRemove, picking, onChange, onRemove, onPick, onUseMyLocation }: {
  stop: TripStop;
  index: number;
  canRemove: boolean;
  picking: boolean;
  onChange: (p: Partial<TripStop>) => void;
  onRemove: () => void;
  onPick: () => void;
  onUseMyLocation?: () => void;
}) {
  const [pasteCoords, setPasteCoords] = useState('');

  function applyPaste(v: string) {
    setPasteCoords(v);
    const m = v.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
    if (m) {
      onChange({ lat: Number(m[1]), lng: Number(m[2]) });
    }
  }

  const hasCoords = !!(stop.lat || stop.lng);

  return (
    <div style={{ padding: 8, border: '1px solid #eee', borderRadius: 10, marginTop: 8, background: '#fafafa' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 13 }}>Stop {index + 1}{hasCoords ? ' ✓' : ''}</strong>
        {canRemove && (
          <button type="button" onClick={onRemove}
            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Remove</button>
        )}
      </div>
      <input className="input" placeholder="Place name (e.g. Stumptown Coffee)"
        value={stop.placeName} onChange={e => onChange({ placeName: e.target.value })} />

      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
        <button type="button"
          onClick={onPick}
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 12,
            background: picking ? '#0ea5e9' : '#e0f2fe', color: picking ? '#fff' : '#0369a1'
          }}>
          {picking ? '✓ Picking on map…' : '🗺️ Pick on map'}
        </button>
        {onUseMyLocation && (
          <button type="button"
            onClick={onUseMyLocation}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 12, background: '#dcfce7', color: '#166534'
            }}>📍 Use my location</button>
        )}
      </div>

      <details style={{ marginTop: 6 }}>
        <summary style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer' }}>
          Or paste/enter coordinates manually
        </summary>
        <input className="input" placeholder="Paste 'lat, lng' from Google Maps"
          value={pasteCoords} onChange={e => applyPaste(e.target.value)} />
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="input" type="number" step="0.000001" placeholder="lat"
            value={stop.lat || ''} onChange={e => onChange({ lat: Number(e.target.value) })} />
          <input className="input" type="number" step="0.000001" placeholder="lng"
            value={stop.lng || ''} onChange={e => onChange({ lng: Number(e.target.value) })} />
        </div>
      </details>
    </div>
  );
}

function MapPicker({ isLoaded, center, markedStops, activeIndex, onPick, onDone }: {
  isLoaded: boolean;
  center: { lat: number; lng: number };
  markedStops: { lat: number; lng: number; idx: number }[];
  activeIndex: number;
  onPick: (lat: number, lng: number) => void;
  onDone: () => void;
}) {
  const mapRef = useRef<google.maps.Map | null>(null);
  if (!isLoaded) {
    return <div style={{ padding: 12, color: 'var(--muted)', fontSize: 12 }}>Loading map…</div>;
  }
  return (
    <div style={{ marginTop: 8, border: '2px solid #0ea5e9', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ background: '#0ea5e9', color: '#fff', fontSize: 12, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Tap the map to set Stop {activeIndex + 1}</span>
        <button type="button" onClick={onDone}
          style={{ background: '#fff', color: '#0369a1', border: 'none', borderRadius: 999, padding: '2px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
          Done
        </button>
      </div>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: 260 }}
        center={center}
        zoom={center.lat || center.lng ? 14 : 11}
        options={{ disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', clickableIcons: false, draggableCursor: 'crosshair' }}
        onLoad={m => { mapRef.current = m; }}
        onClick={e => {
          if (!e.latLng) return;
          onPick(e.latLng.lat(), e.latLng.lng());
        }}
      >
        {markedStops.map(s => (
          <MarkerF key={s.idx} position={{ lat: s.lat, lng: s.lng }}
            label={{ text: String(s.idx + 1), color: '#fff', fontSize: '11px', fontWeight: '700' }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: s.idx === activeIndex ? '#0ea5e9' : '#8b5cf6',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2
            }} />
        ))}
      </GoogleMap>
    </div>
  );
}
