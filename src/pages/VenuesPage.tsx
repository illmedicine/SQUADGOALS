import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { watchUserSquads, type Squad } from '../lib/data';
import {
  fetchEvents, createRally, deleteRally, watchRalliesForEvent, watchMySquadRallies,
  fmtEventDate, fmtPrice, cacheAge, clearCache, CATEGORY_ICONS, TM_CONFIGURED,
  type VenueEvent, type Rally,
} from '../lib/venues';

type CityFilter = 'all' | 'buffalo' | 'toronto';
type CatFilter = 'all' | 'Music' | 'Sports' | 'Arts & Theatre' | 'Film' | 'Miscellaneous';

const CATS: CatFilter[] = ['all', 'Music', 'Sports', 'Arts & Theatre', 'Film', 'Miscellaneous'];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VenuesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [squads, setSquads] = useState<Squad[]>([]);
  const [myRallies, setMyRallies] = useState<Rally[]>([]);

  const [bufEvents, setBufEvents] = useState<VenueEvent[]>([]);
  const [torEvents, setTorEvents] = useState<VenueEvent[]>([]);
  const [loadingBuf, setLoadingBuf] = useState(false);
  const [loadingTor, setLoadingTor] = useState(false);
  const [errorBuf, setErrorBuf] = useState<string | null>(null);
  const [errorTor, setErrorTor] = useState<string | null>(null);

  const [city, setCity] = useState<CityFilter>('all');
  const [cat, setCat] = useState<CatFilter>('all');
  const [rallyModal, setRallyModal] = useState<VenueEvent | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(Date.now());

  // ── Subscriptions ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    return watchUserSquads(user.uid, setSquads);
  }, [user?.uid]);

  const squadIds = useMemo(() => squads.map(s => s.id), [squads]);

  useEffect(() => {
    if (!user) return;
    return watchMySquadRallies(squadIds, setMyRallies);
  }, [user?.uid, squadIds.join(',')]);

  // ── Event loading ─────────────────────────────────────────────────────────────
  const load = useCallback(async (force = false) => {
    if (!TM_CONFIGURED) return;

    setLoadingBuf(true); setErrorBuf(null);
    fetchEvents('buffalo', { forceRefresh: force })
      .then(setBufEvents)
      .catch(e => setErrorBuf(e?.message || 'Failed to load Buffalo events.'))
      .finally(() => setLoadingBuf(false));

    setLoadingTor(true); setErrorTor(null);
    fetchEvents('toronto', { forceRefresh: force })
      .then(setTorEvents)
      .catch(e => setErrorTor(e?.message || 'Failed to load Toronto events.'))
      .finally(() => setLoadingTor(false));

    setLastFetch(Date.now());
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filtered events ──────────────────────────────────────────────────────────
  const events = useMemo(() => {
    const pool = [
      ...(city !== 'toronto' ? bufEvents : []),
      ...(city !== 'buffalo' ? torEvents : []),
    ];
    const now = new Date().toISOString().slice(0, 10);
    return pool
      .filter(e => e.date >= now && e.status !== 'cancelled')
      .filter(e => cat === 'all' || e.category === cat)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [bufEvents, torEvents, city, cat]);

  const loading = loadingBuf || loadingTor;

  // ── Cache age label ──────────────────────────────────────────────────────────
  const ageLabel = useMemo(() => {
    const ages = ['buffalo', 'toronto'].map(c => cacheAge(c)).filter(Boolean) as number[];
    if (!ages.length) return null;
    const minAge = Math.min(...ages);
    if (minAge < 60_000) return 'Updated just now';
    if (minAge < 3_600_000) return `Updated ${Math.round(minAge / 60_000)}m ago`;
    return `Updated ${Math.round(minAge / 3_600_000)}h ago`;
  }, [lastFetch]);

  if (!TM_CONFIGURED) {
    return <SetupScreen />;
  }

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>🎟️ Venues</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            Live events · Buffalo to Toronto
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          {ageLabel && <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{ageLabel}</div>}
          <button className="btn ghost" style={{ width: 'auto', fontSize: 12, padding: '5px 12px' }}
            disabled={loading}
            onClick={() => { clearCache(); load(true); }}>
            {loading ? '⏳ Loading…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Squad rallies for me */}
      {myRallies.length > 0 && (
        <div style={{
          margin: '14px 0 0', padding: '10px 12px', borderRadius: 12,
          background: 'linear-gradient(135deg,#8b5cf622,#ec489922)',
          border: '1px solid #8b5cf644'
        }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>⚡ Your squad is rallied for:</div>
          {myRallies.slice(0, 3).map(r => (
            <div key={r.id} style={{ fontSize: 12, color: '#4c1d95', marginBottom: 2 }}>
              🚐 <strong>{r.squadName}</strong> → {r.eventName} · {r.eventDate}
            </div>
          ))}
        </div>
      )}

      {/* City filter */}
      <div style={{ display: 'flex', gap: 6, margin: '14px 0 10px' }}>
        {(['all', 'buffalo', 'toronto'] as CityFilter[]).map(c => (
          <button key={c} onClick={() => setCity(c)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 12, border: 'none',
              fontWeight: 700, fontSize: 12, cursor: 'pointer',
              background: city === c ? '#111' : '#f1f5f9',
              color: city === c ? '#fff' : '#334155',
            }}>
            {c === 'all' ? '🗺️ All' : c === 'buffalo' ? '🦬 Buffalo' : '🇨🇦 Toronto'}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{
              padding: '5px 12px', borderRadius: 999, border: 'none',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
              background: cat === c ? '#0ea5e9' : '#f1f5f9',
              color: cat === c ? '#fff' : '#334155',
              flexShrink: 0,
            }}>
            {c === 'all' ? 'All events' : `${CATEGORY_ICONS[c] || '📅'} ${c}`}
          </button>
        ))}
      </div>

      {/* Errors */}
      {(errorBuf || errorTor) && (
        <div style={{ padding: 10, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#991b1b', marginBottom: 12 }}>
          ⚠ {errorBuf || errorTor}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && events.length === 0 && (
        <div>
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ marginBottom: 10, opacity: 0.5 }}>
              <div style={{ height: 140, borderRadius: 10, background: '#f1f5f9', marginBottom: 10 }} />
              <div style={{ height: 16, borderRadius: 6, background: '#f1f5f9', marginBottom: 6, width: '70%' }} />
              <div style={{ height: 12, borderRadius: 6, background: '#f1f5f9', width: '50%' }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && events.length === 0 && !errorBuf && !errorTor && (
        <div className="empty">No upcoming events found for this filter.</div>
      )}

      {/* Event list */}
      {events.map(ev => (
        <EventCard
          key={ev.id}
          event={ev}
          squads={squads}
          myRallies={myRallies}
          onRally={() => setRallyModal(ev)}
          onBookRide={() => {
            sessionStorage.setItem('squadren.rides.charter', JSON.stringify({
              destination: `${ev.venueName}${ev.venueAddress ? ', ' + ev.venueAddress : ''}`,
              date: ev.date,
              notes: `${ev.name} — ${fmtEventDate(ev.date, ev.time)}`,
            }));
            navigate('/rides');
          }}
        />
      ))}

      {/* Rally modal */}
      {rallyModal && user && (
        <RallyModal
          event={rallyModal}
          squads={squads}
          myRallies={myRallies}
          user={user}
          onClose={() => setRallyModal(null)}
          onRally={async (squad) => {
            await createRally({
              eventId: rallyModal.id,
              eventName: rallyModal.name,
              eventDate: rallyModal.date,
              venueName: rallyModal.venueName,
              venueCity: rallyModal.city,
              squadId: squad.id,
              squadName: squad.name,
              createdBy: user.uid,
              createdByName: user.displayName,
            });
          }}
          onUnrally={async (rallyId) => {
            await deleteRally(rallyId);
          }}
        />
      )}
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, squads, myRallies, onRally, onBookRide }: {
  event: VenueEvent;
  squads: Squad[];
  myRallies: Rally[];
  onRally: () => void;
  onBookRide: () => void;
}) {
  const [eventRallies, setEventRallies] = useState<Rally[]>([]);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    return watchRalliesForEvent(event.id, setEventRallies);
  }, [event.id]);

  const mySquadRallyNames = eventRallies
    .filter(r => myRallies.some(mr => mr.squadId === r.squadId && mr.eventId === event.id))
    .map(r => r.squadName);

  const isRallied = mySquadRallyNames.length > 0;
  const isCancelled = event.status === 'cancelled' || event.status === 'offsale';
  const catIcon = CATEGORY_ICONS[event.category] || '📅';

  // Determine which ride type works best
  const isLocalBuf = event.city === 'buffalo';
  const routeId = isLocalBuf ? null : 'toronto'; // charter for Toronto, could also match static routes
  const matchedRoute = isLocalBuf ? '🎟️ Book Static Ride' : '🚐 Charter to Toronto';

  return (
    <div className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden', opacity: isCancelled ? 0.6 : 1 }}>
      {/* Image */}
      {event.imageUrl && !imgError && (
        <img
          src={event.imageUrl}
          alt={event.name}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
        />
      )}

      <div style={{ padding: '12px 14px 14px' }}>
        {/* Category + city badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            background: event.city === 'buffalo' ? '#fef3c7' : '#dbeafe',
            color: event.city === 'buffalo' ? '#92400e' : '#1e40af',
          }}>
            {event.city === 'buffalo' ? '🦬 Buffalo' : '🇨🇦 Toronto'}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            background: '#f1f5f9', color: '#475569',
          }}>
            {catIcon} {event.genre || event.category}
          </span>
          {isCancelled && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#fef2f2', color: '#991b1b' }}>
              CANCELLED
            </span>
          )}
        </div>

        {/* Name */}
        <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.25, marginBottom: 4 }}>
          {event.name}
        </div>

        {/* Date + venue */}
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>
          📅 {fmtEventDate(event.date, event.time)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
          📍 {event.venueName}{event.venueAddress ? ` · ${event.venueAddress}` : ''}
        </div>

        {/* Price */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
          {fmtPrice(event.minPrice, event.maxPrice, event.currency)}
        </div>

        {/* Rally indicator */}
        {isRallied && (
          <div style={{
            fontSize: 12, color: '#7c3aed', fontWeight: 700, marginBottom: 8,
            padding: '4px 8px', borderRadius: 8, background: '#f5f3ff', display: 'inline-block'
          }}>
            ⚡ {mySquadRallyNames.join(', ')} rallied
          </div>
        )}
        {eventRallies.length > 0 && !isRallied && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
            {eventRallies.length} squad{eventRallies.length > 1 ? 's' : ''} going
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={isRallied ? 'btn' : 'btn ghost'}
            style={{ flex: 1, fontSize: 12, padding: '8px 4px', background: isRallied ? '#8b5cf6' : undefined, borderColor: '#8b5cf6', color: isRallied ? '#fff' : '#8b5cf6' }}
            onClick={onRally}
            disabled={squads.length === 0}
            title={squads.length === 0 ? 'Join a squad to rally' : undefined}
          >
            {isRallied ? '⚡ Rallied' : '⚡ Rally Squad'}
          </button>

          <button
            className="btn"
            style={{ flex: 1, fontSize: 12, padding: '8px 4px' }}
            onClick={onBookRide}
          >
            🚐 {matchedRoute}
          </button>

          {event.url && (
            <a href={event.url} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 36, borderRadius: 10, border: '1px solid #e2e8f0',
                textDecoration: 'none', fontSize: 14, background: '#f8fafc', flexShrink: 0
              }}
              title="Get tickets on Ticketmaster">
              🎟️
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Rally Modal ──────────────────────────────────────────────────────────────

function RallyModal({ event, squads, myRallies, user, onClose, onRally, onUnrally }: {
  event: VenueEvent;
  squads: Squad[];
  myRallies: Rally[];
  user: { uid: string; displayName: string };
  onClose: () => void;
  onRally: (squad: Squad) => Promise<void>;
  onUnrally: (rallyId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(squad: Squad) {
    const existing = myRallies.find(r => r.squadId === squad.id && r.eventId === event.id);
    setBusy(squad.id);
    try {
      if (existing) await onUnrally(existing.id);
      else await onRally(squad);
    } finally { setBusy(null); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>⚡ Rally a Squad</h2>
          <button onClick={onClose} style={{ background: '#eee', border: 'none', borderRadius: 999, width: 32, height: 32, cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <div className="card" style={{ background: '#f8fafc', margin: '12px 0' }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{event.name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            📅 {fmtEventDate(event.date, event.time)}<br />
            📍 {event.venueName}
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px' }}>
          Rallying lets your squad members know you're going and prompts them to book a ride together.
        </p>

        {squads.length === 0 && (
          <div className="empty">Join or create a squad first to rally your crew.</div>
        )}

        {squads.map(squad => {
          const isRallied = myRallies.some(r => r.squadId === squad.id && r.eventId === event.id);
          return (
            <div key={squad.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{squad.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{squad.members.length} members</div>
              </div>
              <button
                onClick={() => toggle(squad)}
                disabled={busy === squad.id}
                style={{
                  padding: '6px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 12,
                  background: isRallied ? '#8b5cf6' : '#f1f5f9',
                  color: isRallied ? '#fff' : '#334155',
                }}>
                {busy === squad.id ? '…' : isRallied ? '⚡ Rallied' : 'Rally'}
              </button>
            </div>
          );
        })}

        <button className="btn" style={{ marginTop: 14 }} onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

// ─── Setup Screen (no API key) ────────────────────────────────────────────────

function SetupScreen() {
  return (
    <div className="page">
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>🎟️ Venues</h1>

      <div className="card" style={{ background: 'linear-gradient(135deg,#fef3c7,#fff7ed)', border: '1px solid #fcd34d' }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>⚙️ One-time setup required</div>
        <p style={{ fontSize: 13, margin: '0 0 12px', lineHeight: 1.6 }}>
          The Venues feature pulls live event data from the <strong>Ticketmaster Discovery API</strong>.
          The free tier gives <strong>5,000 calls/day</strong> — more than enough.
        </p>

        <div style={{ fontSize: 13, lineHeight: 2 }}>
          <div><strong>1.</strong> Go to <strong>developer.ticketmaster.com</strong></div>
          <div><strong>2.</strong> Sign up and create an app — get your <strong>Consumer Key</strong></div>
          <div><strong>3.</strong> Add it to GitHub repo secrets as <code style={{ background: '#fef9c3', padding: '1px 4px', borderRadius: 4 }}>VITE_TICKETMASTER_API_KEY</code></div>
          <div><strong>4.</strong> Also add it to your local <code style={{ background: '#fef9c3', padding: '1px 4px', borderRadius: 4 }}>.env.local</code> file</div>
          <div><strong>5.</strong> Push any change to trigger a redeploy → Venues goes live</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12, background: '#f0fdf4' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>What you'll get</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9 }}>
          <li>50 upcoming Buffalo events (concerts, sports, arts)</li>
          <li>50 upcoming Toronto events</li>
          <li>Auto-refreshes every 6 hours</li>
          <li>Squad rallying — let your crew know you're going</li>
          <li>One-tap ride booking straight from the event card</li>
        </ul>
      </div>
    </div>
  );
}
