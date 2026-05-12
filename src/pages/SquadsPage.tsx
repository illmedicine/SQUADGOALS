import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import {
  createSquad, joinSquad, leaveSquad, listPublicSquads, watchUserSquads, type Squad
} from '../lib/data';

export default function SquadsPage() {
  const { user } = useAuth();
  const [mine, setMine] = useState<Squad[]>([]);
  const [pub, setPub] = useState<Squad[]>([]);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');

  useEffect(() => {
    if (!user) return;
    const unsub = watchUserSquads(user.uid, setMine);
    listPublicSquads().then(setPub);
    return unsub;
  }, [user?.uid]);

  async function onCreate() {
    if (!user || !name.trim()) return;
    await createSquad({ name: name.trim(), ownerId: user.uid, members: [user.uid], visibility });
    setName('');
    listPublicSquads().then(setPub);
  }

  if (!user) return null;

  return (
    <div className="page">
      <h1>Squads</h1>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Create a Squad</h2>
        <label>Squad name</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="The Concert Crew" />
        <label>Visibility</label>
        <select className="select" value={visibility} onChange={e => setVisibility(e.target.value as any)}>
          <option value="private">Private — only invited members see locations</option>
          <option value="public">Public — anyone can join &amp; see locations</option>
        </select>
        <div style={{ height: 12 }} />
        <button className="btn" onClick={onCreate} disabled={!name.trim()}>Create</button>
      </div>

      <h2>Your Squads</h2>
      {mine.length === 0 && <div className="empty">No squads yet. Create one above.</div>}
      <div className="list">
        {mine.map(s => (
          <div key={s.id} className="list-item">
            <div className="avatar-mini">{s.name.slice(0,1).toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {s.members.length} members · <span className={'pill ' + (s.visibility === 'public' ? '' : 'warn')}>{s.visibility}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>ID: {s.id}</div>
            </div>
            <button className="btn ghost" onClick={() => leaveSquad(s.id, user.uid)}>Leave</button>
          </div>
        ))}
      </div>

      <h2>Discover Public Squads</h2>
      {pub.length === 0 && <div className="empty">No public squads yet.</div>}
      <div className="list">
        {pub.filter(s => !s.members.includes(user.uid)).map(s => (
          <div key={s.id} className="list-item">
            <div className="avatar-mini">{s.name.slice(0,1).toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.members.length} members</div>
            </div>
            <button className="btn secondary" style={{ width: 'auto' }} onClick={() => joinSquad(s.id, user.uid)}>Join</button>
          </div>
        ))}
      </div>
    </div>
  );
}
