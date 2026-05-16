import { useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, CircleF, HeatmapLayerF, PolylineF
} from '@react-google-maps/api';
import { useAuth, defaultAvatar } from '../lib/AuthContext';
import type { Storefront, AvatarConfig } from '../lib/AuthContext';
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
import {
  watchMyTrips, watchSquadTrips, appendPathPoint, markStopReached,
  findReachedStop, PATH_MIN_M, PATH_MIN_MS, type Trip
} from '../lib/trips';
import { haversine } from '../lib/geo';
import { TIERS, fetchStats, tierForXp } from '../lib/prestige';
import {
  watchRecentMissiles, fireMissile, getAmmo,
  missileStyleForTier, rangeKmForTier, trailPath, projectilePos,
  HQ_HIT_RADIUS_M, type Missile
} from '../lib/missiles';
import { playLaunch, playImpact } from '../lib/sfx';
import {
  startHeartbeat, watchActiveUsers, type ActiveUser
} from '../lib/pulse';
import { watchLifetimeStats, countryCount, recordSignIn } from '../lib/lifetimeStats';
import {
  appendDailyPathPoint, shouldAppendDailyPath, watchMyRecentPaths, watchVisiblePaths,
  setAllRecentVisibility, setDayVisibility, deleteDay, sweepOldPaths,
  getDefaultVisibility, setDefaultVisibility, getRecordingEnabled, setRecordingEnabled,
  pathDistanceKm as dailyPathDistanceKm, labelForDate, pathColor,
  DAILY_PATH_RETAIN_DAYS, type DailyPath, type PathVisibility as DailyPathVis
} from '../lib/dailyPath';
import { sendStrikeEmails, emailsForUids, compressImage } from '../lib/mailer';
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

