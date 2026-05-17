import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
  watchPublicSquadsLive, listDemoSquads, requestJoinSquad,
  type Squad
} from '../lib/data';
import { tierForXp, TIERS } from '../lib/prestige';
import { getLogo, DEFAULT_LOGO_ID } from '../lib/squadLogos';
import { squadPrestige, type SquadStats } from '../lib/demoSeed';
import { haversine } from '../lib/geo';
import { useLocation } from '../lib/useLocation';
import { watchPublicStorefronts, type PublicStorefront } from '../lib/storefronts';

// What can we rank squads on? Each metric resolves to a number from a
// SquadStats record + an icon for the chip.
type MetricKey = 'totalXp' | 'pins' | 'reviews' | 'checkIns' | 'members';
const METRICS: { key: MetricKey; label: string; icon: string; suffix?: string }[] = [
  { key: 'totalXp',  label: 'Total XP',  icon: '⚡' },
  { key: 'pins',     label: 'Pins',      icon: '📍' },
  { key: 'reviews',  label: 'Reviews',   icon: '⭐' },
  { key: 'checkIns', label: 'Check-ins', icon: '☕' },
  { key: 'members',  label: 'Members',   icon: '👥' }
];

type RankedSquad = Squad & {
  stats: SquadStats;
  lat?: number;
  lng?: number;
  isReal: boolean;
  dist: number;
};

// Real (user-created) squads don't have baked stats yet, so we derive a
// minimal record from what we know. Once a real Firestore stats roll-up
// lands, this falls away.
function statsForRealSquad(s: Squad): SquadStats {
  return {
    members: s.members.length,
    pins: 0,
    checkIns: 0,
    reviews: 0,
    totalXp: 0,
    ageDays: 0
  };
}

const INTEREST_TAGS = [
  'coffee', 'food', 'nightlife', 'music', 'concerts', 'sports',
  'hiking', 'travel', 'gaming', 'study', 'work', 'art',
  'fitness', 'photography', 'foodies', 'dance', 'cycling', 'pets'
];

function Crest({ logoId, size = 36 }: { logoId?: string; size?: number }) {
  const logo = getLogo(logoId || DEFAULT_LOGO_ID);
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: logo.bg, display: 'grid', placeItems: 'center',
      fontSize: size * 0.55, lineHeight: 1, flex: `0 0 ${size}px`,
      boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
    }}>
      <span>{logo.glyph}</span>
    </div>
  );
}

function fmtDist(m: number) {
  if (!isFinite(m)) return null;
  if (m < 1000) return Math.round(m) + ' m';
  return (m / 1000).toFixed(m < 10_000 ? 1 : 0) + ' km';
}

