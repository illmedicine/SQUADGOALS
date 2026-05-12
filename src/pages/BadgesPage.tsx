import { useEffect, useState } from 'react';
import { BADGES, getBadgeState, resetBadges } from '../lib/badges';

export default function BadgesPage() {
  const [state, setState] = useState(getBadgeState());

  useEffect(() => {
    const id = setInterval(() => setState(getBadgeState()), 2000);
    return () => clearInterval(id);
  }, []);

  const unlocked = Object.keys(state.unlocked).length;

  return (
    <div className="page">
      <h1>Badges &amp; Prestige</h1>
      <div className="card">
        <div className="row between">
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Total time near squadmates</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {Math.floor(state.totalMinutes / 60)}h {Math.floor(state.totalMinutes % 60)}m
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Unlocked</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{unlocked}/{BADGES.length}</div>
          </div>
        </div>
      </div>

      <h2>All Badges</h2>
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
        Reset badge progress
      </button>
    </div>
  );
}
