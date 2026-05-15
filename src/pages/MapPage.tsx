import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, CircleF, HeatmapLayerF
} from '@react-google-maps/api';
import { useAuth, defaultAvatar } from '../lib/AuthContext';
import { useLocation } from '../lib/useLocation';
import {
  updatePresence, watchSquadPresence, watchPublicPresence, watchUserSquads, watchVisitedPlaces,
  watchMyVisitedPlaces, maybeAutoLogVisit, parseGoogleTimeline, importTimelinePins,
  logVisitedPlace, listDemoSquads, watchPublicSquadsLive, updateSquadHq, requestJoinSquad,
  type Presence, type Squad, type VisitedPlace, type DemoSquad
} from '../lib/data';
import { tickBadges } from '../lib/badges';
import Avatar, { avatarToDataUrl } from '../components/Avatar';
import TimelineTutorial from '../components/TimelineTutorial';
import {
  createPublicPin, watchPublicPins, addComment, watchComments,
  type PublicPin, type PinComment, type PinVisibility
} from '../lib/publicPins';
import { awardXp, XP } from '../lib/prestige';
import { TIERS } from '../lib/prestige';
import { squadPrestige } from '../lib/demoSeed';
import { getLogo, DEFAULT_LOGO_ID } from '../lib/squadLogos';

const containerStyle: React.CSSProperties = { width: '100%', height: '100%' };
const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

