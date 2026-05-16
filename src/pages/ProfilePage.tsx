import Avatar from '../components/Avatar';
import { useAuth, defaultAvatar, type Storefront } from '../lib/AuthContext';
import { firebaseConfigured } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import SquadCommercial from '../components/SquadCommercial';

const PILLARS: { icon: string; title: string; copy: string; color: string }[] = [
  {
    icon: '☕',
    title: 'Become a regular',
    color: '#22c55e',
    copy: 'Check in at the spots you actually go to — coffee shops, bars, gyms, salons, gas stations. Other regulars see you on the map and a real community forms around the place.'
  },
  {
    icon: '🛍️',
    title: 'Your personal storefront',
    color: '#f97316',
    copy: 'Promote what you do right from your Squad REN profile. Whether you run a small business, freelance, DJ on weekends, or just want to share your services — list products, prices, and offers your squad and nearby squadders can browse.'
  },
  {
    icon: '🎁',
    title: 'Exclusive deals from local venues',
    color: '#eab308',
    copy: 'Local businesses and venues can target active squads in their area with squad-only discounts, early invites, and pop-up promos. Be a regular, get rewarded.'
  },
  {
    icon: '🧭',
    title: 'Plan trips & track them live',
    copy: 'Plan a multi-stop trip in advance. Check into each stop from your phone to earn achievements, and your squad watches your path cross the map in real time.',
    color: '#0ea5e9'
  },
  {
    icon: '⭐',
    title: 'Real reviews from real people',
    color: '#f59e0b',
    copy: 'Drop a public pin anywhere. Squad-mates and strangers leave star ratings and comments — powered by people who actually keep coming back, not paid placements.'
  },
  {
    icon: '👻',
    title: 'See your crew right now',
    color: '#ec4899',
    copy: 'Opt-in live location like Snap Map. See your squad on the map in real time, plus everyone who chose to share publicly with the world.'
  },
  {
    icon: '👥',
    title: 'Squads built around you',
    color: '#8b5cf6',
    copy: 'Form a squad with the regulars at your local spot, or with strangers who share your interests. Pin an HQ, request to join others, level up together.'
  }
];

const HOW_IT_WORKS = [
  { step: '1', text: 'Customize your cartoon avatar — it becomes your map marker.' },
  { step: '2', text: 'Set up your storefront — what you offer, where, and any squad-only deals.' },
  { step: '3', text: 'Create or join a squad. Public squads pin an HQ everyone can find.' },
  { step: '4', text: 'Drop pins, leave reviews, check in, and rack up XP to climb 7 prestige tiers.' },
  { step: '5', text: 'Unlock crests, accessories, and discover targeted promos from venues nearby.' }
];

const STOREFRONT_KINDS: { value: NonNullable<Storefront['kind']>; label: string; hint: string }[] = [
  { value: 'none',     label: '— Not set —',     hint: 'Hide my storefront for now.' },
  { value: 'business', label: '🏪 Small business', hint: 'Shop, café, studio, salon, restaurant.' },
  { value: 'service',  label: '🛠️ Service / freelance', hint: 'Trades, tutoring, photography, consulting.' },
  { value: 'creator',  label: '🎨 Creator',       hint: 'DJ, artist, musician, content, fitness.' },
  { value: 'venue',    label: '🏟️ Venue',         hint: 'Bar, club, gym, event space.' },
  { value: 'personal', label: '🙂 Personal page',  hint: 'Just sharing what I\'m into.' }
];

