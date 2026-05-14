import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import {
  createSquad, joinSquad, leaveSquad, listPublicSquads, watchUserSquads,
  updateSquadLogo, type Squad
} from '../lib/data';
import {
  SQUAD_LOGOS, DEFAULT_LOGO_ID, getLogo, type SquadLogo
} from '../lib/squadLogos';
import { loadLocalStats, tierForXp, TIERS } from '../lib/prestige';

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
            style={{
              background: '#eee', border: 'none', borderRadius: 999,
              width: 32, height: 32, cursor: 'pointer', fontSize: 18, lineHeight: 1
            }}>×</button>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
          Your squad is currently <strong>Tier {tier}</strong> ({TIERS[tier]?.name || '—'}).
          Rank up to unlock more crests.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10, marginTop: 12
        }}>
          {SQUAD_LOGOS.map((l: SquadLogo) => {
            const locked = l.tier > tier;
            const active = value === l.id;
            return (
              <button
                key={l.id}
                type="button"
                disabled={locked}
                onClick={() => { if (!locked) onChange(l.id); }}
                title={locked ? `Unlocks at Tier ${l.tier} (${TIERS[l.tier]?.name})` : l.name}
                style={{
                  background: active ? l.bg : (locked ? '#f3f4f6' : '#fff'),
                  border: active ? '2px solid #111' : '1px solid #ddd',
                  borderRadius: 12,
                  padding: '10px 6px',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  opacity: locked ? 0.55 : 1,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 4,
                  position: 'relative'
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: l.bg, display: 'grid', placeItems: 'center',
                  fontSize: 22, filter: locked ? 'grayscale(0.7)' : 'none'
                }}>{l.glyph}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: active ? '#fff' : '#111' }}>
                  {l.name}
                </div>
                {locked && (
                  <div style={{
                    position: 'absolute', top: 4, right: 4,
                    fontSize: 10, background: '#111', color: '#fff',
                    borderRadius: 6, padding: '1px 5px'
                  }}>T{l.tier} 🔒</div>
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

export default function SquadsPage() {
  const { user } = useAuth();
  const [mine, setMine] = useState<Squad[]>([]);
  const [pub, setPub] = useState<Squad[]>([]);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [newLogo, setNewLogo] = useState<string>(DEFAULT_LOGO_ID);
  const [pickerFor, setPickerFor] = useState<string | null>(null); // squad id OR 'new'

  // Personal stats drive how many crests are unlocked for *this* user when
  // they create a new squad (in lieu of a per-squad XP store).
  const myStats = user ? loadLocalStats() : { xp: 0 } as any;
  const myTier = tierForXp(myStats.xp || 0).tier;

  useEffect(() => {
    if (!user) return;
    const unsub = watchUserSquads(user.uid, setMine);
    listPublicSquads().then(setPub);
    return unsub;
  }, [user?.uid]);

  async function onCreate() {
    if (!user || !name.trim()) return;
    await createSquad({
      name: name.trim(), ownerId: user.uid, members: [user.uid],
      visibility, logo: newLogo
    });
    setName('');
    setNewLogo(DEFAULT_LOGO_ID);
    listPublicSquads().then(setPub);
  }

  async function setLogoFor(squadId: string, logo: string) {
    await updateSquadLogo(squadId, logo);
    setMine(prev => prev.map(s => s.id === squadId ? { ...s, logo } : s));
  }

  if (!user) return null;

  return (
    <div className="page">
      <h1>Squads</h1>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Create a Squad</h2>
        <label>Squad name</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="The Concert Crew" />

        <label>Crest</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <SquadCrest logoId={newLogo} size={44} />
          <button type="button" className="btn ghost" style={{ width: 'auto' }}
            onClick={() => setPickerFor('new')}>
            Pick crest…
          </button>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {SQUAD_LOGOS.filter(l => l.tier <= myTier).length} of {SQUAD_LOGOS.length} unlocked
          </div>
        </div>

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
            <SquadCrest logoId={s.logo} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {s.members.length} members · <span className={'pill ' + (s.visibility === 'public' ? '' : 'warn')}>{s.visibility}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>ID: {s.id}</div>
            </div>
            {s.ownerId === user.uid && (
              <button className="btn ghost" style={{ width: 'auto' }}
                onClick={() => setPickerFor(s.id)}>Crest</button>
            )}
            <button className="btn ghost" onClick={() => leaveSquad(s.id, user.uid)}>Leave</button>
          </div>
        ))}
      </div>

      <h2>Discover Public Squads</h2>
      {pub.length === 0 && <div className="empty">No public squads yet.</div>}
      <div className="list">
        {pub.filter(s => !s.members.includes(user.uid)).map(s => (
          <div key={s.id} className="list-item">
            <SquadCrest logoId={s.logo} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.members.length} members</div>
            </div>
            <button className="btn secondary" style={{ width: 'auto' }} onClick={() => joinSquad(s.id, user.uid)}>Join</button>
          </div>
        ))}
      </div>

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