// Build a fast bbox-contains predicate; falls back to "always true" if no
// bbox has been recorded yet (first render before the map is idle).
function makeBoxFilter(b: { n: number; s: number; e: number; w: number } | null) {
  if (!b) return (_lat: number, _lng: number) => true;
  // Handle bboxes that cross the antimeridian (e: < w:).
  const crosses = b.e < b.w;
  return (lat: number, lng: number) => {
    if (lat < b.s || lat > b.n) return false;
    if (crosses) return lng >= b.w || lng <= b.e;
    return lng >= b.w && lng <= b.e;
  };
}

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
  const [sharePublic, setSharePublic] = useState<boolean>(() => localStorage.getItem('squadren.sharePublic') === 'true');
  const [layer, setLayer] = useState<Layer>('public');
  const [heat, setHeat] = useState<boolean>(true);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [publicPresence, setPublicPresence] = useState<Presence[]>([]);
  const [squadPlaces, setSquadPlaces] = useState<VisitedPlace[]>([]);
  const [myPlaces, setMyPlaces] = useState<VisitedPlace[]>([]);
  const [publicPins, setPublicPins] = useState<PublicPin[]>([]);
  // Real (non-demo) public squads with an HQ pinned on the map.
  const [publicSquads, setPublicSquads] = useState<Squad[]>([]);
  // HQ-drop mode: leader is placing their squad headquarters on the map.
  const [searchParams, setSearchParams] = useSearchParams();
  const setHqId = searchParams.get('setHq');
  const [hqDropPos, setHqDropPos] = useState<{ lat: number; lng: number } | null>(null);
  // The 500 demo squads ship with the app; computed once.
  const demoSquadList = useMemo<DemoSquad[]>(() => listDemoSquads(), []);
  const [selected, setSelected] = useState<string | null>(null);
  // Track viewport so we only render markers/heat inside the visible bbox.
  // Updated on idle (debounced by Google internally) to avoid thrashing.
  const mapRef = useRef<google.maps.Map | null>(null);
  const [bbox, setBbox] = useState<{ n: number; s: number; e: number; w: number } | null>(null);
  const [zoom, setZoom] = useState<number>(11);
  const [showTutorial, setShowTutorial] = useState<boolean>(() => localStorage.getItem('squadren.timelineTutorialSeen') !== 'true');
  // Two-step pin drop flow: user taps "+" to enter drop mode, then taps
  // anywhere on the map (or drags the preview marker) to pick a spot;
  // confirming opens the metadata modal. dropPos holds the chosen lat/lng.
  const [dropMode, setDropMode] = useState(false);
  const [dropPos, setDropPos] = useState<{ lat: number; lng: number } | null>(null);
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
  useEffect(() => { localStorage.setItem('squadren.sharePublic', String(sharePublic)); }, [sharePublic]);

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
  useEffect(() => watchPublicPins(setPublicPins, { viewerUid: user?.uid || '', viewerSquadIds: squadIds }),
    [user?.uid, squadIds.join(',')]);
  useEffect(() => watchPublicPresence(setPublicPresence), []);
  useEffect(() => watchPublicSquadsLive(setPublicSquads), []);
  useEffect(() => {
    if (!user) return;
    return watchMyVisitedPlaces(user.uid, setMyPlaces);
  }, [user?.uid]);

  useEffect(() => {
    if (!user || !pos) return;
    updatePresence({
      uid: user.uid, displayName: user.displayName,
      avatar: user.avatar || defaultAvatar,
      lat: pos.lat, lng: pos.lng,
      placeName: null, squadIds,
      shareLocation: share,
      sharePublic: share && sharePublic
    });
    const mates = presence.filter(p => p.uid !== user.uid).map(p => ({ lat: p.lat, lng: p.lng }));
    tickBadges(pos, mates);
    maybeAutoLogVisit(user.uid, user.displayName, pos, myPlaces).catch(() => {});
    // Intentionally exclude `presence` and `myPlaces` from deps — we only
    // want to push presence when *our* position/share state changes, not on
    // every incoming squad-mate update (which was causing repeated re-renders
    // and the "snap back to my location" feel while panning).
  }, [pos?.lat, pos?.lng, share, sharePublic, squadIds.join(',')]);

  // Stable map center: capture the first known position and never change it
  // again, so panning around doesn't get yanked back by GPS updates.
  const initialCenter = useRef<{ lat: number; lng: number } | null>(null);
  if (!initialCenter.current && pos) initialCenter.current = pos;
  const center = initialCenter.current || { lat: 37.7749, lng: -122.4194 };
  const myAvatar = user?.avatar || defaultAvatar;
  const meIconUrl = useMemo(() => avatarToDataUrl(myAvatar), [JSON.stringify(myAvatar)]);

  // Heat map points combine live presence + public pins + (when relevant)
  // squad check-ins. Only generated after the maps API is ready because
  // google.maps.LatLng must exist. Filtered to viewport + capped at low
  // zoom levels to keep the heat layer responsive.
  const heatPoints = useMemo(() => {
    if (!isLoaded || !heat) return [] as google.maps.LatLng[];
    const inBox = makeBoxFilter(bbox);
    const cap = zoom < 4 ? 400 : zoom < 7 ? 1500 : 4000;
    const out: google.maps.LatLng[] = [];
    const push = (lat: number, lng: number) => {
      if (out.length >= cap) return;
      if (!inBox(lat, lng)) return;
      out.push(new google.maps.LatLng(lat, lng));
    };
    presence.forEach(p => p.shareLocation && push(p.lat, p.lng));
    publicPresence.forEach(p => push(p.lat, p.lng));
    publicPins.forEach(p => push(p.lat, p.lng));
    squadPlaces.slice(0, 300).forEach(p => push(p.lat, p.lng));
    return out;
  }, [isLoaded, heat, presence, publicPresence, publicPins, squadPlaces, bbox, zoom]);

  // Per-layer marker subsets, filtered to the current viewport and capped
  // at zoom-dependent limits so a continent-wide zoom never tries to render
  // thousands of DOM markers at once.
  const visibleSquads = useMemo(() => {
    const inBox = makeBoxFilter(bbox);
    const cap = zoom < 4 ? 60 : zoom < 6 ? 150 : zoom < 9 ? 300 : 500;
    return demoSquadList.filter(s => inBox(s.lat, s.lng)).slice(0, cap);
  }, [demoSquadList, bbox, zoom]);
  const visiblePublicPresence = useMemo(() => {
    if (zoom < 5) return []; // hide individual people at world zoom
    const inBox = makeBoxFilter(bbox);
    const cap = zoom < 7 ? 80 : zoom < 10 ? 200 : 500;
    return publicPresence.filter(p => p.uid !== user?.uid && inBox(p.lat, p.lng)).slice(0, cap);
  }, [publicPresence, bbox, zoom, user?.uid]);
  const visiblePublicPins = useMemo(() => {
    if (zoom < 4) return [];
    const inBox = makeBoxFilter(bbox);
    const cap = zoom < 6 ? 120 : zoom < 9 ? 300 : 800;
    return publicPins.filter(p => inBox(p.lat, p.lng)).slice(0, cap);
  }, [publicPins, bbox, zoom]);

  async function onTimelineFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !user) return;
    setImportMsg(null);

    // Parse every selected file and merge — supports dropping the whole
    // "Maps (your places)" + "Location History" + "Saved" set at once.
    const allPins: ReturnType<typeof parseGoogleTimeline> = [];
    for (const f of files) {
      try {
        const text = await f.text();
        const pins = parseGoogleTimeline(text, f.name);
        allPins.push(...pins);
      } catch (err) {
        console.warn('[import] failed to read', f.name, err);
      }
    }

    // Final dedupe across files (rounded coords + name).
    const seen = new Set<string>();
    const merged = allPins.filter(p => {
      const key = p.lat.toFixed(3) + ',' + p.lng.toFixed(3) + '|' + p.placeName;
      if (seen.has(key)) return false; seen.add(key); return true;
    });

    if (merged.length === 0) {
      setImportMsg('No places found. Supported: Records.json, Timeline.json, Semantic Location History, Saved Places.json, Reviews.json, or Saved/*.csv.');
      return;
    }
    const capped = merged.slice(0, 2000);
    setImporting({ done: 0, total: capped.length });
    try {
      await importTimelinePins(user.uid, user.displayName, capped, (d, t) => setImporting({ done: d, total: t }));
      const cats = new Set(capped.map(p => p.category || 'Timeline'));
      setImportMsg(`Imported ${capped.length} places (${[...cats].join(', ')}).`);
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
            <span className="pill">{Math.max(0, publicPresence.filter(p => p.uid !== user?.uid).length)} public</span>
            <span className="pill">{publicPins.length} pins</span>
            <span className="pill">{demoSquadList.length} squads</span>
          </div>
          <div className="layer-toggle" style={{ marginTop: 8 }}>
            <button className={'chip ' + (layer === 'public' ? 'active' : '')} onClick={() => setLayer('public')}>🌎 Public</button>
            <button className={'chip ' + (layer === 'squad' ? 'active' : '')} onClick={() => setLayer('squad')}>👥 Squad</button>
            <button className={'chip ' + (layer === 'mine' ? 'active' : '')} onClick={() => setLayer('mine')}>📍 Mine</button>
            <button className={'chip ' + (heat ? 'active' : '')} onClick={() => setHeat(h => !h)}>🔥 Heat</button>
            <button className="chip" onClick={() => fileRef.current?.click()}>📥 Import Maps</button>
            <button className="chip" onClick={() => setShowTutorial(true)} title="How to import Google Timeline">❓ Help</button>
          </div>
          {importing && (
            <div style={{ fontSize: 12, marginTop: 6 }}>Importing… {importing.done}/{importing.total}</div>
          )}
          {importMsg && (
            <div style={{ fontSize: 12, marginTop: 6, color: 'var(--muted)' }}>{importMsg}</div>
          )}
          <input ref={fileRef} type="file" multiple accept=".json,.csv,application/json,text/csv" style={{ display: 'none' }} onChange={onTimelineFile} />
        </div>
        <div className="share-stack">
          <button className={'share-toggle ' + (share ? 'on' : '')} onClick={() => setShare(s => !s)}>
            {share ? '📍 Sharing' : '🚫 Hidden'}
          </button>
          <button
            className={'share-toggle small ' + (sharePublic && share ? 'on' : '')}
            onClick={() => setSharePublic(s => !s)}
            disabled={!share}
            title={share ? 'Be visible on the world map' : 'Turn on sharing first'}
          >
            {sharePublic && share ? '🌎 Public' : '👥 Squad only'}
          </button>
        </div>
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
            clickableIcons: false, gestureHandling: 'greedy',
            draggableCursor: (dropMode || setHqId) ? 'crosshair' : undefined
          }}
          onLoad={m => {
            mapRef.current = m;
            // Seed bbox immediately so the first render isn't unfiltered.
            const b = m.getBounds();
            if (b) {
              const ne = b.getNorthEast(), sw = b.getSouthWest();
              setBbox({ n: ne.lat(), s: sw.lat(), e: ne.lng(), w: sw.lng() });
            }
            setZoom(m.getZoom() || 11);
          }}
          onIdle={() => {
            const m = mapRef.current; if (!m) return;
            const b = m.getBounds();
            if (b) {
              const ne = b.getNorthEast(), sw = b.getSouthWest();
              setBbox({ n: ne.lat(), s: sw.lat(), e: ne.lng(), w: sw.lng() });
            }
            const z = m.getZoom(); if (typeof z === 'number') setZoom(z);
          }}
          onClick={e => {
            if (!e.latLng) return;
            if (setHqId) {
              setHqDropPos({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              return;
            }
            if (dropMode) {
              setDropPos({ lat: e.latLng.lat(), lng: e.latLng.lng() });
            }
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

          {/* Public layer also shows every user who opted in to public sharing,
              even if they aren't in any of your squads. */}
          {layer === 'public' && visiblePublicPresence.map(p => (
            <MarkerF key={'pub-' + p.uid} position={{ lat: p.lat, lng: p.lng }} title={p.displayName + ' (public)'}
              icon={publicPersonIcon()} onClick={() => setSelected('pub-' + p.uid)}>
              {selected === 'pub-' + p.uid && (
                <InfoWindowF position={{ lat: p.lat, lng: p.lng }} onCloseClick={() => setSelected(null)}>
                  <div style={{ color: '#111' }}>
                    <strong>{p.displayName}</strong>
                    <div style={{ fontSize: 11, color: '#666' }}>Sharing publicly 🌎</div>
                  </div>
                </InfoWindowF>
              )}
            </MarkerF>
          ))}

          {/* Public squads — each marker is colored by the squad's prestige tier. */}
          {layer === 'public' && visibleSquads.map(sq => (
            <MarkerF key={'sq-' + sq.id} position={{ lat: sq.lat, lng: sq.lng }} title={sq.name}
              icon={squadBadgeIcon(squadPrestige(sq.stats))}
              onClick={() => setSelected('sq-' + sq.id)}>
              {selected === 'sq-' + sq.id && (
                <InfoWindowF position={{ lat: sq.lat, lng: sq.lng }} onCloseClick={() => setSelected(null)}>
                  <SquadDetail squad={sq} onClose={() => setSelected(null)} />
                </InfoWindowF>
              )}
            </MarkerF>
          ))}

          {layer === 'mine' && myPlaces.slice(0, 500).map((pl, i) => (
            <MarkerF key={`mine-${i}`} position={{ lat: pl.lat, lng: pl.lng }}
              title={pl.placeName} icon={placeIcon('#8b5cf6')} />
          ))}

          {layer === 'public' && visiblePublicPins.map(pp => (
            <MarkerF key={pp.id} position={{ lat: pp.lat, lng: pp.lng }} title={pp.placeName}
              icon={publicIcon(pp.category)} onClick={() => setSelected('pp:' + pp.id)}>
              {selected === 'pp:' + pp.id && (
                <InfoWindowF position={{ lat: pp.lat, lng: pp.lng }} onCloseClick={() => setSelected(null)}>
                  <PublicPinDetail pin={pp} onClose={() => setSelected(null)} />
                </InfoWindowF>
              )}
            </MarkerF>
          ))}

          {dropMode && dropPos && (
            <MarkerF
              position={dropPos}
              draggable
              onDragEnd={e => {
                if (!e.latLng) return;
                setDropPos({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              }}
              icon={dropPreviewIcon()}
              zIndex={9999}
            />
          )}

          {/* Real public squad HQ pins (organic squads created by users). */}
          {layer === 'public' && publicSquads.filter(s => s.hq).map(s => {
            const logo = getLogo(s.logo || DEFAULT_LOGO_ID);
            return (
              <MarkerF key={'hq-' + s.id} position={{ lat: s.hq!.lat, lng: s.hq!.lng }} title={s.name + ' HQ'}
                icon={hqIcon(logo.glyph, logo.bg)}
                onClick={() => setSelected('hq:' + s.id)}>
                {selected === 'hq:' + s.id && (
                  <InfoWindowF position={{ lat: s.hq!.lat, lng: s.hq!.lng }} onCloseClick={() => setSelected(null)}>
                    <SquadHqDetail
                      squad={s}
                      isMember={!!user && s.members.includes(user.uid)}
                      isLeader={!!user && s.ownerId === user.uid}
                      isPending={!!user && (s.pendingMembers || []).includes(user.uid)}
                      onRequestJoin={() => user && requestJoinSquad(s.id, user.uid)}
                      onClose={() => setSelected(null)}
                    />
                  </InfoWindowF>
                )}
              </MarkerF>
            );
          })}

          {/* HQ-drop preview marker (leader is placing their squad HQ). */}
          {setHqId && hqDropPos && (
            <MarkerF position={hqDropPos} draggable
              onDragEnd={e => e.latLng && setHqDropPos({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
              icon={dropPreviewIcon()}
              zIndex={9999}
            />
          )}
        </GoogleMap>
      )}

      {/* Drop-mode banner appears while user is choosing a spot. */}
      {dropMode && !setHqId && (
        <div className="drop-banner">
          <span>📍 Tap anywhere on the map to place your pin{dropPos ? ' (or drag the marker)' : ''}.</span>
          <button className="chip" onClick={() => { setDropMode(false); setDropPos(null); }}>Cancel</button>
          {dropPos && (
            <button className="chip active" onClick={() => setDropOpen(true)}>Continue →</button>
          )}
        </div>
      )}

      {/* HQ-drop banner appears when leader navigates here from Squads page. */}
      {setHqId && (
        <div className="drop-banner">
          <span>🏠 Tap the map to set your squad’s HQ{hqDropPos ? ' (or drag the marker)' : ''}.</span>
          <button className="chip" onClick={() => { setHqDropPos(null); setSearchParams({}); }}>Cancel</button>
          {hqDropPos && (
            <button className="chip active" onClick={async () => {
              await updateSquadHq(setHqId, hqDropPos);
              setHqDropPos(null);
              setSearchParams({});
            }}>Save HQ ✓</button>
          )}
        </div>
      )}

      <button className={'fab' + (dropMode ? ' active' : '')}
        onClick={() => {
          if (dropMode) {
            // Toggle off if no spot chosen; otherwise jump to confirmation.
            if (dropPos) setDropOpen(true);
            else setDropMode(false);
          } else {
            setDropMode(true);
            // Pre-seed with current GPS as a convenience; user can drag or tap to move.
            if (pos) setDropPos(pos);
          }
        }}
        title={dropMode ? 'Confirm pin location' : 'Drop a public pin'}>
        {dropMode ? '✓' : '＋'}
      </button>

      {dropOpen && dropPos && user && (
        <DropPinModal
          pos={dropPos}
          hasSquad={squadIds.length > 0}
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
              lat: dropPos.lat, lng: dropPos.lng,
              visibility: data.visibility,
              squadIds: data.visibility === 'squad' ? squadIds : []
            });
            // Also log a private check-in + XP — but only treat it as a
            // check-in if the pin is within ~150 m of the user's actual
            // location. Otherwise they're pinning a remote place.
            const nearby = pos && Math.hypot(pos.lat - dropPos.lat, pos.lng - dropPos.lng) * 111000 < 150;
            if (nearby) {
              await logVisitedPlace({
                uid: user.uid, displayName: user.displayName,
                placeName: data.placeName, category: data.category,
                lat: dropPos.lat, lng: dropPos.lng
              }).catch(() => {});
            }
            await awardXp(user.uid, {
              xp: XP.PUBLIC_PIN + (nearby ? XP.CHECK_IN : 0) + (data.rating ? XP.REVIEW : 0),
              publicPins: 1,
              checkIns: nearby ? 1 : 0,
              reviews: data.rating ? 1 : 0
            });
            setDropOpen(false);
            setDropMode(false);
            setDropPos(null);
            setSelected('pp:' + id);
          }}
        />
      )}

      {showTutorial && (
        <TimelineTutorial onClose={() => {
          localStorage.setItem('squadren.timelineTutorialSeen', 'true');
          setShowTutorial(false);
        }} />
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
function publicPersonIcon() { return svgMarker('#0ea5e9', '🌎'); }
function placeIcon(c: string) { return svgMarker(c, '★'); }

// Squad markers are bigger, layered (shield + tier emoji) so testers can spot
// real organic squads against simple public pins at a glance.
function squadBadgeIcon(tier: typeof TIERS[number]): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="68" viewBox="0 0 56 68">
    <defs><filter id="sb" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.35"/></filter></defs>
    <g filter="url(#sb)">
      <path d="M28 0 L52 10 L52 30 C52 48 28 64 28 64 C28 64 4 48 4 30 L4 10 Z"
            fill="${tier.color}" stroke="#fff" stroke-width="2.5"/>
      <circle cx="28" cy="26" r="14" fill="#fff" opacity="0.95"/>
      <text x="28" y="32" text-anchor="middle" font-size="18" font-family="system-ui">${tier.icon}</text>
    </g>
  </svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(40, 48),
    anchor: new google.maps.Point(20, 48)
  };
}
function dropPreviewIcon(): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="64" viewBox="0 0 52 64">
    <defs><filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.4"/></filter></defs>
    <g filter="url(#b)">
      <path d="M26 0C12 0 1 11 1 25c0 18 25 39 25 39s25-21 25-39C51 11 40 0 26 0z" fill="#ec4899" stroke="#fff" stroke-width="2"/>
      <circle cx="26" cy="25" r="11" fill="#fff"/>
      <text x="26" y="30" text-anchor="middle" font-size="16" font-family="system-ui" fill="#ec4899" font-weight="800">＋</text>
    </g>
  </svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(52, 64),
    anchor: new google.maps.Point(26, 64)
  };
}
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

// HQ marker — a flag/house shape colored by the squad's chosen crest,
// with the crest glyph rendered inside. Bigger than a regular pin so the
// "meeting grounds" of organic squads stand out on the map.
function hqIcon(glyph: string, bg: string): google.maps.Icon {
  const safe = glyph.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="72" viewBox="0 0 60 72">
    <defs><filter id="hq" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity="0.4"/></filter></defs>
    <g filter="url(#hq)">
      <path d="M30 0 L56 12 L56 36 C56 54 30 70 30 70 C30 70 4 54 4 36 L4 12 Z"
            fill="${bg}" stroke="#fff" stroke-width="3"/>
      <circle cx="30" cy="28" r="16" fill="#fff"/>
      <text x="30" y="35" text-anchor="middle" font-size="22" font-family="system-ui">${safe}</text>
      <rect x="22" y="48" width="16" height="4" rx="1.5" fill="#fff" opacity="0.95"/>
      <text x="30" y="64" text-anchor="middle" font-size="8" font-family="system-ui" font-weight="800" fill="#fff">HQ</text>
    </g>
  </svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(50, 60),
    anchor: new google.maps.Point(25, 60)
  };
}

