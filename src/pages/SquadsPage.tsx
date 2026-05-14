import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
  createSquad, leaveSquad, watchPublicSquadsLive, watchUserSquads,
  updateSquadLogo, updateSquadHq,
  requestJoinSquad, approveJoinRequest, denyJoinRequest, removeSquadMember,
  type Squad
} from '../lib/data';
import {
  SQUAD_LOGOS, DEFAULT_LOGO_ID, getLogo, type SquadLogo
} from '../lib/squadLogos';
import { loadLocalStats, tierForXp, TIERS } from '../lib/prestige';
import { haversine } from '../lib/geo';
import { useLocation } from '../lib/useLocation';

// Built-in interest tags users can attach to their squad. Powers
// "squads who share your vibe" discovery on the public list.
const INTEREST_TAGS = [
  'coffee', 'food', 'nightlife', 'music', 'concerts', 'sports',
  'hiking', 'travel', 'gaming', 'study', 'work', 'art',
  'fitness', 'photography', 'foodies', 'dance', 'cycling', 'pets'
];

function SquadCrest({ logoId, size = 36 }: { logoId?: string; size?: number }) {
  const logo = getLogo(logoId || DEFAULT_LOGO_ID);
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: logo.bg,
      display: 'grid', placeItems: 'center',
      fontSize: size * 0.55, lineHeight: 1,
      flex: `0 0 ${size}px`,
      boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
    }}>
      <span>{logo.glyph}</span>
    </div>
  );
}