function fmtNum(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0) + 'k';
  return String(n);
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [pub, setPub] = useState<Squad[]>([]);
  const [metric, setMetric] = useState<MetricKey>('totalXp');
  const [scope, setScope] = useState<'global' | 'nearby' | 'tier' | 'tag'>('global');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const { pos } = useLocation({ enabled: !!user });
  const [storefronts, setStorefronts] = useState<PublicStorefront[]>([]);

  useEffect(() => watchPublicSquadsLive(setPub), []);
  useEffect(() => watchPublicStorefronts(setStorefronts), []);

  // Merge real public squads with the seeded demo squads so the world
  // feels populated. De-dupe by id (real squads win).
  const all: RankedSquad[] = useMemo(() => {
    const demo = listDemoSquads();
    const realIds = new Set(pub.map(s => s.id));
    const realRanked: RankedSquad[] = pub.map(s => ({
      ...s,
      stats: statsForRealSquad(s),
      lat: s.hq?.lat,
      lng: s.hq?.lng,
      isReal: true,
      dist: pos && s.hq ? haversine(pos, s.hq) : Infinity
    }));
    const demoRanked: RankedSquad[] = demo
      .filter(d => !realIds.has(d.id))
      .map(d => ({
        ...d,
        isReal: false,
        dist: pos ? haversine(pos, { lat: d.lat, lng: d.lng }) : Infinity
      }));
    return [...realRanked, ...demoRanked];
  }, [pub, pos]);

  const myUid = user?.uid;

  const ranked = useMemo(() => {
    let list = all;
    if (scope === 'nearby') {
      list = list.filter(s => isFinite(s.dist) && s.dist <= 50_000);
    } else if (scope === 'tier' && tierFilter !== null) {
      list = list.filter(s => squadPrestige(s.stats).tier === tierFilter);
    } else if (scope === 'tag' && tagFilter) {
      list = list.filter(s => (s.tags || []).includes(tagFilter));
    }
    return [...list].sort((a, b) => b.stats[metric] - a.stats[metric]).slice(0, 50);
  }, [all, metric, scope, tagFilter, tierFilter]);

  // Where does the player's own squad(s) sit on the global board?
  const myRanks = useMemo(() => {
    if (!myUid) return [];
    const sortedFull = [...all].sort((a, b) => b.stats[metric] - a.stats[metric]);
    return sortedFull
      .map((s, i) => ({ s, rank: i + 1 }))
      .filter(x => x.s.members.includes(myUid));
  }, [all, metric, myUid]);

  const metricMeta = METRICS.find(m => m.key === metric)!;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>🏆 Leaderboard</h1>
        <Link to="/squads" className="btn ghost" style={{ width: 'auto', textDecoration: 'none' }}>
          Squads →
        </Link>
      </div>
      <p style={{ color: 'var(--muted)', marginTop: 4 }}>
        Where does your squad stack up? Compare public squads by XP, pins, reviews and more.
      </p>

      {/* Metric tabs */}
      <div className="card" style={{ padding: 8 }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {METRICS.map(m => {
            const on = metric === m.key;
            return (
              <button key={m.key} type="button" onClick={() => setMetric(m.key)}
                style={{
                  flex: '0 0 auto', padding: '8px 14px', borderRadius: 999,
                  fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                  background: on ? 'linear-gradient(135deg,#8b5cf6,#ec4899)' : '#f1f5f9',
                  color: on ? '#fff' : '#334155'
                }}>
                {m.icon} {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scope chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {(['global', 'nearby', 'tier', 'tag'] as const).map(s => {
          const on = scope === s;
          const label = s === 'global' ? '🌍 Global'
            : s === 'nearby' ? '📍 Nearby (50km)'
            : s === 'tier' ? '🏅 By tier'
            : '#️⃣ By interest';
          return (
            <button key={s} type="button" onClick={() => setScope(s)}
              style={{
                padding: '6px 12px', borderRadius: 999, fontSize: 12,
                border: 'none', cursor: 'pointer', fontWeight: 700,
                background: on ? '#111' : '#f1f5f9',
                color: on ? '#fff' : '#334155'
              }}>{label}</button>
          );
        })}
      </div>

      {scope === 'tier' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TIERS.map(t => {
            const on = tierFilter === t.tier;
            return (
              <button key={t.tier} type="button"
                onClick={() => setTierFilter(on ? null : t.tier)}
                style={{
                  padding: '4px 10px', borderRadius: 999, fontSize: 12,
                  border: 'none', cursor: 'pointer', fontWeight: 600,
                  background: on ? t.color : '#f1f5f9',
                  color: on ? '#fff' : '#334155'
                }}>
                {t.icon} {t.name}
              </button>
            );
          })}
        </div>
      )}

      {scope === 'tag' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {INTEREST_TAGS.map(t => {
            const on = tagFilter === t;
            return (
              <button key={t} type="button"
                onClick={() => setTagFilter(on ? null : t)}
                style={{
                  padding: '4px 10px', borderRadius: 999, fontSize: 12,
                  border: 'none', cursor: 'pointer', fontWeight: 600,
                  background: on ? '#111' : '#f1f5f9',
                  color: on ? '#fff' : '#334155'
                }}>#{t}</button>
            );
          })}
        </div>
      )}

      {/* My standing */}
      {myRanks.length > 0 && (
        <div className="card" style={{ background: 'linear-gradient(135deg,#8b5cf622,#ec489922)' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Your squads</div>
          <div className="list" style={{ background: 'transparent', padding: 0 }}>
            {myRanks.map(({ s, rank }) => {
              const t = squadPrestige(s.stats);
              return (
                <div key={s.id} className="list-item">
                  <div style={{ fontWeight: 800, width: 36, textAlign: 'center', color: rank <= 3 ? '#f59e0b' : '#64748b' }}>
                    #{rank}
                  </div>
                  <Crest logoId={s.logo} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {t.icon} {t.name} · {fmtNum(s.stats[metric])} {metricMeta.label.toLowerCase()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main leaderboard list */}
      {ranked.length === 0 ? (
        <div className="empty">No squads match this filter yet.</div>
      ) : (
        <div className="list">
          {ranked.map((s, i) => {
            const rank = i + 1;
            const t = squadPrestige(s.stats);
            const distLabel = fmtDist(s.dist);
            const isMine = myUid ? s.members.includes(myUid) : false;
            const requested = !!myUid && (s.pendingMembers || []).includes(myUid);
            const canRequest = s.visibility === 'public' && !isMine && !requested && myUid && s.isReal;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

            return (
              <div key={s.id} className="list-item"
                style={isMine ? { outline: '2px solid #8b5cf6', borderRadius: 12 } : undefined}>
                <div style={{
                  fontWeight: 800, width: 40, textAlign: 'center',
                  fontSize: medal ? 22 : 14,
                  color: rank <= 3 ? '#f59e0b' : '#64748b'
                }}>
                  {medal || '#' + rank}
                </div>
                <Crest logoId={s.logo} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    {!s.isReal && (
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 999, background: '#e2e8f0', color: '#475569', fontWeight: 700 }}>DEMO</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {t.icon} {t.name} · {s.stats.members} members
                    {distLabel && ' · ' + distLabel + ' away'}
                  </div>
                  {s.tags && s.tags.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {s.tags.slice(0, 4).map(tg => (
                        <span key={tg} style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 999,
                          background: '#f1f5f9', color: '#475569', fontWeight: 600
                        }}>#{tg}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', minWidth: 70 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    {fmtNum(s.stats[metric])}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {metricMeta.icon} {metricMeta.label.toLowerCase()}
                  </div>
                </div>
                {canRequest && (
                  <button className="btn secondary" style={{ width: 'auto', marginLeft: 6 }}
                    onClick={() => requestJoinSquad(s.id, myUid!)}>Join</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>
        XP is earned by check-ins ({tierForXp(0).name === 'Rookie' ? 10 : 10} per), public pins (25),
        reviews (8) and comments (3). Demo squads simulate organic activity.
      </p>

      <StorefrontsBoard rows={storefronts} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Storefronts board — newest first, with city/state badges.
 * Surfaced underneath the squads board so every Squad REN user sees newly
 * opened storefronts the moment they sign in.
 * ────────────────────────────────────────────────────────────────────────── */
function StorefrontsBoard({ rows }: { rows: PublicStorefront[] }) {
  const top = rows.slice(0, 12);
  return (
    <div className="card storefront-board">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>🛍️ Newest Storefronts</h2>
        <Link to="/storefront" className="chip">Open my storefront →</Link>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
        Brand new vendors on Squad REN — newest first.
      </p>
      {top.length === 0 ? (
        <div className="empty">No public storefronts yet. Be the first!</div>
      ) : (
        <div className="storefront-board-list">
          {top.map((s, i) => {
            const loc = [s.city, s.state].filter(Boolean).join(', ');
            const isFresh = s.publishedAt && (Date.now() - s.publishedAt) < 24 * 60 * 60 * 1000;
            const glow = !!s.perks?.storefrontGlow;
            return (
              <div key={s.uid} className={'storefront-board-row' + (glow ? ' glow' : '')}>
                <div className="storefront-board-rank">#{i + 1}</div>
                <div className="storefront-board-logo" style={{
                  backgroundImage: s.logoImageDataUrl ? `url(${s.logoImageDataUrl})` : undefined
                }}>
                  {!s.logoImageDataUrl && <span>🛍️</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name || 'Untitled storefront'}
                    </strong>
                    {s.perks?.prestigeBadge && (
                      <span className="pill" style={{
                        background: s.perks.badgeColor || '#fde047',
                        color: '#1f1b3a', fontSize: 10
                      }}>{s.perks.prestigeBadge}</span>
                    )}
                    {isFresh && <span className="pill good" style={{ fontSize: 10 }}>NEW</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {s.category || s.kind || '—'}
                    {loc && ' · 📍 ' + loc}
                    {s.publishedAt && ' · ' + relativeTime(s.publishedAt)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{s.ownerName}</div>
                  {(s.items || []).length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {(s.items || []).length} item{(s.items || []).length === 1 ? '' : 's'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return Math.floor(diff / 60_000) + 'm ago';
  if (diff < 86_400_000) return Math.floor(diff / 3600_000) + 'h ago';
  if (diff < 7 * 86_400_000) return Math.floor(diff / 86_400_000) + 'd ago';
  return new Date(ms).toLocaleDateString();
}
