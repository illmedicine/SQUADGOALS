import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useLocation } from '../lib/useLocation';
import { logVisitedPlace, watchVisitedPlaces, type VisitedPlace } from '../lib/data';
import { awardXp, XP } from '../lib/prestige';

const CATEGORIES = ['Coffee', 'Food', 'Bar', 'Venue', 'Campus', 'Work', 'Other'];

export default function VisitedPlacesPage() {
  const { user } = useAuth();
  const { pos } = useLocation({ enabled: !!user });
  const [places, setPlaces] = useState<VisitedPlace[]>([]);
  const [name, setName] = useState('');
  const [cat, setCat] = useState('Coffee');

  useEffect(() => watchVisitedPlaces(setPlaces), []);

  async function checkIn() {
    if (!user || !pos || !name.trim()) return;
    await logVisitedPlace({
      uid: user.uid,
      displayName: user.displayName,
      placeName: name.trim(),
      category: cat,
      lat: pos.lat,
      lng: pos.lng
    });
    await awardXp(user.uid, { xp: XP.CHECK_IN, checkIns: 1 });
    setName('');
  }

  return (
    <div className="page">
      <h1>Visited Places</h1>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Check in here</h2>
        <label>Place name</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Starbucks on 5th" />
        <label>Category</label>
        <select className="select" value={cat} onChange={e => setCat(e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <div style={{ height: 12 }} />
        <button className="btn" onClick={checkIn} disabled={!pos || !name.trim()}>
          {pos ? 'Check in at this location' : 'Waiting for GPS…'}
        </button>
      </div>

      <h2>Squad Activity</h2>
      {places.length === 0 && <div className="empty">No check-ins yet. Be the first!</div>}
      <div className="list">
        {places.slice(0, 50).map((p, i) => (
          <div key={i} className="list-item">
            <div className="avatar-mini">{(p.displayName || '?').slice(0,1).toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{p.placeName}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {p.displayName} · {p.category || 'Other'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