function SquadHqDetail({ squad, isMember, isLeader, isPending, onRequestJoin, onClose }: {
  squad: Squad;
  isMember: boolean;
  isLeader: boolean;
  isPending: boolean;
  onRequestJoin: () => void;
  onClose: () => void;
}) {
  const logo = getLogo(squad.logo || DEFAULT_LOGO_ID);
  const [requested, setRequested] = useState(isPending);
  return (
    <div style={{ color: '#111', minWidth: 240, maxWidth: 280, position: 'relative', paddingRight: 22 }}>
      <button onClick={onClose} aria-label="Close"
        style={{
          position: 'absolute', top: -4, right: -4,
          width: 28, height: 28, borderRadius: 999,
          background: '#111', color: '#fff', border: 'none',
          cursor: 'pointer', fontSize: 16, lineHeight: 1, zIndex: 10
        }}>×</button>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: logo.bg, color: '#fff',
          display: 'grid', placeItems: 'center', fontSize: 24, flex: '0 0 44px'
        }}>{logo.glyph}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{squad.name}</div>
          <div style={{ fontSize: 11, color: '#666' }}>
            🏠 Squad HQ · {squad.members.length} member{squad.members.length === 1 ? '' : 's'}
            {squad.visibility === 'public' ? ' · 🌎 Public' : ' · 🔒 Private'}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#444' }}>
        Squad meeting grounds — tap below to ask the leader if you can join.
      </div>
      <div style={{ marginTop: 10 }}>
        {isLeader ? (
          <div style={{ fontSize: 12, color: '#a16207', fontWeight: 600 }}>👑 You are the leader of this squad.</div>
        ) : isMember ? (
          <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ You're a member of this squad.</div>
        ) : requested ? (
          <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>⏳ Request sent — waiting for the leader.</div>
        ) : (
          <button
            onClick={() => { onRequestJoin(); setRequested(true); }}
            style={{
              width: '100%', padding: '8px 12px', border: 'none', borderRadius: 10,
              background: 'linear-gradient(135deg,#8b5cf6,#ec4899)', color: '#fff',
              fontWeight: 700, cursor: 'pointer'
            }}>
            Request to join
          </button>
        )}
      </div>
    </div>
  );
}

