import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { firebaseConfigured } from '../lib/firebase';

const PILLARS: { icon: string; title: string; copy: string; tint: string }[] = [
  {
    icon: '�',
    title: 'See who’s live around you',
    copy: 'A real-time map of every Squad REN user nearby — fly to anyone with one tap, see their avatar, and 👋 wave to break the ice. Bump-style discovery, but city-scale.',
    tint: '#0ea5e9'
  },
  {
    icon: '🛰️',
    title: 'Move as a Squadron',
    copy: 'Roll deeper than solo. Create or join Squads to coordinate physical meetups on campus, at festivals, or in your downtown hubs. Location is squad-scoped by default.',
    tint: '#8b5cf6'
  },
  {
    icon: '🏆',
    title: 'Earn Real-World Prestige',
    copy: 'Become a regular at the spots you love. Check-ins, reviews, and trips compound into a prestige tier that unlocks perks at local venues.',
    tint: '#ec4899'
  },
  {
    icon: '🛍️',
    title: 'The Local Presence Marketplace',
    copy: 'Every profile is a mini storefront — promote your hustle, products, or services to the people physically around you. Local businesses target nearby Squads with real-time offers.',
    tint: '#f97316'
  }
];

export default function LoginPage() {
  const { signIn, signInDemo, error } = useAuth();
  const [name, setName] = useState('');

  return (
    <div className="login">
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Squad REN" className="logo-img" />
      <h1>Squad REN</h1>
      <p className="tagline">The live-presence social map. 👋 Bump-style hellos, real squads, real local economy.</p>

      <div style={{
        maxWidth: 560, width: '100%',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(236,72,153,0.06), rgba(249,115,22,0.06))',
        border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: 16, padding: '18px 18px 14px',
        marginBottom: 22, textAlign: 'left'
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#5b21b6', textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'center', marginBottom: 4 }}>
          What is Squad REN?
        </div>
        <p style={{ margin: '6px 0 14px', color: 'var(--fg-soft)', fontSize: 14, lineHeight: 1.45, textAlign: 'center' }}>
          A <strong style={{ color: '#0ea5e9' }}>live-presence social map</strong> built around squads and
          a <strong style={{ color: '#f97316' }}>local marketplace</strong>. Think Bump — see who's nearby and
          say hi with a tap — plus crews to roll with, prestige for showing up, and storefronts so your hustle
          travels with you.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {PILLARS.map(p => (
            <div key={p.title} style={{
              display: 'grid', gridTemplateColumns: '40px 1fr', gap: 10, alignItems: 'start',
              padding: '10px 12px', background: '#fff', borderRadius: 12,
              borderLeft: `4px solid ${p.tint}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `${p.tint}1a`,
                display: 'grid', placeItems: 'center', fontSize: 22
              }}>{p.icon}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, color: p.tint, marginBottom: 2 }}>{p.title}</div>
                <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.4 }}>{p.copy}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {firebaseConfigured ? (
        <button className="btn signin-btn" onClick={signIn}>
          <svg className="g-icon" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.3 0 10.2-2 13.9-5.3l-6.4-5.4C29.5 34.7 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8L6.1 33.1C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.4 5.4C41.4 35.5 44 30.1 44 24c0-1.2-.1-2.4-.4-3.5z"/>
          </svg>
          Continue with Google
        </button>
      ) : (
        <div className="card">
          <p style={{ marginTop: 0, color: 'var(--fg-soft)', fontWeight: 600 }}>
            Firebase isn't configured yet. Try <b>Demo Mode</b> — your data lives in this browser.
          </p>
          <label>Display name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
          <div style={{ height: 12 }} />
          <button className="btn" onClick={() => signInDemo(name)}>Enter Demo Mode</button>
        </div>
      )}
      {error && <p className="error" style={{ marginTop: 16 }}>{error}</p>}
      <p className="footnote">
        Your location is only shared with squads you join — you control visibility per squad.
      </p>
      <p className="footnote" style={{ fontSize: 12 }}>
        By continuing, you agree to our{' '}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>
      <p className="footnote" style={{ opacity: 0.4, fontSize: 11 }}>
        build {new Date().toISOString().slice(0,16)}
      </p>
    </div>
  );
}