// `visualization` for HeatmapLayer; `places` for nearby-search enrichment of
// auto-logged visits. Static array reference because the loader requires a
// stable identity to avoid re-loading.
const LIBRARIES: ('visualization' | 'places')[] = ['visualization', 'places'];

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
  // Google deprecated the Heatmap Layer (unavailable from May 2026 onward).
  // Default OFF so it doesn't crash the map. Toggle still works if Google
  // hasn't pulled the constructor yet for a given session.
  const [heat, setHeat] = useState<boolean>(false);
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

  // Trips state. `myTrips` is everything the user owns; `liveTrips` is the
  // realtime feed for squad-mates + public broadcasters whose paths should
  // draw across the map.
  const [myTrips, setMyTrips] = useState<Trip[]>([]);
  const [liveTrips, setLiveTrips] = useState<Trip[]>([]);
  const [checkInBusy, setCheckInBusy] = useState(false);
  // Tracks the last GPS point we appended to our active trip's breadcrumb
  // trail, so we can throttle writes by PATH_MIN_M / PATH_MIN_MS.
  const lastPathPushRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  // Memoize the PlacesService so we don't recreate it on every effect tick.
  const placesSvcRef = useRef<google.maps.places.PlacesService | null>(null);

  // ——— Daily path history ———
  // Per-user GPS breadcrumb log, retained for the last 7 calendar days.
  // Independent of the trips system: every signed-in user with recording
  // turned on contributes points to today's path doc, then the panel below
  // lets them browse / share / forget any day in the window.
  const [myPaths, setMyPaths] = useState<DailyPath[]>([]);
  const [peerPaths, setPeerPaths] = useState<DailyPath[]>([]);
  const [pathRecord, setPathRecord] = useState<boolean>(
    () => (user ? getRecordingEnabled(user.uid) : false)
  );
  const [pathVis, setPathVis] = useState<DailyPathVis>(
    () => (user ? getDefaultVisibility(user.uid) : 'private')
  );
  // Which day-keys to render on the map (own paths only by default; tap a
  // peer path entry to toggle it as well). Today is on by default while
  // recording is active so the live trail draws as you move.
  const [shownDays, setShownDays] = useState<Set<string>>(() => new Set());
  const [shownPeerIds, setShownPeerIds] = useState<Set<string>>(() => new Set());
  const [showPathPanel, setShowPathPanel] = useState(false);
  // Throttle ref dedicated to daily path appends (separate from the trip
  // throttle above so the two can run at independent cadences if needed).
  const lastDailyPathRef = useRef<{ lat: number; lng: number; t: number } | null>(null);

  // ——— Virtual warfare ———
  // Active + recent missiles for the animated arcs and impact markers.
  const [missiles, setMissiles] = useState<Missile[]>([]);
  // Arm mode: when on, the next map click fires a missile at that point.
  const [armed, setArmed] = useState(false);
  // Used by setInterval to drive the per-frame polyline redraw while any
  // missile is in-flight.
  const [animTick, setAnimTick] = useState(0);
  // The attacker's own stats drive their tier-based ammo capacity.
  const [myXp, setMyXp] = useState(0);
  // Impact splash markers — added on impact, removed after 4s. Keeps render
  // overhead bounded since `missiles` itself rolls forward on its own.
  const [impacts, setImpacts] = useState<{ id: string; lat: number; lng: number; tier: number; t: number }[]>([]);
  // Track which missiles we have already played the boom for, so re-renders
  // don't double-trigger the audio.
  const playedImpactsRef = useRef<Set<string>>(new Set());

  // ——— Member Population Pulse ———
  // Every signed-in user heartbeats to `activeUsers`; everyone subscribes and
  // sees the platform-wide live count plus a roster for globe-scanning.
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [showPulseRoster, setShowPulseRoster] = useState(false);
  // Lifetime cumulative counter (across all sign-ins ever) + new-join toasts.
  const [lifetime, setLifetime] = useState<{ totalUsers: number; countries: Record<string, number> }>({ totalUsers: 0, countries: {} });
  const [joinToasts, setJoinToasts] = useState<{ uid: string; displayName: string; at: number; fresh: boolean }[]>([]);
  const knownActiveRef = useRef<Set<string>>(new Set());
  const firstActiveSyncRef = useRef(true);

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

  // Subscribe to trip data: our own (for path recording + arrival detection)
  // and any squad-mate / public broadcaster whose trip is currently active.
  useEffect(() => {
    if (!user) return;
    return watchMyTrips(user.uid, setMyTrips);
  }, [user?.uid]);
  useEffect(() => {
    return watchSquadTrips(squadIds, setLiveTrips);
  }, [squadIds.join(',')]);

  // ——— Daily path subscriptions + retention sweep ———
  // Stream my own retained days (newest first), peer days that I'm allowed
  // to see (squad / public), and prune anything older than the window from
  // my own collection on boot.
  useEffect(() => {
    if (!user) return;
    sweepOldPaths(user.uid).catch(() => {});
    return watchMyRecentPaths(user.uid, setMyPaths);
  }, [user?.uid]);
  useEffect(() => {
    if (!user) return;
    return watchVisiblePaths(setPeerPaths, {
      viewerUid: user.uid,
      viewerSquadIds: squadIds
    });
  }, [user?.uid, squadIds.join(',')]);
  // Keep local toggles in sync with whoever's logged in (handles user
  // switching during a session).
  useEffect(() => {
    if (!user) return;
    setPathRecord(getRecordingEnabled(user.uid));
    setPathVis(getDefaultVisibility(user.uid));
  }, [user?.uid]);

  // Currently-running trip we own. The map records GPS breadcrumbs to this
  // trip's path and detects stop arrivals.
  const myActiveTrip = useMemo(() => myTrips.find(t => t.status === 'active') || null, [myTrips]);

  // Subscribe to recent missiles so the map can animate arcs in real time.
  useEffect(() => watchRecentMissiles(setMissiles), []);
  useEffect(() => watchActiveUsers(setActiveUsers), []);
  // Lifetime worldwide users counter — drives the marketing pill.
  useEffect(() => watchLifetimeStats(setLifetime), []);
  // Backfill our country once GPS is available. The initial sign-in often
  // runs before the user grants location, so the flag doc may have been
  // written with country=null. recordSignIn() detects that and patches it.
  useEffect(() => {
    if (!user?.uid || typeof pos?.lat !== 'number' || typeof pos?.lng !== 'number') return;
    recordSignIn(user.uid, { lat: pos.lat, lng: pos.lng });
  }, [user?.uid, pos?.lat, pos?.lng]);
  // Diff active users against the last snapshot to fire a brief join toast
  // whenever someone new appears in the live pulse. The first sync after
  // mount is suppressed so we don't spam the screen with "X joined" for
  // every user already online.
  useEffect(() => {
    const seen = knownActiveRef.current;
    const first = firstActiveSyncRef.current;
    const additions: { uid: string; displayName: string; at: number; fresh: boolean }[] = [];
    const nextSeen = new Set<string>();
    for (const u of activeUsers) {
      nextSeen.add(u.uid);
      if (!seen.has(u.uid) && u.uid !== user?.uid) {
        // Distinguish "joined within the last 90s" (fresh) from "we just
        // started watching" so the toast can lead with the right copy.
        const fresh = Date.now() - u.lastSeenMs < 90_000;
        additions.push({ uid: u.uid, displayName: u.displayName, at: Date.now(), fresh });
      }
    }
    knownActiveRef.current = nextSeen;
    firstActiveSyncRef.current = false;
    if (first || !additions.length) return;
    setJoinToasts(prev => [...prev, ...additions].slice(-3));
    // Auto-expire each toast after 5s.
    for (const a of additions) {
      window.setTimeout(() => {
        setJoinToasts(prev => prev.filter(t => t.uid !== a.uid || t.at !== a.at));
      }, 5000);
    }
  }, [activeUsers, user?.uid]);
  // Heartbeat the current user every minute so they show up in the pulse.
  useEffect(() => {
    if (!user) return;
    return startHeartbeat({
      uid: user.uid,
      displayName: user.displayName,
      lat: pos?.lat,
      lng: pos?.lng,
      squadCount: squadIds.length
    });
  }, [user?.uid, pos?.lat, pos?.lng, squadIds.length]);
  useEffect(() => {
    if (!user) return;
    fetchStats(user.uid).then(s => setMyXp(s.xp || 0)).catch(() => {});
  }, [user?.uid]);

  // Drive the in-flight animation. Runs only while at least one missile is
  // still mid-air. Triggers state on a 16 → 60 fps loop via setInterval.
  useEffect(() => {
    const now = Date.now();
    const anyInFlight = missiles.some(m => m.status === 'in_flight' && m.impactAt > now);
    if (!anyInFlight) return;
    const id = window.setInterval(() => setAnimTick(t => t + 1), 60);
    return () => clearInterval(id);
  }, [missiles]);

  // Detect impacts client-side so we can play the boom + flash a splash
  // marker the moment any missile crosses its impactAt threshold.
  useEffect(() => {
    const now = Date.now();
    for (const m of missiles) {
      if (m.impactAt <= now && !playedImpactsRef.current.has(m.id)) {
        playedImpactsRef.current.add(m.id);
        playImpact();
        setImpacts(prev => [...prev, { id: m.id, lat: m.target.lat, lng: m.target.lng, tier: m.missileTier, t: now }]);
        // Apply RP damage to fellow squad-mates of the *current viewer*
        // when this user is in the targeted squad (everyone's client tries
        // — the awardXp transaction is idempotent enough for the prototype).
        if (user && m.targetSquadId && m.rpDamage > 0) {
          const inSquad = squads.find(s => s.id === m.targetSquadId);
          if (inSquad && inSquad.members.includes(user.uid)) {
            awardXp(user.uid, { xp: -m.rpDamage }).catch(() => {});
          }
        }
        // Garbage-collect the splash after 4s.
        const idToRemove = m.id;
        setTimeout(() => setImpacts(prev => prev.filter(x => x.id !== idToRemove)), 4000);
      }
    }
  }, [missiles, animTick]);

  useEffect(() => {
    if (!user || !pos) return;
    // Only attach the storefront snapshot to presence when the user has
    // opted in to public storefront visibility — squad-only and private
    // storefronts must NOT leak through the public presence stream.
    const sfPublic = user.storefront && user.storefront.visibility === 'public' ? user.storefront : null;
    updatePresence({
      uid: user.uid, displayName: user.displayName,
      avatar: user.avatar || defaultAvatar,
      lat: pos.lat, lng: pos.lng,
      placeName: null, squadIds,
      shareLocation: share,
      sharePublic: share && sharePublic,
      ...(sfPublic ? { storefront: sfPublic } : {}),
      ...(typeof myXp === 'number' ? { xp: myXp } : {})
    });
    const mates = presence.filter(p => p.uid !== user.uid).map(p => ({ lat: p.lat, lng: p.lng }));
    tickBadges(pos, mates);
    // Resolve a real place name via the Places API before logging. Skips
    // logging when the user is in the middle of nowhere (no nearby POI),
    // which keeps the dashboard clean of "Visited spot" noise.
    maybeAutoLogVisit(user.uid, user.displayName, pos, myPlaces, async (p) => {
      if (!isLoaded || !mapRef.current || !window.google?.maps?.places) return null;
      if (!placesSvcRef.current) {
        placesSvcRef.current = new google.maps.places.PlacesService(mapRef.current);
      }
      return await new Promise<{ placeName: string; category?: string } | null>(resolve => {
        placesSvcRef.current!.nearbySearch(
          { location: p, radius: 60, type: 'point_of_interest' as any },
          (results, status) => {
            if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.length) {
              resolve(null); return;
            }
            const top = results[0];
            const types = top.types || [];
            const cat = types.includes('cafe') ? 'Coffee'
              : types.includes('restaurant') || types.includes('meal_takeaway') ? 'Food'
              : types.includes('bar') || types.includes('night_club') ? 'Bar'
              : types.includes('gas_station') ? 'Gas'
              : types.includes('gym') ? 'Gym'
              : types.includes('park') ? 'Park'
              : types.includes('store') || types.includes('shopping_mall') ? 'Shopping'
              : 'Auto';
            resolve({ placeName: top.name || 'Visited spot', category: cat });
          }
        );
      });
    }).catch(() => {});

    // Trip path recording: throttled append of the current GPS fix while a
    // trip is active. Throttle is by distance OR time, whichever fires first.
    if (myActiveTrip) {
      const last = lastPathPushRef.current;
      const now = Date.now();
      const farEnough = !last || haversine({ lat: last.lat, lng: last.lng }, pos) >= PATH_MIN_M;
      const longEnough = !last || (now - last.t) >= PATH_MIN_MS;
      if (farEnough || longEnough) {
        lastPathPushRef.current = { lat: pos.lat, lng: pos.lng, t: now };
        appendPathPoint(myActiveTrip.id, { lat: pos.lat, lng: pos.lng, t: now }).catch(() => {});
      }
      // Arrival detection: the first unreached stop within STOP_REACH_M
      // gets marked reached and awards XP.
      const reached = findReachedStop(myActiveTrip, pos);
      if (reached >= 0) {
        markStopReached(myActiveTrip.id, reached).catch(() => {});
        awardXp(user.uid, { xp: XP.CHECK_IN, checkIns: 1 }).catch(() => {});
      }
    }

    // Daily path recording (independent of trips). Throttled the same way
    // as trip paths so a single GPS tick contributes at most one breadcrumb
    // to each system.
    if (pathRecord) {
      const now = Date.now();
      const next = { lat: pos.lat, lng: pos.lng, t: now };
      if (shouldAppendDailyPath(lastDailyPathRef.current, next)) {
        lastDailyPathRef.current = next;
        appendDailyPathPoint(user.uid, user.displayName, next, {
          visibility: pathVis,
          squadIds
        }).catch(() => {});
      }
    }
    // Intentionally exclude `presence` and `myPlaces` from deps — we only
    // want to push presence when *our* position/share state changes, not on
    // every incoming squad-mate update (which was causing repeated re-renders
    // and the "snap back to my location" feel while panning).
  }, [pos?.lat, pos?.lng, share, sharePublic, squadIds.join(','), myActiveTrip?.id, pathRecord, pathVis, user?.storefront?.updatedAt, user?.storefront?.visibility, myXp]);

  // Stable map center: capture the first known position and never change it
  // again, so panning around doesn't get yanked back by GPS updates.
  const initialCenter = useRef<{ lat: number; lng: number } | null>(null);
  if (!initialCenter.current && pos) initialCenter.current = pos;
  // IP-based coarse fallback for when GPS is slow/denied — so the map at
  // least opens near the user's region instead of San Francisco.
  const [ipFallback, setIpFallback] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (initialCenter.current || pos) return;
    let cancelled = false;
    // ipapi.co is free + CORS-friendly; falls back silently on any error.
    fetch('https://ipapi.co/json/').then(r => r.json()).then(d => {
      if (cancelled) return;
      if (typeof d?.latitude === 'number' && typeof d?.longitude === 'number') {
        setIpFallback({ lat: d.latitude, lng: d.longitude });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const center = initialCenter.current
    || pos
    || ipFallback
    || { lat: 37.7749, lng: -122.4194 };
  // Pan the live map once we get a real GPS fix, regardless of where the
  // initial center landed (IP fallback / SF default).
  const didPanToGpsRef = useRef(false);
  useEffect(() => {
    if (!pos || didPanToGpsRef.current) return;
    const m = mapRef.current;
    if (!m) return;
    m.panTo(pos);
    m.setZoom(13);
    didPanToGpsRef.current = true;
  }, [pos?.lat, pos?.lng]);
  const myAvatar = user?.avatar || defaultAvatar;
  const meIconUrl = useMemo(() => avatarToDataUrl(myAvatar), [JSON.stringify(myAvatar)]);

  // ——— Virtual warfare: the squad we'll fire from + ammo state ———
  // Use the first real squad with an HQ as the launching base; fall back to
  // the first squad outright (origin becomes its leader's HQ or the user's
  // current GPS if neither is set).
  const firingSquad = useMemo(() => squads.find(s => !!s.hq) || squads[0] || null, [squads]);
  const myTierObj = useMemo(() => {
    let t = TIERS[0];
    for (const cur of TIERS) if (myXp >= cur.xp) t = cur;
    return t;
  }, [myXp]);
  const ammo = firingSquad ? getAmmo(firingSquad.id, myXp) : null;

  // Strike composer state. When the user taps the map while armed we collect
  // a message + optional image before actually firing, so the email blasted
  // to the recipient squad has something fun in it.
  const [composeTarget, setComposeTarget] = useState<{
    lat: number; lng: number; placeName?: string;
    targetSquadId?: string; targetSquadName?: string; targetMemberIds?: string[];
  } | null>(null);
  const [composeMsg, setComposeMsg] = useState('');
  const [composeImg, setComposeImg] = useState<string | null>(null);
  const [composeBusy, setComposeBusy] = useState(false);
  const composeFileRef = useRef<HTMLInputElement>(null);

  // First-stage handler: validates ammo + range, detects rival HQ, opens the
  // composer. Actual firing happens in executeFire below.
  function fireAtTarget(target: { lat: number; lng: number; placeName?: string }) {
    if (!user || !firingSquad) {
      setImportMsg('Join or create a squad before launching missiles.');
      setTimeout(() => setImportMsg(null), 3000);
      return;
    }
    if (!ammo || ammo.remaining <= 0) {
      setImportMsg(`Out of ammo — tier ${myTierObj.tier} squads get ${ammo?.capacity ?? 1} missile(s) per day.`);
      setTimeout(() => setImportMsg(null), 3500);
      return;
    }
    // Did the click land on another squad's HQ? Look at public squads + my squads.
    let targetSquadId: string | undefined;
    let targetSquadName: string | undefined;
    let targetMemberIds: string[] = [];
    const candidates = [...publicSquads, ...squads].filter(s => s.hq && s.id !== firingSquad.id);
    for (const s of candidates) {
      if (!s.hq) continue;
      const d = haversine({ lat: s.hq.lat, lng: s.hq.lng }, target);
      if (d <= HQ_HIT_RADIUS_M) {
        targetSquadId = s.id;
        targetSquadName = s.name;
        targetMemberIds = s.members || [];
        break;
      }
    }
    setComposeMsg('');
    setComposeImg(null);
    setComposeTarget({ ...target, targetSquadId, targetSquadName, targetMemberIds });
  }

  // Second stage: actually fire + (if hitting a real squad) email every
  // member. The email contains the composer message + the image inline so
  // offline recipients still see the strike.
  async function executeFire(opts: { skipCompose?: boolean } = {}) {
    if (!composeTarget || !user || !firingSquad) return;
    setComposeBusy(true);
    try {
      const origin = firingSquad.hq
        ? { lat: firingSquad.hq.lat, lng: firingSquad.hq.lng }
        : (pos || center);
      playLaunch();
      await fireMissile({
        attackerSquadId: firingSquad.id,
        attackerSquadName: firingSquad.name,
        attackerSquadTier: myTierObj.tier,
        attackerUid: user.uid,
        attackerName: user.displayName,
        attackerEmail: user.email || null,
        origin,
        target: { lat: composeTarget.lat, lng: composeTarget.lng, placeName: composeTarget.placeName },
        targetSquadId: composeTarget.targetSquadId,
        targetSquadName: composeTarget.targetSquadName,
        targetMemberIds: composeTarget.targetMemberIds,
        message: opts.skipCompose ? undefined : (composeMsg.trim() || undefined),
        imageDataUrl: opts.skipCompose ? undefined : (composeImg || undefined)
      });
      // Email every squad-mate of the target. Looks up gmail addresses from
      // their `users/{uid}` doc — anyone without one is silently skipped.
      if (composeTarget.targetSquadId && (composeTarget.targetMemberIds?.length || 0) > 0) {
        const emails = await emailsForUids(composeTarget.targetMemberIds || []);
        if (emails.length > 0) {
          await sendStrikeEmails({
            toEmails: emails,
            fromName: user.displayName || 'A rival squad',
            fromEmail: user.email || undefined,
            attackerSquadName: firingSquad.name,
            targetSquadName: composeTarget.targetSquadName,
            targetPlace: composeTarget.placeName,
            message: composeMsg.trim() || undefined,
            imageDataUrl: composeImg || undefined,
            retaliateUrl: 'https://squad-ren.com/'
          });
        }
      }
      setImportMsg(composeTarget.targetSquadName
        ? `🚀 Strike inbound on ${composeTarget.targetSquadName}!`
        : '🚀 Missile away!');
      setTimeout(() => setImportMsg(null), 3500);
      setComposeTarget(null);
      setComposeMsg('');
      setComposeImg(null);
    } catch (e: any) {
      setImportMsg(`⚠ ${e?.message || 'Launch failed.'}`);
      setTimeout(() => setImportMsg(null), 3500);
    } finally {
      setComposeBusy(false);
    }
  }

  async function onComposeImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const url = await compressImage(f);
      setComposeImg(url);
    } catch (err: any) {
      setImportMsg(`⚠ ${err?.message || 'Image failed to load.'}`);
      setTimeout(() => setImportMsg(null), 3500);
    } finally {
      e.target.value = '';
    }
  }

  // Retaliate against the most recent attacker hit on one of my squads.
  async function retaliate(m: Missile) {
    if (!firingSquad || !firingSquad.hq) {
      setImportMsg('Set a squad HQ to retaliate from.');
      setTimeout(() => setImportMsg(null), 3000);
      return;
    }
    // Find attacker squad HQ via squads + publicSquads.
    const all = [...publicSquads, ...squads];
    const attacker = all.find(s => s.id === m.attackerSquadId);
    const target = attacker?.hq
      ? { lat: attacker.hq.lat, lng: attacker.hq.lng, placeName: attacker.name }
      : { lat: m.origin.lat, lng: m.origin.lng, placeName: m.attackerSquadName };
    fireAtTarget(target);
  }


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
      await importTimelinePins(
        user.uid, user.displayName, capped,
        (d, t) => setImporting({ done: d, total: t }),
        { avatar: user.avatar || defaultAvatar, promoteReviewsToPublic: true, squadIds }
      );
      const cats = new Set(capped.map(p => p.category || 'Timeline'));
      const promoted = capped.filter(p => p.category === 'Review' || p.category === 'Saved' || p.rating).length;
      setImportMsg(
        `Imported ${capped.length} places (${[...cats].join(', ')})` +
        (promoted > 0 ? ` — ${promoted} shared publicly so everyone can see them.` : '.')
      );
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
      {/* Live join-the-platform toasts. Stacks bottom-right, each card
          auto-dismisses after 5s. Visible to ALL signed-in users so the
          live community feel is shared globally. */}
      <div
        style={{
          position: 'fixed', right: 12, bottom: 88, zIndex: 1200,
          display: 'flex', flexDirection: 'column', gap: 8,
          pointerEvents: 'none', maxWidth: 260
        }}
      >
        {joinToasts.map(t => (
          <div
            key={t.uid + ':' + t.at}
            style={{
              background: 'linear-gradient(135deg,#8b5cf6,#ec4899)',
              color: '#fff', borderRadius: 12, padding: '10px 12px',
              boxShadow: '0 6px 18px rgba(139,92,246,0.35)',
              animation: 'joinSlideIn 240ms ease-out',
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 12
            }}
          >
            <span style={{ fontSize: 20 }}>{t.fresh ? '🎉' : '👋'}</span>
            <span style={{ lineHeight: 1.25 }}>
              <strong style={{ display: 'block', fontSize: 13 }}>{t.displayName}</strong>
              <span style={{ opacity: 0.9 }}>{t.fresh ? 'just joined Squad REN' : 'is live on Squad REN'}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="map-overlay">
        <div className="map-card">
          <div className="row">
            <span className="pill good">●</span>
            <span>{presence.filter(p => p.uid !== user?.uid).length} squad nearby</span>
            <span className="pill">{Math.max(0, publicPresence.filter(p => p.uid !== user?.uid).length)} public</span>
            <span className="pill">{publicPins.length} pins</span>
            <span className="pill">{demoSquadList.length} squads</span>
          </div>
          {/* Member Population Pulse — live count of every Squad REN user
              whose heartbeat is fresh. Tap to scan the globe for them. */}
          <button
            onClick={() => setShowPulseRoster(true)}
            title="Live Squad REN population — tap to scan the globe"
            style={{
              marginTop: 8, width: '100%', cursor: 'pointer', border: 'none',
              background: 'linear-gradient(135deg,#22c55e,#0ea5e9)',
              color: '#fff', borderRadius: 10, padding: '8px 10px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 2px 10px rgba(34,197,94,0.25)'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: 999,
                background: '#fff', boxShadow: '0 0 0 0 #fff',
                animation: 'pulseDot 1.4s infinite'
              }} />
              <strong style={{ fontSize: 14 }}>{activeUsers.length.toLocaleString()}</strong>
              <span style={{ fontSize: 11, opacity: 0.9 }}>Squadders online</span>
            </span>
            <span style={{ fontSize: 11, opacity: 0.9 }}>🌐 Scan →</span>
          </button>
          {/* Lifetime worldwide stats — marketing pill that grows as Squad REN
              spreads. Sits directly under the live count so users see both
              the "right now" and the "all-time" momentum. */}
          <div
            style={{
              marginTop: 6, borderRadius: 10, padding: '6px 10px',
              background: 'linear-gradient(135deg,rgba(139,92,246,0.12),rgba(236,72,153,0.12))',
              border: '1px solid rgba(139,92,246,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 11, color: '#4c1d95'
            }}
            title="Total unique Squad REN members who have ever signed in"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🌍</span>
              <strong style={{ fontSize: 13 }}>{lifetime.totalUsers.toLocaleString()}</strong>
              <span style={{ opacity: 0.85 }}>worldwide</span>
            </span>
            <span style={{ opacity: 0.85 }}>
              <strong>{countryCount(lifetime)}</strong> countries
            </span>
          </div>
          <div className="layer-toggle" style={{ marginTop: 8 }}>
            <button className={'chip ' + (layer === 'public' ? 'active' : '')} onClick={() => setLayer('public')}>🌎 Public</button>
            <button className={'chip ' + (layer === 'squad' ? 'active' : '')} onClick={() => setLayer('squad')}>👥 Squad</button>
            <button className={'chip ' + (layer === 'mine' ? 'active' : '')} onClick={() => setLayer('mine')}>📍 Mine</button>
            <button className={'chip ' + (heat ? 'active' : '')} onClick={() => setHeat(h => !h)}>🔥 Heat</button>
            <button
              className="chip"
              disabled={!pos || checkInBusy}
              title={pos ? 'Drop a public check-in pin where you are right now' : 'Waiting for GPS…'}
              onClick={async () => {
                if (!user || !pos || checkInBusy) return;
                setCheckInBusy(true);
                try {
                  // Resolve a friendly place name from nearby POIs when possible.
                  let placeName = 'Checked in';
                  if (isLoaded && mapRef.current && window.google?.maps?.places) {
                    if (!placesSvcRef.current) {
                      placesSvcRef.current = new google.maps.places.PlacesService(mapRef.current);
                    }
                    placeName = await new Promise<string>(resolve => {
                      placesSvcRef.current!.nearbySearch(
                        { location: pos, radius: 60, type: 'point_of_interest' as any },
                        (results, status) => {
                          if (status === google.maps.places.PlacesServiceStatus.OK && results?.[0]?.name) {
                            resolve(results[0].name);
                          } else resolve('Checked in');
                        }
                      );
                    });
                  }
                  await createPublicPin({
                    uid: user.uid,
                    displayName: user.displayName,
                    avatar: user.avatar || defaultAvatar,
                    lat: pos.lat, lng: pos.lng,
                    placeName,
                    category: 'Check-in',
                    rating: 0,
                    comment: '',
                    visibility: 'public',
                    squadIds
                  });
                  await logVisitedPlace({
                    uid: user.uid, displayName: user.displayName,
                    placeName, category: 'Check-in',
                    lat: pos.lat, lng: pos.lng
                  });
                  await awardXp(user.uid, { xp: XP.CHECK_IN, checkIns: 1 });
                  // First-time check-in flips on daily path recording so the
                  // user immediately starts building their 7-day history.
                  if (!pathRecord) {
                    setRecordingEnabled(user.uid, true);
                    setPathRecord(true);
                    // Seed today's doc with the check-in point itself so the
                    // history panel has something to show even before they
                    // move enough for the throttle to fire again.
                    appendDailyPathPoint(user.uid, user.displayName,
                      { lat: pos.lat, lng: pos.lng, t: Date.now() },
                      { visibility: pathVis, squadIds }
                    ).catch(() => {});
                  }
                  setImportMsg(`✅ Checked in at ${placeName}`);
                  setTimeout(() => setImportMsg(null), 3000);
                } catch (e) {
                  setImportMsg('Could not check in — try again.');
                  setTimeout(() => setImportMsg(null), 3000);
                } finally {
                  setCheckInBusy(false);
                }
              }}
            >{checkInBusy ? '⏳ Checking in…' : '📍 Check in here'}</button>
            <button
              className="chip"
              onClick={() => setShowPathPanel(true)}
              title="View, share, or forget your last 7 days of travel"
            >🛤️ My path</button>
            <button className="chip" onClick={() => fileRef.current?.click()}>📥 Import Maps</button>
            <button className="chip" onClick={() => setShowTutorial(true)} title="How to import Google Timeline">❓ Help</button>
            <button
              className={'chip ' + (armed ? 'active' : '')}
              disabled={!firingSquad || !ammo || ammo.remaining <= 0}
              title={
                !firingSquad ? 'Join a squad first' :
                !ammo || ammo.remaining <= 0 ? 'Out of ammo today' :
                `Range: ${rangeKmForTier(myTierObj.tier).toLocaleString()} km — click anywhere on the map to fire`
              }
              onClick={() => setArmed(a => !a)}
            >
              {armed ? '🎯 Pick target…' : `🚀 Arm missile${ammo ? ` (${ammo.remaining}/${ammo.capacity})` : ''}`}
            </button>
          </div>
          {importing && (
            <div style={{ fontSize: 12, marginTop: 6 }}>Importing… {importing.done}/{importing.total}</div>
          )}
          {importMsg && (
            <div style={{ fontSize: 12, marginTop: 6, color: 'var(--muted)' }}>{importMsg}</div>
          )}
          {/* Recent strikes on my squads — one-tap retaliate. */}
          {(() => {
            const mySquadIds = new Set(squads.map(s => s.id));
            const hitsOnMe = missiles
              .filter(m => m.targetSquadId && mySquadIds.has(m.targetSquadId))
              .slice(0, 3);
            if (hitsOnMe.length === 0) return null;
            return (
              <div style={{ marginTop: 8, padding: 6, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#991b1b' }}>⚠ INCOMING STRIKES</div>
                {hitsOnMe.map(m => (
                  <div key={m.id} style={{ marginTop: 4, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ flex: 1, color: '#7f1d1d' }}>
                        <strong>{m.attackerSquadName}</strong> → {m.targetSquadName}
                        {m.status === 'in_flight' ? ' (incoming)' : ` (-${m.rpDamage} RP)`}
                      </span>
                      <button
                        onClick={() => retaliate(m)}
                        disabled={!firingSquad || !ammo || ammo.remaining <= 0}
                        style={{
                          background: '#ef4444', color: '#fff', border: 'none', borderRadius: 999,
                          padding: '2px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer'
                        }}>🚀 Retaliate</button>
                    </div>
                    {m.message && (
                      <div style={{ marginTop: 4, padding: 6, borderRadius: 6, background: '#fff', color: '#374151', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                        💬 {m.message}
                      </div>
                    )}
                    {m.imageDataUrl && (
                      <img src={m.imageDataUrl} alt="strike payload"
                        style={{ marginTop: 4, width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 6 }} />
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
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
            draggableCursor: (dropMode || setHqId || armed) ? 'crosshair' : undefined
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
            if (armed) {
              const lat = e.latLng.lat(), lng = e.latLng.lng();
              setArmed(false);
              fireAtTarget({ lat, lng });
              return;
            }
            if (setHqId) {
              setHqDropPos({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              return;
            }
            if (dropMode) {
              setDropPos({ lat: e.latLng.lat(), lng: e.latLng.lng() });
            }
          }}
        >
          {heat && heatPoints.length > 0 && (window as any).google?.maps?.visualization?.HeatmapLayer && (
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
                    <MapAvatarCard
                      displayName={user?.displayName || 'You'}
                      avatar={myAvatar}
                      storefront={user?.storefront}
                      squads={squads.map(s => ({ id: s.id, name: s.name }))}
                      tier={myTierObj}
                      isMe
                      onClose={() => setSelected(null)}
                    />
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
          {layer === 'public' && visiblePublicPresence.map(p => {
            const hasStorefront = !!(p.storefront && (p.storefront.name || p.storefront.tagline || (p.storefront.items && p.storefront.items.length)));
            return (
              <MarkerF key={'pub-' + p.uid} position={{ lat: p.lat, lng: p.lng }} title={p.displayName + (hasStorefront ? ' — 🛍️ Storefront' : ' (public)')}
                icon={publicPersonIcon(hasStorefront)} onClick={() => setSelected('pub-' + p.uid)}>
                {selected === 'pub-' + p.uid && (
                  <InfoWindowF position={{ lat: p.lat, lng: p.lng }} onCloseClick={() => setSelected(null)}>
                    <MapAvatarCard
                      displayName={p.displayName}
                      avatar={p.avatar}
                      storefront={p.storefront}
                      squads={[]}
                      tier={tierForXp(p.xp || 0)}
                      placeName={p.placeName || undefined}
                      onClose={() => setSelected(null)}
                    />
                  </InfoWindowF>
                )}
              </MarkerF>
            );
          })}

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

          {layer === 'mine' && myPlaces.slice(0, 500).map((pl, i) => {
            const key = `mine-${i}`;
            const isReview = pl.category === 'Review' || !!pl.rating;
            const color = isReview ? '#f59e0b' : (pl.category === 'Saved' ? '#22c55e' : '#8b5cf6');
            return (
              <MarkerF key={key} position={{ lat: pl.lat, lng: pl.lng }}
                title={pl.placeName} icon={placeIcon(color)}
                onClick={() => setSelected('mine:' + key)}>
                {selected === 'mine:' + key && (
                  <InfoWindowF position={{ lat: pl.lat, lng: pl.lng }} onCloseClick={() => setSelected(null)}>
                    <MyPlaceDetail place={pl} onClose={() => setSelected(null)} />
                  </InfoWindowF>
                )}
              </MarkerF>
            );
          })}

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

          {/* Daily-path polylines — my selected days plus any peer day I
              toggled on from the path panel. Rendered before trip paths so
              trip lines overlay them. Color is hashed off `${uid}_${date}`
              so each trail stays visually distinct. */}
          {myPaths.filter(p => shownDays.has(p.date) && (p.points?.length || 0) >= 2).map(p => (
            <PolylineF
              key={'mypath-' + p.id}
              path={p.points.map(pt => ({ lat: pt.lat, lng: pt.lng }))}
              options={{
                strokeColor: pathColor(p.id),
                strokeOpacity: 0.85,
                strokeWeight: 4,
                geodesic: false
              }}
            />
          ))}
          {peerPaths.filter(p => shownPeerIds.has(p.id) && (p.points?.length || 0) >= 2).map(p => (
            <PolylineF
              key={'peerpath-' + p.id}
              path={p.points.map(pt => ({ lat: pt.lat, lng: pt.lng }))}
              options={{
                strokeColor: pathColor(p.id),
                strokeOpacity: 0.55,
                strokeWeight: 3,
                geodesic: false
              }}
            />
          ))}

          {/* Live trip paths: own trip in blue, squad-mate / public trips in
              violet. Stop markers show planned + reached state. */}
          {[...(myActiveTrip ? [myActiveTrip] : []), ...liveTrips.filter(t => !myActiveTrip || t.id !== myActiveTrip.id)].map(trip => {
            const mine = user && trip.ownerId === user.uid;
            const path = (trip.path || []).map(p => ({ lat: p.lat, lng: p.lng }));
            const color = mine ? '#0ea5e9' : '#8b5cf6';
            return (
              <Fragment key={trip.id}>
                {path.length >= 2 && (
                  <PolylineF
                    path={path}
                    options={{
                      strokeColor: color,
                      strokeOpacity: 0.9,
                      strokeWeight: 4,
                      geodesic: true,
                      icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '14px' }]
                    }}
                  />
                )}
                {trip.stops.map((s, i) => (
                  <MarkerF
                    key={trip.id + ':' + i}
                    position={{ lat: s.lat, lng: s.lng }}
                    title={`${trip.title} · stop ${i + 1}: ${s.placeName}${s.reachedAt ? ' ✓' : ''}`}
                    label={{ text: s.reachedAt ? '✓' : String(i + 1), color: '#fff', fontSize: '11px', fontWeight: '700' }}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 11,
                      fillColor: s.reachedAt ? '#22c55e' : color,
                      fillOpacity: 1,
                      strokeColor: '#fff',
                      strokeWeight: 2
                    }}
                    zIndex={500}
                  />
                ))}
                {/* Leading-edge marker for non-self trips so squad-mates can
                    watch the friend's current GPS position cross the map. */}
                {!mine && path.length > 0 && (
                  <MarkerF
                    position={path[path.length - 1]}
                    title={`${trip.ownerName} · ${trip.title}`}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 9,
                      fillColor: color,
                      fillOpacity: 1,
                      strokeColor: '#fff',
                      strokeWeight: 3
                    }}
                    zIndex={600}
                  />
                )}
              </Fragment>
            );
          })}

          {/* Virtual warfare — animated missile arcs + impact splashes. */}
          {missiles.map(m => {
            const style = missileStyleForTier(m.missileTier);
            const inFlight = m.status === 'in_flight' && m.impactAt > Date.now();
            const path = inFlight ? trailPath(m) : trailPath(m, m.impactAt);
            const head = inFlight ? projectilePos(m) : m.target;
            return (
              <Fragment key={m.id}>
                <PolylineF
                  path={path}
                  options={{
                    strokeColor: style.color,
                    strokeOpacity: inFlight ? 0.95 : 0.5,
                    strokeWeight: 3,
                    geodesic: false,
                    icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 }, offset: '0', repeat: '10px' }]
                  }}
                />
                {/* Trail glow */}
                <PolylineF
                  path={path}
                  options={{
                    strokeColor: style.trail,
                    strokeOpacity: inFlight ? 0.5 : 0.2,
                    strokeWeight: 9,
                    geodesic: false
                  }}
                />
                {/* Origin marker (so the target squad sees where it came from). */}
                <MarkerF
                  position={m.origin}
                  title={`${m.attackerSquadName} launch site`}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 6, fillColor: style.color, fillOpacity: 0.9,
                    strokeColor: '#fff', strokeWeight: 2
                  }}
                  zIndex={700}
                />
                {/* Projectile head: emoji label that travels along the arc. */}
                {inFlight && (
                  <MarkerF
                    position={head}
                    label={{ text: style.emoji, fontSize: '22px' }}
                    icon={{
                      // Invisible anchor — we only want the emoji label visible.
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 0.1, fillOpacity: 0, strokeOpacity: 0
                    } as any}
                    zIndex={9999}
                  />
                )}
              </Fragment>
            );
          })}

          {/* Impact splash circles — pulse out for a moment after impact. */}
          {impacts.map(i => {
            const style = missileStyleForTier(i.tier);
            const age = (Date.now() - i.t) / 4000;  // 0 → 1
            const radius = 200 + age * 1200;
            return (
              <CircleF
                key={i.id}
                center={{ lat: i.lat, lng: i.lng }}
                radius={radius}
                options={{
                  fillColor: style.color, fillOpacity: 0.25 * (1 - age),
                  strokeColor: style.color, strokeOpacity: 0.9 * (1 - age),
                  strokeWeight: 3, clickable: false
                }}
              />
            );
          })}

          {/* Population Pulse: tiny green dot for every active Squadder with
              shared coords. Lightweight CircleF (not Marker) so 100s render
              cheaply. Tap-through is disabled. */}
          {activeUsers.filter(u => u.uid !== user?.uid && typeof u.lat === 'number' && typeof u.lng === 'number').slice(0, 500).map(u => (
            <CircleF
              key={'pulse-' + u.uid}
              center={{ lat: u.lat!, lng: u.lng! }}
              radius={12000}
              options={{
                fillColor: '#22c55e', fillOpacity: 0.45,
                strokeColor: '#16a34a', strokeOpacity: 0.9, strokeWeight: 1,
                clickable: false
              }}
            />
          ))}
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

      {showPulseRoster && (
        <PulseRoster
          users={activeUsers}
          myUid={user?.uid || ''}
          onClose={() => setShowPulseRoster(false)}
          onFlyTo={(u) => {
            const m = mapRef.current;
            if (m && typeof u.lat === 'number' && typeof u.lng === 'number') {
              m.panTo({ lat: u.lat, lng: u.lng });
              m.setZoom(10);
            }
            setShowPulseRoster(false);
          }}
        />
      )}

      {showPathPanel && user && (
        <PathHistoryPanel
          uid={user.uid}
          myPaths={myPaths}
          peerPaths={peerPaths}
          pathRecord={pathRecord}
          pathVis={pathVis}
          shownDays={shownDays}
          shownPeerIds={shownPeerIds}
          squadIds={squadIds}
          onClose={() => setShowPathPanel(false)}
          onToggleRecord={(on) => {
            setRecordingEnabled(user.uid, on);
            setPathRecord(on);
          }}
          onChangeVis={async (v) => {
            setDefaultVisibility(user.uid, v);
            setPathVis(v);
            // Push the new visibility onto every retained day so existing
            // history flips along with the toggle — matches the user's
            // expectation that "share my path" applies to the whole window.
            await setAllRecentVisibility(user.uid, v, v === 'squad' ? squadIds : []).catch(() => {});
          }}
          onToggleMyDay={(date) => {
            setShownDays(prev => {
              const next = new Set(prev);
              if (next.has(date)) next.delete(date); else next.add(date);
              return next;
            });
          }}
          onTogglePeer={(id) => {
            setShownPeerIds(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
          }}
          onChangeDayVis={async (date, v) => {
            await setDayVisibility(user.uid, date, v, v === 'squad' ? squadIds : []).catch(() => {});
          }}
          onForgetDay={async (date) => {
            await deleteDay(user.uid, date).catch(() => {});
            setShownDays(prev => {
              const next = new Set(prev); next.delete(date); return next;
            });
          }}
          onFlyTo={(pt) => {
            const m = mapRef.current;
            if (m) { m.panTo(pt); m.setZoom(15); }
            setShowPathPanel(false);
          }}
        />
      )}

      {composeTarget && (
        <div className="modal-backdrop" onClick={() => !composeBusy && setComposeTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>🚀 Arm the strike</h2>
              <button onClick={() => !composeBusy && setComposeTarget(null)} aria-label="Close"
                style={{ background: '#eee', border: 'none', borderRadius: 999, width: 32, height: 32, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              {composeTarget.targetSquadName
                ? <>Direct hit on <strong>{composeTarget.targetSquadName}</strong> — every member will get an email with your message + image.</>
                : <>Striking an open coordinate{composeTarget.placeName ? <> near <strong>{composeTarget.placeName}</strong></> : ''}. No email is sent for blank-map strikes.</>}
            </p>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Message (optional)</label>
            <textarea
              value={composeMsg}
              onChange={e => setComposeMsg(e.target.value.slice(0, 600))}
              placeholder="Trash talk, love note, peace offering — your call."
              className="input"
              rows={4}
              style={{ width: '100%', marginTop: 4, resize: 'vertical' }}
            />
            <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>{composeMsg.length}/600</div>

            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Image (optional)</label>
              <input
                type="file"
                accept="image/*"
                ref={composeFileRef}
                onChange={onComposeImageChange}
                style={{ display: 'none' }}
              />
              {!composeImg ? (
                <button className="btn ghost" onClick={() => composeFileRef.current?.click()} style={{ width: '100%', marginTop: 4 }}>
                  📷 Attach image
                </button>
              ) : (
                <div style={{ marginTop: 4, position: 'relative' }}>
                  <img src={composeImg} alt="strike payload"
                    style={{ width: '100%', borderRadius: 10, border: '1px solid #e5e7eb', maxHeight: 220, objectFit: 'cover' }} />
                  <button onClick={() => setComposeImg(null)}
                    style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 999, width: 28, height: 28, cursor: 'pointer' }}>×</button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn ghost" onClick={() => setComposeTarget(null)} disabled={composeBusy} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="btn" onClick={() => executeFire()} disabled={composeBusy} style={{ flex: 2 }}>
                {composeBusy ? 'Launching…' : '🚀 Launch missile'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
              Ammo left after launch: {Math.max(0, (ammo?.remaining || 1) - 1)} / {ammo?.capacity ?? 1}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Roster overlay: scrollable list of every active Squadder. Tapping one with
// shared coords flies the map to them so squads can scan for rivals/recruits.
function PulseRoster({ users, myUid, onClose, onFlyTo }: {
  users: ActiveUser[];
  myUid: string;
  onClose: () => void;
  onFlyTo: (u: ActiveUser) => void;
}) {
  const others = users.filter(u => u.uid !== myUid);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>🌐 Population Pulse</h2>
          <button onClick={onClose} aria-label="Close"
            style={{ background: '#eee', border: 'none', borderRadius: 999, width: 32, height: 32, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1, padding: 10, borderRadius: 10, background: 'linear-gradient(135deg,#22c55e,#0ea5e9)', color: '#fff', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{users.length.toLocaleString()}</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>online now</div>
          </div>
          <div style={{ flex: 1, padding: 10, borderRadius: 10, background: '#f1f5f9', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>
              {users.filter(u => typeof u.lat === 'number').length.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>on the globe</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
          Anyone using Squad REN right now. Tap a member to fly your map to them —
          good for sizing up rivals before a squad battle, or scouting recruits.
        </p>
        <div style={{ marginTop: 8 }}>
          {others.length === 0 && (
            <div className="empty">No one else online right now. Be the first scout.</div>
          )}
          {others.slice(0, 200).map(u => {
            const hasLoc = typeof u.lat === 'number' && typeof u.lng === 'number';
            const ageS = Math.max(0, Math.round((Date.now() - u.lastSeenMs) / 1000));
            return (
              <button key={u.uid} onClick={() => hasLoc && onFlyTo(u)} disabled={!hasLoc}
                style={{
                  width: '100%', textAlign: 'left', marginTop: 6, padding: 8, borderRadius: 10,
                  border: '1px solid #e5e7eb', background: '#fff', cursor: hasLoc ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8
                }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: '#22c55e', flexShrink: 0 }} />
                  <strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.displayName}</strong>
                  {(u.squadCount ?? 0) > 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {u.squadCount} 👥</span>}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
                  {hasLoc ? '🗺️ fly' : '— no loc'} · {ageS < 60 ? `${ageS}s` : `${Math.round(ageS / 60)}m`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
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
function publicPersonIcon(hasStorefront = false) {
  return svgMarker(hasStorefront ? '#f59e0b' : '#0ea5e9', hasStorefront ? '🛍' : '🌎');
}
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

// Storefront-aware avatar card shown when a user marker is tapped on the
// map. Renders the avatar, prestige tier, any squads, and (if the user has
// a storefront with public visibility) a compact preview of their products,
// services, and squad-only offers.
function MapAvatarCard(props: {
  displayName: string;
  avatar?: AvatarConfig | any;
  storefront?: Storefront | null;
  squads: { id: string; name: string }[];
  tier: typeof TIERS[number];
  placeName?: string;
  isMe?: boolean;
  onClose: () => void;
}) {
  const { displayName, avatar, storefront, squads, tier, placeName, isMe, onClose } = props;
  const sf = storefront && (storefront.name || storefront.tagline || storefront.bio || (storefront.items && storefront.items.length) || storefront.offers)
    ? storefront : null;
  const items = (sf?.items || []).slice(0, 6);
  const kindLabel: Record<string, string> = {
    business: 'Local business',
    creator: 'Creator',
    service: 'Service / freelancer',
    venue: 'Venue',
    personal: 'Personal',
    none: ''
  };
  const headerBg = sf ? 'linear-gradient(135deg, #fb923c, #ec4899)' : 'linear-gradient(135deg, #8b5cf6, #ec4899)';
  return (
    <div style={{ maxWidth: 280, fontFamily: 'inherit', color: '#111' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', margin: '-12px -12px 8px',
        background: headerBg, color: '#fff', borderTopLeftRadius: 8, borderTopRightRadius: 8
      }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {avatar
            ? <img src={avatarToDataUrl(avatar)} alt="" style={{ width: '100%', height: '100%' }} />
            : <span style={{ fontSize: 20 }}>🧍</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isMe ? `You (${displayName})` : displayName}
          </div>
          <div style={{ fontSize: 11, opacity: 0.95, marginTop: 2 }}>
            {tier.icon} {tier.name}{sf ? ' · 🛍️ Storefront' : ''}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close"
          style={{ background: 'rgba(0,0,0,0.25)', color: '#fff', border: 'none', borderRadius: 999, width: 24, height: 24, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
      </div>

      {sf && (
        <div style={{ marginBottom: 8 }}>
          {sf.name && <div style={{ fontWeight: 700, fontSize: 14 }}>{sf.name}</div>}
          {(sf.kind && kindLabel[sf.kind]) && (
            <div style={{ fontSize: 10, color: '#7c2d12', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>
              {kindLabel[sf.kind]}{sf.category ? ` · ${sf.category}` : ''}
            </div>
          )}
          {sf.tagline && <div style={{ fontSize: 12, color: '#334155', marginTop: 2, fontStyle: 'italic' }}>"{sf.tagline}"</div>}
          {sf.serviceArea && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>📍 {sf.serviceArea}</div>}
          {sf.bio && <div style={{ fontSize: 12, color: '#334155', marginTop: 4, whiteSpace: 'pre-wrap' }}>{sf.bio}</div>}

          {items.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#7c2d12', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Offerings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: '#0f172a' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      • {it.name}{it.note ? <span style={{ color: '#64748b' }}> — {it.note}</span> : null}
                    </span>
                    {it.price && <span style={{ fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>{it.price}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sf.offers && (
            <div style={{ marginTop: 6, padding: '6px 8px', background: '#fef3c7', borderRadius: 6, fontSize: 12, color: '#78350f' }}>
              🎁 <strong>Squad offer:</strong> {sf.offers}
            </div>
          )}

          {(sf.website || sf.instagram) && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#475569', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sf.website && <a href={sf.website.startsWith('http') ? sf.website : `https://${sf.website}`} target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed' }}>🔗 Website</a>}
              {sf.instagram && <a href={`https://instagram.com/${sf.instagram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#ec4899' }}>📷 @{sf.instagram.replace(/^@/, '')}</a>}
            </div>
          )}
        </div>
      )}

      {squads.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>Squads</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {squads.slice(0, 6).map(s => (
              <span key={s.id} style={{ fontSize: 11, padding: '2px 8px', background: '#ede9fe', color: '#5b21b6', borderRadius: 999, fontWeight: 600 }}>
                👥 {s.name}
              </span>
            ))}
            {squads.length > 6 && <span style={{ fontSize: 11, color: '#7c3aed' }}>+{squads.length - 6} more</span>}
          </div>
        </div>
      )}

      {placeName && (
        <div style={{ fontSize: 11, color: '#64748b' }}>📍 at {placeName}</div>
      )}
      {!sf && !isMe && (
        <div style={{ fontSize: 11, color: '#64748b' }}>Sharing publicly 🌎</div>
      )}
      {!sf && isMe && (
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
          💡 Set up your storefront on the Profile page so squadders nearby can see what you do.
        </div>
      )}
    </div>
  );
}

function MyPlaceDetail({ place, onClose }: { place: VisitedPlace; onClose: () => void }) {
  const isReview = place.category === 'Review' || !!place.rating;
  const headerColor = isReview ? '#f59e0b' : (place.category === 'Saved' ? '#22c55e' : '#8b5cf6');
  const dateStr = place.visitedAt
    ? new Date(typeof place.visitedAt === 'number' ? place.visitedAt : place.visitedAt?.toDate?.() || place.visitedAt).toLocaleDateString()
    : '';

  return (
    <div style={{ maxWidth: 260, fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontWeight: 800, color: headerColor, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {place.category || 'Visited'}
        </div>
        <button onClick={onClose} aria-label="Close"
          style={{ background: '#000', color: '#fff', border: 'none', borderRadius: 999, width: 22, height: 22, cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>{place.placeName}</div>
      {place.rating ? (
        <div style={{ marginTop: 4, color: '#f59e0b', fontSize: 14 }}>
          {'★'.repeat(Math.round(place.rating))}
          <span style={{ color: '#cbd5e1' }}>{'★'.repeat(5 - Math.round(place.rating))}</span>
          <span style={{ color: '#64748b', fontSize: 11, marginLeft: 4 }}>{place.rating}/5</span>
        </div>
      ) : null}
      {place.note && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#334155', whiteSpace: 'pre-wrap' }}>
          "{place.note}"
        </div>
      )}
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
        {dateStr && <>Visited {dateStr} · </>}
        {place.publicPinId ? '🌎 Shared publicly' : '🔒 Private to you'}
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

// ——— Path History Panel ———
// Lists the user's last 7 calendar days of GPS breadcrumbs and any peer
// paths they're allowed to see. Lets the user toggle individual days onto
// the map, change global / per-day visibility, and forget any day.
function PathHistoryPanel({
  uid, myPaths, peerPaths, pathRecord, pathVis,
  shownDays, shownPeerIds, squadIds,
  onClose, onToggleRecord, onChangeVis, onToggleMyDay,
  onTogglePeer, onChangeDayVis, onForgetDay, onFlyTo
}: {
  uid: string;
  myPaths: DailyPath[];
  peerPaths: DailyPath[];
  pathRecord: boolean;
  pathVis: DailyPathVis;
  shownDays: Set<string>;
  shownPeerIds: Set<string>;
  squadIds: string[];
  onClose: () => void;
  onToggleRecord: (on: boolean) => void;
  onChangeVis: (v: DailyPathVis) => void;
  onToggleMyDay: (date: string) => void;
  onTogglePeer: (id: string) => void;
  onChangeDayVis: (date: string, v: DailyPathVis) => void;
  onForgetDay: (date: string) => void;
  onFlyTo: (pt: { lat: number; lng: number }) => void;
}) {
  // Group peer paths by uid so multiple days from one squadder collapse
  // into a single expandable card — keeps the list scannable when many
  // people are sharing.
  const peerGroups = useMemo(() => {
    const m = new Map<string, DailyPath[]>();
    for (const p of peerPaths) {
      const list = m.get(p.uid) || [];
      list.push(p);
      m.set(p.uid, list);
    }
    return [...m.entries()].map(([puid, list]) => ({
      uid: puid,
      displayName: list[0]?.displayName || 'Squadder',
      paths: list.sort((a, b) => (a.date < b.date ? 1 : -1))
    }));
  }, [peerPaths]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '85dvh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>🛤️ My path · last {DAILY_PATH_RETAIN_DAYS} days</h2>
          <button onClick={onClose} aria-label="Close"
            style={{ background: '#eee', border: 'none', borderRadius: 999, width: 32, height: 32, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
          Squad REN records a GPS breadcrumb every {Math.round(DAILY_PATH_MIN_S)} seconds or 25 m while recording is on,
          and only keeps the last {DAILY_PATH_RETAIN_DAYS} days. You can share each day with your squad or the world,
          or forget any day instantly.
        </p>

        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Record my path</label>
        <div className="layer-toggle" style={{ marginBottom: 8 }}>
          <button type="button"
            className={'chip ' + (pathRecord ? 'active' : '')}
            onClick={() => onToggleRecord(true)}>● Recording</button>
          <button type="button"
            className={'chip ' + (!pathRecord ? 'active' : '')}
            onClick={() => onToggleRecord(false)}>■ Paused</button>
        </div>

        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Default sharing for new days</label>
        <div className="layer-toggle" style={{ marginBottom: 12 }}>
          <button type="button"
            className={'chip ' + (pathVis === 'private' ? 'active' : '')}
            onClick={() => onChangeVis('private')}>🔒 Private</button>
          <button type="button"
            className={'chip ' + (pathVis === 'squad' ? 'active' : '')}
            disabled={squadIds.length === 0}
            title={squadIds.length === 0 ? 'Join a squad first' : 'Only your squad members can see your path'}
            onClick={() => onChangeVis('squad')}>👥 Squad{squadIds.length === 0 ? ' 🔒' : ''}</button>
          <button type="button"
            className={'chip ' + (pathVis === 'public' ? 'active' : '')}
            onClick={() => onChangeVis('public')}>🌎 Public</button>
        </div>

        <h3 style={{ marginBottom: 6 }}>Your days</h3>
        {myPaths.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--muted)', padding: 8 }}>
            No path recorded yet — turn on recording and start moving. (Or tap
            <strong> Check in here</strong> on the map to seed today's path.)
          </div>
        )}
        {myPaths.map(p => {
          const km = dailyPathDistanceKm(p.points);
          const showing = shownDays.has(p.date);
          const first = p.points?.[0];
          const visIcon = p.visibility === 'public' ? '🌎' : p.visibility === 'squad' ? '👥' : '🔒';
          return (
            <div key={p.id} style={{
              border: '1px solid #e5e7eb', borderRadius: 10, padding: 10,
              marginBottom: 8, background: showing ? '#f5f3ff' : '#fff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 12, height: 12, borderRadius: 999,
                  background: pathColor(p.id), flex: '0 0 12px'
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{labelForDate(p.date)}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {p.points?.length || 0} points · {km.toFixed(2)} km · {visIcon} {p.visibility}
                  </div>
                </div>
                <button className={'chip ' + (showing ? 'active' : '')}
                  onClick={() => onToggleMyDay(p.date)}
                  title={showing ? 'Hide on map' : 'Show on map'}>
                  {showing ? '◉ Shown' : '○ Show'}
                </button>
              </div>
              <div className="layer-toggle" style={{ marginTop: 8 }}>
                <button type="button"
                  className={'chip ' + (p.visibility === 'private' ? 'active' : '')}
                  onClick={() => onChangeDayVis(p.date, 'private')}>🔒</button>
                <button type="button"
                  className={'chip ' + (p.visibility === 'squad' ? 'active' : '')}
                  disabled={squadIds.length === 0}
                  onClick={() => onChangeDayVis(p.date, 'squad')}>👥</button>
                <button type="button"
                  className={'chip ' + (p.visibility === 'public' ? 'active' : '')}
                  onClick={() => onChangeDayVis(p.date, 'public')}>🌎</button>
                {first && (
                  <button type="button" className="chip"
                    onClick={() => onFlyTo({ lat: first.lat, lng: first.lng })}>
                    🎯 Jump
                  </button>
                )}
                <button type="button" className="chip"
                  onClick={() => {
                    if (window.confirm(`Forget ${labelForDate(p.date)} permanently?`)) {
                      onForgetDay(p.date);
                    }
                  }}
                  title="Delete this day's path">🗑️ Forget</button>
              </div>
            </div>
          );
        })}

        {peerGroups.length > 0 && (
          <>
            <h3 style={{ marginTop: 16, marginBottom: 6 }}>Shared with you</h3>
            {peerGroups.map(g => (
              <div key={g.uid} style={{
                border: '1px solid #e5e7eb', borderRadius: 10, padding: 10,
                marginBottom: 8, background: '#fff'
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{g.displayName}</div>
                {g.paths.map(p => {
                  const km = dailyPathDistanceKm(p.points);
                  const showing = shownPeerIds.has(p.id);
                  const first = p.points?.[0];
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: pathColor(p.id) }} />
                      <div style={{ flex: 1, fontSize: 12 }}>
                        <strong>{labelForDate(p.date)}</strong>
                        <span style={{ color: 'var(--muted)', marginLeft: 6 }}>
                          {p.points?.length || 0} pts · {km.toFixed(2)} km · {p.visibility === 'public' ? '🌎' : '👥'}
                        </span>
                      </div>
                      {first && (
                        <button className="chip"
                          onClick={() => onFlyTo({ lat: first.lat, lng: first.lng })}>🎯</button>
                      )}
                      <button className={'chip ' + (showing ? 'active' : '')}
                        onClick={() => onTogglePeer(p.id)}>{showing ? '◉' : '○'}</button>
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// Pretty label for the breadcrumb cadence shown in the panel. Inline so we
// don't have to thread the constant through props.
const DAILY_PATH_MIN_S = 10;