export default function ProfilePage() {
  const { user, logout, updateStorefront } = useAuth();
  const [showCommercial, setShowCommercial] = useState(false);
  if (!user) return null;
  return (
    <div className="page">
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Squad REN" style={{ width: 72, height: 72, objectFit: 'contain' }} />
      </div>
      <h1 style={{ textAlign: 'center' }}>Profile</h1>

      <div className="card" style={{ textAlign: 'center' }}>
        <Avatar config={user.avatar || defaultAvatar} size={120} />
        <div style={{ marginTop: 8, fontWeight: 700, fontSize: 18 }}>{user.displayName}</div>
        {user.email && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{user.email}</div>}
        <div style={{ marginTop: 8 }}>
          <span className={'pill ' + (firebaseConfigured ? 'good' : 'warn')}>
            {firebaseConfigured ? 'Connected to Firebase' : 'Demo Mode'}
          </span>
        </div>
        <Link to="/avatar" className="btn" style={{ marginTop: 14, display: 'inline-block', textDecoration: 'none' }}>
          🎨 Customize Avatar
        </Link>
      </div>

      <div className="card" style={{ background: 'linear-gradient(135deg, #8b5cf622, #ec489922, #f9731622)' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#5b21b6', textTransform: 'uppercase', letterSpacing: 0.8 }}>About Squad REN</div>
        <h2 style={{ margin: '6px 0 8px', fontSize: 22, lineHeight: 1.15 }}>
          The live-presence social map. <span style={{ color: '#8b5cf6' }}>Your squad.</span> <span style={{ color: '#f97316' }}>Your local economy.</span>
        </h2>
        <p style={{ color: 'var(--muted)', marginTop: 4 }}>
          Squad REN is the <strong style={{ color: '#0ea5e9' }}>real-time map of everyone live near you</strong> — think Bump-style
          discovery, but with <strong style={{ color: '#8b5cf6' }}>squads</strong> to roll with and a{' '}
          <strong style={{ color: '#f97316' }}>local marketplace</strong> built into every profile.
        </p>

        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <div style={{ padding: '10px 12px', background: '#fff', borderRadius: 12, borderLeft: '4px solid #0ea5e9' }}>
            <div style={{ fontWeight: 800, color: '#0ea5e9', fontSize: 13 }}>📍 See who's live around you</div>
            <div style={{ fontSize: 13, color: '#334155', marginTop: 3, lineHeight: 1.4 }}>
              A real-time map of every Squad REN user nearby. Tap anyone to fly to them and 👋 wave to break the ice — no DMs, no follows, just hello.
            </div>
          </div>

          <div style={{ padding: '10px 12px', background: '#fff', borderRadius: 12, borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ fontWeight: 800, color: '#8b5cf6', fontSize: 13 }}>🛰️ Move as a Squadron</div>
            <div style={{ fontSize: 13, color: '#334155', marginTop: 3, lineHeight: 1.4 }}>
              Roll deeper than solo. Create or join Squads to coordinate physical meetups on campuses,
              festivals, or downtown hubs. <em>Squad location stays squad-only.</em>
            </div>
          </div>

          <div style={{ padding: '10px 12px', background: '#fff', borderRadius: 12, borderLeft: '4px solid #ec4899' }}>
            <div style={{ fontWeight: 800, color: '#ec4899', fontSize: 13 }}>🏆 Earn Real-World Prestige</div>
            <div style={{ fontSize: 13, color: '#334155', marginTop: 3, lineHeight: 1.4 }}>
              Become a regular at the spots you love. Check-ins, reviews, and trips compound into a
              prestige tier that unlocks perks at local venues.
            </div>
          </div>

          <div style={{ padding: '10px 12px', background: '#fff', borderRadius: 12, borderLeft: '4px solid #f97316' }}>
            <div style={{ fontWeight: 800, color: '#f97316', fontSize: 13 }}>🛍️ The Local Presence Marketplace</div>
            <div style={{ fontSize: 13, color: '#334155', marginTop: 3, lineHeight: 1.4 }}>
              Every profile is a mini storefront. Promote your hustle, products, or services to the
              people physically around you — and local businesses target nearby Squads with real-time
              offers. The ultimate metric: <strong>physical presence</strong>.
            </div>
          </div>
        </div>

        <div className="about-cta">
          <button
            className="btn watch-commercial"
            onClick={() => setShowCommercial(true)}
            aria-label="Watch the Squad REN commercial"
          >
            ▶ Watch the commercial
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            30s · animated · <em>"What's in your squad?"</em>
          </span>
        </div>
      </div>

      {showCommercial && <SquadCommercial onClose={() => setShowCommercial(false)} />}

      <StorefrontCard
        initial={user.storefront}
        onSave={updateStorefront}
        hasSquad={true /* every user can set this; squad visibility gated in the form */}
      />

      <div className="card">
        <h2 style={{ marginTop: 0 }}>What you can do here</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {PILLARS.map(p => (
            <div key={p.title} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: 10, borderRadius: 12,
              background: '#fff', border: '1px solid #eee'
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: p.color, color: '#fff',
                display: 'grid', placeItems: 'center', fontSize: 22,
                flex: '0 0 42px'
              }}>{p.icon}</div>
              <div>
                <div style={{ fontWeight: 700, color: '#111' }}>{p.title}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{p.copy}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>How it works</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {HOW_IT_WORKS.map(s => (
            <div key={s.step} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 999,
                background: '#111', color: '#fff',
                display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13
              }}>{s.step}</div>
              <div style={{ fontSize: 13 }}>{s.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Your privacy</h2>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 13 }}>
          Location is <strong>opt-in</strong>. Squad-only sharing keeps you visible to your crew; public
          sharing makes you a friendly dot on the world map. Your storefront is hidden by default —
          flip it to <em>squad</em> or <em>public</em> only when you're ready. Toggle anything off
          from the map screen or this page at any time.
        </p>
      </div>

      <button className="btn danger" onClick={logout}>Sign Out</button>
      <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--muted)' }}>
        <Link to="/privacy">Privacy Policy</Link>
      </p>
    </div>
  );
}

// ——— Storefront editor ———
// Inline editable card on the profile page. Keeps state local until "Save"
// is pressed so the user can experiment without writing junk to the server
// on every keystroke. Visibility defaults to 'private' so nothing leaks
// before the user opts in.
function StorefrontCard({
  initial,
  onSave,
  hasSquad
}: {
  initial: Storefront | undefined;
  onSave: (s: Storefront) => Promise<void>;
  hasSquad: boolean;
}) {
  const seed: Storefront = initial || { kind: 'none', visibility: 'private', items: [] };
  const [s, setS] = useState<Storefront>(seed);
  const [editing, setEditing] = useState<boolean>(!initial || initial.kind === 'none');
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Convenience setter that respects the partial-shape on items.
  function patch(p: Partial<Storefront>) { setS(prev => ({ ...prev, ...p })); }
  function setItem(i: number, p: Partial<NonNullable<Storefront['items']>[number]>) {
    const items = [...(s.items || [])];
    items[i] = { ...items[i], ...p };
    patch({ items });
  }
  function addItem() {
    const items = [...(s.items || []), { name: '', price: '', note: '' }];
    if (items.length > 6) return; // cap to keep the UI tidy
    patch({ items });
  }
  function removeItem(i: number) {
    const items = [...(s.items || [])];
    items.splice(i, 1);
    patch({ items });
  }

  async function save() {
    setBusy(true);
    try {
      // Trim empty items so the storage stays clean.
      const cleaned: Storefront = {
        ...s,
        items: (s.items || []).filter(it => it.name?.trim()),
        name: s.name?.trim() || '',
        tagline: s.tagline?.trim() || '',
        category: s.category?.trim() || '',
        bio: s.bio?.trim() || '',
        website: s.website?.trim() || '',
        instagram: s.instagram?.trim() || '',
        serviceArea: s.serviceArea?.trim() || '',
        offers: s.offers?.trim() || ''
      };
      await onSave(cleaned);
      setS(cleaned);
      setSavedAt(Date.now());
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  const isSetUp = !!(initial && initial.kind && initial.kind !== 'none' && initial.name);
  const visIcon = s.visibility === 'public' ? '🌎'
    : s.visibility === 'squad' ? '👥' : '🔒';

  // Read-only preview when not editing and the user has saved something.
  if (!editing && isSetUp) {
    return (
      <div className="card" style={{ borderTop: '3px solid #f97316' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h2 style={{ margin: 0 }}>🛍️ My Storefront</h2>
          <button className="chip" onClick={() => setEditing(true)}>✏️ Edit</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
          {visIcon} {s.visibility || 'private'} · {s.kind}
          {savedAt && <span style={{ marginLeft: 8 }}>Saved ✓</span>}
        </div>
        <div style={{ marginTop: 10, fontWeight: 800, fontSize: 18 }}>{s.name}</div>
        {s.tagline && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{s.tagline}</div>}
        {s.category && <div style={{ marginTop: 4 }}><span className="pill">{s.category}</span></div>}
        {s.bio && <p style={{ marginTop: 8, fontSize: 13 }}>{s.bio}</p>}
        {s.offers && (
          <div style={{
            marginTop: 8, padding: 10, borderRadius: 10,
            background: '#fef3c7', border: '1px solid #fde68a', fontSize: 13
          }}>
            🎁 <strong>Squad offer:</strong> {s.offers}
          </div>
        )}
        {s.items && s.items.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Products & services</div>
            <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
              {s.items.map((it, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 8,
                  padding: '6px 10px', background: '#fff', border: '1px solid #eee', borderRadius: 8, fontSize: 13
                }}>
                  <div>
                    <strong>{it.name}</strong>
                    {it.note && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{it.note}</div>}
                  </div>
                  {it.price && <div style={{ fontWeight: 700 }}>{it.price}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', fontSize: 12 }}>
          {s.serviceArea && <span className="pill">📍 {s.serviceArea}</span>}
          {s.website && (
            <a href={s.website} target="_blank" rel="noreferrer" className="pill" style={{ textDecoration: 'none' }}>
              🔗 Website
            </a>
          )}
          {s.instagram && (
            <a href={`https://instagram.com/${s.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer"
              className="pill" style={{ textDecoration: 'none' }}>
              📷 @{s.instagram.replace(/^@/, '')}
            </a>
          )}
        </div>
      </div>
    );
  }

  // Editor form.
  return (
    <div className="card" style={{ borderTop: '3px solid #f97316' }}>
      <h2 style={{ marginTop: 0 }}>🛍️ My Storefront</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>
        Promote your products, services, or side hustle directly from your Squad REN profile.
        Everything is <strong>hidden by default</strong> — pick <em>squad</em> or <em>public</em>
        below when you're ready to show it off.
      </p>

      <label>Storefront type</label>
      <select className="select" value={s.kind || 'none'} onChange={e => patch({ kind: e.target.value as Storefront['kind'] })}>
        {STOREFRONT_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
      </select>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: -4, marginBottom: 8 }}>
        {STOREFRONT_KINDS.find(k => k.value === (s.kind || 'none'))?.hint}
      </div>

      {s.kind && s.kind !== 'none' && (
        <>
          <label>Name</label>
          <input className="input" value={s.name || ''} onChange={e => patch({ name: e.target.value })}
            placeholder="e.g. Bean & Vine Coffee" maxLength={60} />

          <label>Tagline</label>
          <input className="input" value={s.tagline || ''} onChange={e => patch({ tagline: e.target.value })}
            placeholder="One sentence about what you do" maxLength={120} />

          <label>Category</label>
          <input className="input" value={s.category || ''} onChange={e => patch({ category: e.target.value })}
            placeholder="Coffee · Fitness · Tattoo · Photography…" maxLength={40} />

          <label>About</label>
          <textarea className="input" value={s.bio || ''} onChange={e => patch({ bio: e.target.value })}
            rows={3} placeholder="Tell squadders what makes you / your spot different." maxLength={500} />

          <label>Squad-only offer (optional)</label>
          <input className="input" value={s.offers || ''} onChange={e => patch({ offers: e.target.value })}
            placeholder="e.g. 15% off for squadders who check in this week" maxLength={140} />

          <label>Service area</label>
          <input className="input" value={s.serviceArea || ''} onChange={e => patch({ serviceArea: e.target.value })}
            placeholder="e.g. Brooklyn + lower Manhattan" maxLength={80} />

          <div className="row" style={{ gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label>Website</label>
              <input className="input" value={s.website || ''} onChange={e => patch({ website: e.target.value })}
                placeholder="https://…" maxLength={120} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Instagram</label>
              <input className="input" value={s.instagram || ''} onChange={e => patch({ instagram: e.target.value })}
                placeholder="@handle" maxLength={40} />
            </div>
          </div>

          <label style={{ marginTop: 8 }}>Products & services (up to 6)</label>
          <div style={{ display: 'grid', gap: 6 }}>
            {(s.items || []).map((it, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: 6,
                padding: 8, border: '1px solid #eee', borderRadius: 10, background: '#fff'
              }}>
                <input className="input" value={it.name} onChange={e => setItem(i, { name: e.target.value })}
                  placeholder="Name" maxLength={50} />
                <input className="input" value={it.price || ''} onChange={e => setItem(i, { price: e.target.value })}
                  placeholder="Price" maxLength={20} />
                <button type="button" className="chip" onClick={() => removeItem(i)} title="Remove">✕</button>
                <input className="input" value={it.note || ''} onChange={e => setItem(i, { note: e.target.value })}
                  placeholder="Optional note (e.g. by appointment)"
                  style={{ gridColumn: '1 / span 3' }} maxLength={120} />
              </div>
            ))}
            {(s.items || []).length < 6 && (
              <button type="button" className="btn ghost" onClick={addItem} style={{ marginTop: 2 }}>
                + Add item
              </button>
            )}
          </div>

          <label style={{ marginTop: 10 }}>Visibility</label>
          <div className="layer-toggle" style={{ marginBottom: 8 }}>
            <button type="button" className={'chip ' + ((s.visibility || 'private') === 'private' ? 'active' : '')}
              onClick={() => patch({ visibility: 'private' })}>🔒 Hidden</button>
            <button type="button" className={'chip ' + (s.visibility === 'squad' ? 'active' : '')}
              disabled={!hasSquad}
              title={hasSquad ? 'Only your squad members can see your storefront' : 'Join a squad first'}
              onClick={() => patch({ visibility: 'squad' })}>👥 Squad-only</button>
            <button type="button" className={'chip ' + (s.visibility === 'public' ? 'active' : '')}
              onClick={() => patch({ visibility: 'public' })}>🌎 Public</button>
          </div>
        </>
      )}

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        {isSetUp && (
          <button className="btn secondary" onClick={() => { setS(seed); setEditing(false); }} style={{ flex: 1 }}>
            Cancel
          </button>
        )}
        <button className="btn" onClick={save} disabled={busy} style={{ flex: 2 }}>
          {busy ? 'Saving…' : (s.kind && s.kind !== 'none' ? '💾 Save storefront' : '💾 Save')}
        </button>
      </div>
    </div>
  );
}