function LogoPicker({ value, onChange, tier, onClose }: {
  value: string;
  onChange: (id: string) => void;
  tier: number;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Choose squad crest</h2>
          <button onClick={onClose} aria-label="Close"
            style={{ background: '#eee', border: 'none', borderRadius: 999, width: 32, height: 32, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
          Your squad is currently <strong>Tier {tier}</strong> ({TIERS[tier]?.name || '—'}).
          Rank up to unlock more crests.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
          {SQUAD_LOGOS.map((l: SquadLogo) => {
            const locked = l.tier > tier;
            const active = value === l.id;
            return (
              <button key={l.id} type="button" disabled={locked}
                onClick={() => { if (!locked) onChange(l.id); }}
                title={locked ? `Unlocks at Tier ${l.tier} (${TIERS[l.tier]?.name})` : l.name}
                style={{
                  background: active ? l.bg : (locked ? '#f3f4f6' : '#fff'),
                  border: active ? '2px solid #111' : '1px solid #ddd',
                  borderRadius: 12, padding: '10px 6px',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  opacity: locked ? 0.55 : 1,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 4, position: 'relative'
                }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: l.bg, display: 'grid', placeItems: 'center', fontSize: 22, filter: locked ? 'grayscale(0.7)' : 'none' }}>{l.glyph}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: active ? '#fff' : '#111' }}>{l.name}</div>
                {locked && (
                  <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 10, background: '#111', color: '#fff', borderRadius: 6, padding: '1px 5px' }}>
                    T{l.tier} 🔒
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function shortUid(uid: string) {
  return uid.length > 10 ? uid.slice(0, 6) + '…' + uid.slice(-3) : uid;
}

function fmtDist(m: number) {
  if (!isFinite(m)) return null;
  if (m < 1000) return Math.round(m) + ' m away';
  return (m / 1000).toFixed(m < 10_000 ? 1 : 0) + ' km away';
}

function NearbyOrPublicRow({ squad, dist, requested, onRequest }: {
  squad: Squad;
  dist: number;
  requested: boolean;
  onRequest: () => void;
}) {
  const distLabel = fmtDist(dist);
  return (
    <div className="list-item">
      <SquadCrest logoId={squad.logo} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{squad.name}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          {squad.members.length} members
          {squad.hq && ' · 📍 HQ'}
          {distLabel && ' · ' + distLabel}
        </div>
        {squad.tags && squad.tags.length > 0 && (
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {squad.tags.slice(0, 4).map(t => (
              <span key={t} style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 999,
                background: '#f1f5f9', color: '#475569', fontWeight: 600
              }}>#{t}</span>
            ))}
          </div>
        )}
      </div>
      {requested ? (
        <button className="btn ghost" style={{ width: 'auto' }} disabled>Requested ⏳</button>
      ) : (
        <button className="btn secondary" style={{ width: 'auto' }} onClick={onRequest}>Request join</button>
      )}
    </div>
  );
}

export default function SquadsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState<Squad[]>([]);
  const [pub, setPub] = useState<Squad[]>([]);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [newLogo, setNewLogo] = useState<string>(DEFAULT_LOGO_ID);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const { pos } = useLocation({ enabled: !!user });

  const myStats = user ? loadLocalStats() : { xp: 0 } as any;
  const myTier = tierForXp(myStats.xp || 0).tier;

  useEffect(() => {
    if (!user) return;
    const unsubMine = watchUserSquads(user.uid, setMine);
    const unsubPub = watchPublicSquadsLive(setPub);
    return () => { unsubMine && unsubMine(); unsubPub && unsubPub(); };
  }, [user?.uid]);

  async function onCreate() {
    if (!user || !name.trim()) return;
    await createSquad({
      name: name.trim(), ownerId: user.uid, members: [user.uid],
      visibility, logo: newLogo, pendingMembers: [], tags: newTags
    });
    setName('');
    setNewLogo(DEFAULT_LOGO_ID);
    setNewTags([]);
  }

  async function setLogoFor(squadId: string, logo: string) {
    await updateSquadLogo(squadId, logo);
  }

  function pinHqOnMap(squadId: string) {
    // Hand off to the map page, which reads ?setHq=<id> on mount and enters
    // HQ-drop mode (banner + tap-to-place flow).
    navigate('/?setHq=' + encodeURIComponent(squadId));
  }

  async function pinHqHere(squadId: string) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => updateSquadHq(squadId, { lat: p.coords.latitude, lng: p.coords.longitude }),
      err => alert('Could not get your location: ' + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  if (!user) return null;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Squads</h1>
        <Link to="/leaderboard" className="btn ghost" style={{ width: 'auto', textDecoration: 'none' }}>
          🏆 Leaderboard
        </Link>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Create a Squad</h2>
        <label>Squad name</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="The Concert Crew" />

        <label>Crest</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <SquadCrest logoId={newLogo} size={44} />
          <button type="button" className="btn ghost" style={{ width: 'auto' }}
            onClick={() => setPickerFor('new')}>Pick crest…</button>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {SQUAD_LOGOS.filter(l => l.tier <= myTier).length} of {SQUAD_LOGOS.length} unlocked
          </div>
        </div>

        <label>Visibility</label>
        <select className="select" value={visibility} onChange={e => setVisibility(e.target.value as any)}>
          <option value="private">Private — invite only</option>
          <option value="public">Public — discoverable, join via request</option>
        </select>

        <label style={{ marginTop: 8 }}>Interests (helps people find you)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {INTEREST_TAGS.map(t => {
            const on = newTags.includes(t);
            return (
              <button key={t} type="button"
                onClick={() => setNewTags(prev => on ? prev.filter(x => x !== t) : [...prev, t])}
                style={{
                  padding: '4px 10px', borderRadius: 999, fontSize: 12,
                  cursor: 'pointer',
                  background: on ? 'linear-gradient(135deg,#8b5cf6,#ec4899)' : '#f1f5f9',
                  color: on ? '#fff' : '#334155',
                  border: 'none', fontWeight: 600
                }}>
                #{t}
              </button>
            );
          })}
        </div>
        <div style={{ height: 8 }} />
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
          You become the squad <strong>leader</strong> and can approve/deny members and pin the HQ on the map.
        </div>
        <button className="btn" onClick={onCreate} disabled={!name.trim()}>Create</button>
      </div>

      <h2>Your Squads</h2>
      {mine.length === 0 && <div className="empty">No squads yet. Create one above.</div>}
      <div className="list">
        {mine.map(s => {
          const isLeader = s.ownerId === user.uid;
          const pending = s.pendingMembers || [];
          return (
            <div key={s.id} className="list-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                <SquadCrest logoId={s.logo} size={40} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {s.name} {isLeader && <span className="pill" style={{ marginLeft: 6 }}>👑 Leader</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {s.members.length} members · <span className={'pill ' + (s.visibility === 'public' ? '' : 'warn')}>{s.visibility}</span>
                    {s.hq && <span style={{ marginLeft: 6 }}>📍 HQ pinned</span>}
                  </div>
                </div>
                {isLeader && (
                  <button className="btn ghost" style={{ width: 'auto' }}
                    onClick={() => setPickerFor(s.id)}>Crest</button>
                )}
                <button className="btn ghost" onClick={() => leaveSquad(s.id, user.uid)}>Leave</button>
              </div>

              {isLeader && (
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <button className="btn secondary" style={{ width: 'auto' }}
                      onClick={() => pinHqOnMap(s.id)}>
                      📍 {s.hq ? 'Move HQ on map' : 'Pin HQ on map'}
                    </button>
                    <button className="btn ghost" style={{ width: 'auto' }}
                      onClick={() => pinHqHere(s.id)}>Use my location</button>
                  </div>

                  {pending.length > 0 && (
                    <div style={{ marginTop: 10, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                        ⏳ {pending.length} join request{pending.length === 1 ? '' : 's'}
                      </div>
                      {pending.map(uid => (
                        <div key={uid} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0' }}>
                          <div style={{ flex: 1, fontSize: 12 }}>{shortUid(uid)}</div>
                          <button className="btn secondary" style={{ width: 'auto', padding: '4px 10px' }}
                            onClick={() => approveJoinRequest(s.id, uid)}>Approve</button>
                          <button className="btn ghost" style={{ width: 'auto', padding: '4px 10px' }}
                            onClick={() => denyJoinRequest(s.id, uid)}>Deny</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Members</div>
                    {s.members.map(uid => (
                      <div key={uid} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 0' }}>
                        <div style={{ flex: 1, fontSize: 12 }}>
                          {shortUid(uid)} {uid === s.ownerId && <span style={{ color: '#a16207' }}>👑</span>}
                          {uid === user.uid && <span style={{ color: 'var(--muted)' }}> (you)</span>}
                        </div>
                        {uid !== s.ownerId && (
                          <button className="btn ghost" style={{ width: 'auto', padding: '2px 8px', fontSize: 11 }}
                            onClick={() => removeSquadMember(s.id, uid)}>Remove</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h2>Discover Public Squads</h2>
      {/* Tag filter — surface squads aligned with the user's vibe. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '4px 0 10px' }}>
        <button type="button" onClick={() => setTagFilter(null)}
          style={{
            padding: '4px 10px', borderRadius: 999, fontSize: 12, border: 'none', cursor: 'pointer',
            fontWeight: 700,
            background: !tagFilter ? '#111' : '#f1f5f9',
            color: !tagFilter ? '#fff' : '#334155'
          }}>All</button>
        {INTEREST_TAGS.map(t => {
          const on = tagFilter === t;
          return (
            <button key={t} type="button" onClick={() => setTagFilter(on ? null : t)}
              style={{
                padding: '4px 10px', borderRadius: 999, fontSize: 12, border: 'none', cursor: 'pointer',
                background: on ? '#111' : '#f1f5f9',
                color: on ? '#fff' : '#334155', fontWeight: 600
              }}>
              #{t}
            </button>
          );
        })}
      </div>
      {(() => {
        const candidates = pub.filter(s => !s.members.includes(user.uid));
        const filtered = tagFilter ? candidates.filter(s => (s.tags || []).includes(tagFilter)) : candidates;

        // Proximity sort when we have GPS + at least one squad with HQ.
        const withDist = filtered.map(s => ({
          s,
          dist: pos && s.hq ? haversine(pos, s.hq) : Infinity
        }));
        const nearby = withDist
          .filter(x => x.dist !== Infinity && x.dist <= 25_000) // within 25km
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 5);
        const rest = withDist
          .filter(x => !nearby.find(n => n.s.id === x.s.id))
          .sort((a, b) => a.dist - b.dist);

        return (
          <>
            {nearby.length > 0 && (
              <div className="card" style={{ background: 'linear-gradient(135deg, #ec489922, #8b5cf622)' }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>📍 Squads near you</div>
                <div className="list" style={{ background: 'transparent', padding: 0 }}>
                  {nearby.map(({ s, dist }) => (
                    <NearbyOrPublicRow key={s.id} squad={s} dist={dist}
                      requested={(s.pendingMembers || []).includes(user.uid)}
                      onRequest={() => requestJoinSquad(s.id, user.uid)} />
                  ))}
                </div>
              </div>
            )}
            {filtered.length === 0 && <div className="empty">No public squads match this filter yet.</div>}
            <div className="list">
              {rest.map(({ s, dist }) => (
                <NearbyOrPublicRow key={s.id} squad={s} dist={dist}
                  requested={(s.pendingMembers || []).includes(user.uid)}
                  onRequest={() => requestJoinSquad(s.id, user.uid)} />
              ))}
            </div>
          </>
        );
      })()}

      {pickerFor && (
        <LogoPicker
          value={pickerFor === 'new' ? newLogo : (mine.find(s => s.id === pickerFor)?.logo || DEFAULT_LOGO_ID)}
          tier={myTier}
          onChange={id => {
            if (pickerFor === 'new') setNewLogo(id);
            else setLogoFor(pickerFor, id);
          }}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  );
}
