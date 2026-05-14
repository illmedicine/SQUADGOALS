import { useEffect, useState } from 'react';
import { BADGES, STAT_BADGES, getBadgeState, resetBadges } from '../lib/badges';
import { loadLocalStats, tierForXp, nextTier, TIERS, fetchStats } from '../lib/prestige';
import { useAuth } from '../lib/AuthContext';

export default function BadgesPage() {
  const { user } = useAuth();
  const [state, setState] = useState(getBadgeState());
  const [stats, setStats] = useState(loadLocalStats());

  useEffect(() => {
    const id = setInterval(() => {
      setState(getBadgeState());
      setStats(loadLocalStats());
    }, 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (user?.uid) fetchStats(user.uid).then(setStats);
  }, [user?.uid]);

  const tier = tierForXp(stats.xp);
  const next = nextTier(stats.xp);
  const progress = next ? Math.min(100, ((stats.xp - tier.xp) / (next.xp - tier.xp)) * 100) : 100;

  const unlockedProx = Object.keys(state.unlocked).length;
  const unlockedStat = STAT_BADGES.filter(b => b.check(stats)).length;
  const totalUnlocked = unlockedProx + unlockedStat;
  const total = BADGES.length + STAT_BADGES.length;

  return (
    <div className="page">
      <h1>Prestige &amp; Badges</h1>

      <div className="card" style={{ background: `linear-gradient(135deg, ${tier.color}22, transparent)` }}>
        <div className="row between" style={{ alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Current tier</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: tier.color }}>
              {tier.icon} {tier.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {stats.xp} XP{next ? ` · ${next.xp - stats.xp} to ${next.name}` : ' · max tier!'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Badges</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{totalUnlocked}/{total}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.08)' }}>
          <div style={{ width: `${progress}%`, height: '100%', borderRadius: 4, background: tier.color, transition: 'width .4s ease' }} />
        </div>
        <div className="row" style={{ marginTop: 10, gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
          <span>📍 {stats.checkIns} check-ins</span>
          <span>🌎 {stats.publicPins} public pins</span>
          <span>⭐ {stats.reviews} reviews</span>
          <span>💬 {stats.comments} comments</span>
        </div>
      </div>

      <h2>Tier Ladder</h2>
      <div className="badge-grid">
        {TIERS.map(t => {
          const got = stats.xp >= t.xp;
          return (
            <div key={t.tier} className={'badge ' + (got ? '' : 'locked')}>
              <div className="ico" style={{ color: t.color }}>{t.icon}</div>
              <div className="name">{t.name}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t.xp} XP</div>
            </div>
          );
        })}
      </div>

      <h2>Check-in Badges</h2>
      <div className="badge-grid">
        {STAT_BADGES.map(b => {
          const got = b.check(stats);
          return (
            <div key={b.id} className={'badge ' + (got ? '' : 'locked')} title={b.description}>
              <div className="ico">{b.icon}</div>
              <div className="name">{b.name}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{b.description}</div>
            </div>
          );
        })}
      </div>

      <h2>Squad Proximity Badges</h2>
      <div className="card">
        <div className="row between">
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Time near squadmates</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {Math.floor(state.totalMinutes / 60)}h {Math.floor(state.totalMinutes % 60)}m
            </div>
          </div>
        </div>
      </div>
      <div className="badge-grid">
        {BADGES.map(b => {
          const got = !!state.unlocked[b.id];
          return (
            <div key={b.id} className={'badge ' + (got ? '' : 'locked')} title={b.description}>
              <div className="ico">{b.icon}</div>
              <div className="name">{b.name}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{b.description}</div>
            </div>
          );
        })}
      </div>

      <div style={{ height: 16 }} />
      <button className="btn ghost" onClick={() => { resetBadges(); setState(getBadgeState()); }}>
        Reset proximity badges
      </button>
    </div>
  );
}