function PublicPinDetail({ pin, onClose }: { pin: PublicPin; onClose: () => void }) {
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
    <div style={{ color: '#111', minWidth: 240, maxWidth: 280, position: 'relative', paddingRight: 22 }}>
      <button onClick={onClose} aria-label="Close"
        style={{
          position: 'absolute', top: -4, right: -4,
          width: 28, height: 28, borderRadius: 999,
          background: '#111', color: '#fff', border: 'none',
          cursor: 'pointer', fontSize: 16, lineHeight: 1, zIndex: 10
        }}>×</button>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden', background: '#fef3c7', flex: '0 0 36px' }}>
          {pin.avatar && <Avatar config={pin.avatar} size={36} headOnly />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{pin.placeName}</div>
          <div style={{ fontSize: 11, color: '#666' }}>
            {pin.category} · by {pin.displayName}
            {' · '}
            <span style={{
              fontWeight: 700,
              color: (pin.visibility || 'public') === 'public' ? '#0ea5e9' : '#7c3aed'
            }}>
              {(pin.visibility || 'public') === 'public' ? '🌎 Public' : '👥 Squad'}
            </span>
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

function SquadDetail({ squad, onClose }: { squad: DemoSquad; onClose: () => void }) {
  const tier = squadPrestige(squad.stats);
  const ageLabel = squad.stats.ageDays < 365
    ? `${squad.stats.ageDays} days`
    : `${(squad.stats.ageDays / 365).toFixed(1)} years`;
  return (
    <div style={{ color: '#111', minWidth: 240, maxWidth: 280, position: 'relative', paddingRight: 22 }}>
      <button onClick={onClose} aria-label="Close"
        style={{
          position: 'absolute', top: -4, right: -4,
          width: 28, height: 28, borderRadius: 999,
          background: '#111', color: '#fff', border: 'none',
          cursor: 'pointer', fontSize: 16, lineHeight: 1, zIndex: 10
        }}>×</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: tier.color, color: '#fff',
          display: 'grid', placeItems: 'center', fontSize: 22, flex: '0 0 44px'
        }}>{tier.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{squad.name}</div>
          <div style={{ fontSize: 11, color: '#666' }}>
            {squad.city} · {squad.country} · {tier.name}
          </div>
        </div>
      </div>
      <div style={{
        marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
        fontSize: 12
      }}>
        <div>👥 <strong>{squad.stats.members}</strong> members</div>
        <div>📅 <strong>{ageLabel}</strong></div>
        <div>📍 <strong>{squad.stats.pins}</strong> pins</div>
        <div>✈️ <strong>{squad.stats.checkIns}</strong> check-ins</div>
        <div>⭐ <strong>{squad.stats.reviews}</strong> reviews</div>
        <div>🏆 <strong>{squad.stats.totalXp.toLocaleString()}</strong> XP</div>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#888' }}>
        Demo squad — visible to all prototype testers.
      </div>
    </div>
  );
}

type DropData = { placeName: string; category: string; comment: string; rating: number; visibility: PinVisibility };

function DropPinModal({ pos, hasSquad, onClose, onSubmit }: {
  pos: { lat: number; lng: number };
  hasSquad: boolean;
  onClose: () => void;
  onSubmit: (d: DropData) => Promise<void>;
}) {
  const [placeName, setPlaceName] = useState('');
  const [category, setCategory] = useState('Coffee');
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(0);
  const [visibility, setVisibility] = useState<PinVisibility>('public');
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!placeName.trim()) return;
    setBusy(true);
    try { await onSubmit({ placeName: placeName.trim(), category, comment: comment.trim(), rating, visibility }); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>📍 Drop a pin</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
          {visibility === 'public'
            ? 'Anyone in the world using Squad REN will see this pin and can comment on it.'
            : 'Only your squad members will be able to see this pin and its comments.'}
        </p>

        <label>Visibility</label>
        <div className="layer-toggle" style={{ marginBottom: 8 }}>
          <button type="button" className={'chip ' + (visibility === 'public' ? 'active' : '')}
            onClick={() => setVisibility('public')}>🌎 Public</button>
          <button type="button" className={'chip ' + (visibility === 'squad' ? 'active' : '')}
            onClick={() => setVisibility('squad')} disabled={!hasSquad}
            title={hasSquad ? 'Visible only to your squad members' : 'Join a squad first'}>
            👥 Squad only{!hasSquad && ' 🔒'}
          </button>
        </div>

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
            {busy ? 'Posting…' : (visibility === 'public' ? 'Drop public pin' : 'Drop squad pin')}
          </button>
        </div>
      </div>
    </div>
  );
}
