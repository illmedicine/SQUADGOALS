import Avatar from '../components/Avatar';
import { useAuth, defaultAvatar } from '../lib/AuthContext';
import { firebaseConfigured } from '../lib/firebase';
import { Link } from 'react-router-dom';

const PILLARS: { icon: string; title: string; copy: string; color: string }[] = [
  {
    icon: '☕',
    title: 'Become a regular',
    color: '#22c55e',
    copy: 'Check in at the places you actually go to — coffee shops, bars, gas stations, the gym. Meet the other regulars and turn frequent visits into real connections.'
  },
  {
    icon: '🧭',
    title: 'Plan trips & track them live',
    copy: 'Plan a trip with stops in advance. Check into each stop from your phone to earn achievements, and your squad watches your path cross the map in real time.',
    color: '#0ea5e9'
  },
  {
    icon: '⭐',
    title: 'Real reviews from real people',
    color: '#f59e0b',
    copy: 'Drop a public pin anywhere. Squad-mates and strangers leave star ratings and comments, just like Yelp — powered by people who keep coming back.'
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
  { step: '2', text: 'Create or join a squad. Public squads pin an HQ everyone can find.' },
  { step: '3', text: 'Drop pins, leave reviews, and rack up XP to climb 7 prestige tiers.' },
  { step: '4', text: 'Unlock crests, accessories, and bragging rights as your squad ranks up.' }
];

export default function ProfilePage() {
  const { user, logout } = useAuth();
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

      <div className="card" style={{ background: 'linear-gradient(135deg, #8b5cf622, #ec489922)' }}>
        <h2 style={{ marginTop: 0, fontSize: 20 }}>What is Squad REN?</h2>
        <p style={{ color: 'var(--muted)', marginTop: 4 }}>
          <strong>Squad REN</strong> is a play on <em>squadron</em> — a tight crew moving together.
          REN stands for <strong style={{ color: '#8b5cf6' }}>Reputable Engagement Network</strong>:
          a place to grow communities around the spots you actually go to. Check in at
          your coffee shop, your gym, your bar, your gas station — and meet the regulars
          who hang out there too.
        </p>
        <p style={{ color: 'var(--muted)', marginTop: 8, fontSize: 13 }}>
          Think{' '}
          <strong style={{ color: '#0ea5e9' }}>Google Timeline</strong> meets{' '}
          <strong style={{ color: '#f59e0b' }}>Yelp</strong> meets{' '}
          <strong style={{ color: '#ec4899' }}>Snapchat Map</strong> — with squads,
          trip planning, and live journey tracking on top.
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Five things you can do</h2>
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
          sharing makes you a friendly dot on the world map. Toggle either off at any time from the map
          screen — you’re always in control.
        </p>
      </div>

      <button className="btn danger" onClick={logout}>Sign Out</button>
    </div>
  );
}
