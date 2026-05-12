import { useState } from 'react';
import Avatar from '../components/Avatar';
import { useAuth, type AvatarConfig } from '../lib/AuthContext';

const SKIN = ['#ffd9b3', '#f1c27d', '#c68642', '#8d5524', '#3b2417'];
const HAIR = ['#1a1a1a', '#3b2417', '#a0522d', '#e2b04a', '#ef4444', '#22d3ee'];
const SHIRT = ['#7c3aed', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#f87171'];
const ACCS = [
  { id: 'none', label: 'None' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'hat', label: 'Hat' },
  { id: 'headphones', label: 'Headphones' }
];

export default function AvatarPage() {
  const { user, updateAvatar } = useAuth();
  const [cfg, setCfg] = useState<AvatarConfig>(user?.avatar || {
    skin: SKIN[1], hair: HAIR[1], shirt: SHIRT[0], accessory: 'none'
  });

  function set<K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) {
    setCfg(prev => ({ ...prev, [k]: v }));
  }

  return (
    <div className="page">
      <h1>Your Avatar</h1>
      <div className="card" style={{ textAlign: 'center' }}>
        <Avatar config={cfg} size={160} />
        <div style={{ marginTop: 8, fontWeight: 600 }}>{user?.displayName}</div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Skin</h2>
        <div className="swatches">
          {SKIN.map(c => (
            <button key={c} className={'swatch ' + (cfg.skin === c ? 'active' : '')}
              style={{ background: c }} onClick={() => set('skin', c)} aria-label={`skin ${c}`} />
          ))}
        </div>
        <h2>Hair</h2>
        <div className="swatches">
          {HAIR.map(c => (
            <button key={c} className={'swatch ' + (cfg.hair === c ? 'active' : '')}
              style={{ background: c }} onClick={() => set('hair', c)} aria-label={`hair ${c}`} />
          ))}
        </div>
        <h2>Shirt</h2>
        <div className="swatches">
          {SHIRT.map(c => (
            <button key={c} className={'swatch ' + (cfg.shirt === c ? 'active' : '')}
              style={{ background: c }} onClick={() => set('shirt', c)} aria-label={`shirt ${c}`} />
          ))}
        </div>
        <h2>Accessory</h2>
        <div className="swatches">
          {ACCS.map(a => (
            <button key={a.id}
              className={'btn ' + (cfg.accessory === a.id ? '' : 'secondary')}
              style={{ width: 'auto' }}
              onClick={() => set('accessory', a.id)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <button className="btn" onClick={() => updateAvatar(cfg)} style={{ marginTop: 12 }}>
        Save Avatar
      </button>
    </div>
  );
}
