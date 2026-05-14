import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import { useAuth, type AvatarConfig } from '../lib/AuthContext';

const SKIN  = ['#ffe0c2', '#ffd9b3', '#f1c27d', '#d99566', '#c68642', '#8d5524', '#5b3318', '#3b2417'];
const HAIR  = ['#1a1a1a', '#3b2417', '#7c4a1e', '#a0522d', '#d4a373', '#e2b04a', '#ef4444', '#ec4899', '#22d3ee', '#a78bfa', '#34d399', '#f8fafc'];
const EYES  = ['#1a1a1a', '#3b2417', '#1d4ed8', '#0ea5e9', '#16a34a', '#a16207'];
const SHIRT = ['#7c3aed', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#f87171', '#0ea5e9', '#111827', '#fafafa'];
const PANTS = ['#1e293b', '#0f172a', '#1d4ed8', '#334155', '#92400e', '#fef3c7', '#475569'];
const SHOES = ['#0f172a', '#7c2d12', '#ef4444', '#f8fafc', '#22d3ee', '#fbbf24'];
const BG    = ['#fef3c7', '#ddd6fe', '#fce7f3', '#bae6fd', '#bbf7d0', '#fed7aa', '#fecaca'];

const BODIES: { id: NonNullable<AvatarConfig['body']>; label: string }[] = [
  { id: 'masc', label: 'Masc' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'fem', label: 'Fem' }
];

const HAIR_STYLES: { id: NonNullable<AvatarConfig['hairStyle']>; label: string }[] = [
  { id: 'short', label: 'Short' },
  { id: 'long', label: 'Long' },
  { id: 'bun', label: 'Bun' },
  { id: 'curly', label: 'Curly' },
  { id: 'mohawk', label: 'Mohawk' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'buzz', label: 'Buzz' },
  { id: 'bald', label: 'Bald' }
];

const ACCS = [
  { id: 'none', label: 'None' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'sunglasses', label: 'Shades' },
  { id: 'hat', label: 'Top hat' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'headphones', label: 'Headphones' },
  { id: 'earrings', label: 'Earrings' },
  { id: 'mask', label: 'Mask' }
];

type Tab = 'body' | 'hair' | 'face' | 'top' | 'bottom' | 'accs' | 'bg';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'body', label: 'Body', icon: '👤' },
  { id: 'hair', label: 'Hair', icon: '💇' },
  { id: 'face', label: 'Face', icon: '👀' },
  { id: 'top', label: 'Top', icon: '👕' },
  { id: 'bottom', label: 'Bottom', icon: '👖' },
  { id: 'accs', label: 'Accs', icon: '🕶' },
  { id: 'bg', label: 'BG', icon: '🎨' }
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export default function AvatarPage() {
  const { user, updateAvatar } = useAuth();
  const nav = useNavigate();
  const [cfg, setCfg] = useState<AvatarConfig>(user?.avatar || {
    skin: SKIN[2], hair: HAIR[1], shirt: SHIRT[0], accessory: 'none',
    body: 'neutral', hairStyle: 'short', eyes: EYES[0],
    pants: PANTS[0], shoes: SHOES[0], background: BG[0]
  });
  const [tab, setTab] = useState<Tab>('body');
  const [saving, setSaving] = useState(false);

  function set<K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) {
    setCfg(prev => ({ ...prev, [k]: v }));
  }

  function randomize() {
    setCfg({
      skin: pick(SKIN), hair: pick(HAIR), shirt: pick(SHIRT),
      accessory: pick(ACCS).id,
      body: pick(BODIES).id,
      hairStyle: pick(HAIR_STYLES).id,
      eyes: pick(EYES),
      pants: pick(PANTS),
      shoes: pick(SHOES),
      background: pick(BG)
    });
  }

  async function save() {
    setSaving(true);
    try { await updateAvatar(cfg); nav('/'); }
    finally { setSaving(false); }
  }

  return (
    <div className="page avatar-page">
      <h1>Your Avatar</h1>

      <div className="avatar-preview" style={{ background: cfg.background || '#fef3c7' }}>
        <Avatar config={cfg} size={220} />
      </div>

      <div className="tab-bar">
        {TABS.map(t => (
          <button key={t.id}
            className={'tab ' + (tab === t.id ? 'active' : '')}
            onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="card editor-card">
        {tab === 'body' && (
          <>
            <h3>Body type</h3>
            <div className="chip-row">
              {BODIES.map(b => (
                <button key={b.id}
                  className={'chip ' + (cfg.body === b.id ? 'active' : '')}
                  onClick={() => set('body', b.id)}>{b.label}</button>
              ))}
            </div>
            <h3>Skin tone</h3>
            <div className="swatches">
              {SKIN.map(c => (
                <Swatch key={c} c={c} active={cfg.skin === c} onClick={() => set('skin', c)} />
              ))}
            </div>
          </>
        )}

        {tab === 'hair' && (
          <>
            <h3>Style</h3>
            <div className="chip-row">
              {HAIR_STYLES.map(s => (
                <button key={s.id}
                  className={'chip ' + (cfg.hairStyle === s.id ? 'active' : '')}
                  onClick={() => set('hairStyle', s.id)}>{s.label}</button>
              ))}
            </div>
            <h3>Color</h3>
            <div className="swatches">
              {HAIR.map(c => (
                <Swatch key={c} c={c} active={cfg.hair === c} onClick={() => set('hair', c)} />
              ))}
            </div>
          </>
        )}

        {tab === 'face' && (
          <>
            <h3>Eye color</h3>
            <div className="swatches">
              {EYES.map(c => (
                <Swatch key={c} c={c} active={cfg.eyes === c} onClick={() => set('eyes', c)} />
              ))}
            </div>
          </>
        )}

        {tab === 'top' && (
          <>
            <h3>Shirt color</h3>
            <div className="swatches">
              {SHIRT.map(c => (
                <Swatch key={c} c={c} active={cfg.shirt === c} onClick={() => set('shirt', c)} />
              ))}
            </div>
          </>
        )}

        {tab === 'bottom' && (
          <>
            <h3>Pants</h3>
            <div className="swatches">
              {PANTS.map(c => (
                <Swatch key={c} c={c} active={cfg.pants === c} onClick={() => set('pants', c)} />
              ))}
            </div>
            <h3>Shoes</h3>
            <div className="swatches">
              {SHOES.map(c => (
                <Swatch key={c} c={c} active={cfg.shoes === c} onClick={() => set('shoes', c)} />
              ))}
            </div>
          </>
        )}

        {tab === 'accs' && (
          <>
            <h3>Accessory</h3>
            <div className="chip-row">
              {ACCS.map(a => (
                <button key={a.id}
                  className={'chip ' + (cfg.accessory === a.id ? 'active' : '')}
                  onClick={() => set('accessory', a.id)}>{a.label}</button>
              ))}
            </div>
          </>
        )}

        {tab === 'bg' && (
          <>
            <h3>Background</h3>
            <div className="swatches">
              {BG.map(c => (
                <Swatch key={c} c={c} active={cfg.background === c} onClick={() => set('background', c)} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn secondary" onClick={randomize} style={{ flex: 1 }}>🎲 Surprise me</button>
        <button className="btn" onClick={save} disabled={saving} style={{ flex: 2 }}>
          {saving ? 'Saving…' : 'Save Avatar'}
        </button>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
        Signed in as {user?.displayName}
      </p>
    </div>
  );
}

function Swatch({ c, active, onClick }: { c: string; active: boolean; onClick: () => void }) {
  return (
    <button className={'swatch ' + (active ? 'active' : '')}
      style={{ background: c }} onClick={onClick} aria-label={c} />
  );
}
