import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { firebaseConfigured } from '../lib/firebase';
import { useState } from 'react';

const ROUTES = [
  { icon: '🗽', label: 'NYC Shopping Run',   price: '$45', detail: 'Leaves 6 AM · Back 1 AM' },
  { icon: '🇨🇦', label: 'Toronto Night Out',  price: '$45', detail: 'Via Peace Bridge' },
  { icon: '🌊', label: 'Niagara / Clifton',  price: '$15', detail: 'Shortest run in WNY' },
  { icon: '🎢', label: 'Darien Lake',         price: '$18', detail: 'Full day trip' },
];

export default function LoginPage() {
  const { signIn, signInDemo, error } = useAuth();
  const [name, setName] = useState('');

  return (
    <div className="login-v2">
      {/* Background gradient */}
      <div className="lv2-bg" aria-hidden />

      <div className="lv2-inner">
        {/* Logo + wordmark */}
        <div className="lv2-brand">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="SquadREN"
            className="lv2-logo"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div>
            <div className="lv2-wordmark">SquadREN</div>
            <div className="lv2-sub">Group Transit · Live Events · Squad Life</div>
          </div>
        </div>

        {/* Headline */}
        <h1 className="lv2-headline">
          Roll with your<br />
          <span className="lv2-gradient-text">Squad</span>
        </h1>
        <p className="lv2-tagline">
          Group rides from Buffalo to NYC, Toronto, Niagara &amp; beyond.<br />
          Live events. Van fleet tracked in real time. Split the cost.
        </p>

        {/* Route price strip */}
        <div className="lv2-routes">
          {ROUTES.map(r => (
            <div key={r.label} className="lv2-route-chip">
              <span className="lv2-route-icon">{r.icon}</span>
              <div className="lv2-route-info">
                <div className="lv2-route-name">{r.label}</div>
                <div className="lv2-route-detail">{r.detail}</div>
              </div>
              <span className="lv2-route-price">{r.price}</span>
            </div>
          ))}
          <div className="lv2-route-chip charter">
            <span className="lv2-route-icon">🚐</span>
            <div className="lv2-route-info">
              <div className="lv2-route-name">Private Charter</div>
              <div className="lv2-route-detail">Any destination · full van</div>
            </div>
            <span className="lv2-route-price">$350 flat</span>
          </div>
        </div>

        {/* Sign-in */}
        <div className="lv2-auth">
          {firebaseConfigured ? (
            <button className="lv2-google-btn" onClick={signIn}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google — it's free
            </button>
          ) : (
            <div className="lv2-demo-box">
              <p>Firebase isn't configured — try <b>Demo Mode</b> (browser-only data).</p>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
              <button className="btn" style={{ marginTop: 10 }} onClick={() => signInDemo(name)}>Enter Demo Mode</button>
            </div>
          )}

          {error && <p className="lv2-error">{error}</p>}

          <p className="lv2-privacy">
            Location is <strong>opt-in</strong> and squad-scoped.{' '}
            <Link to="/privacy">Privacy Policy</Link>
          </p>
        </div>

        {/* Features footer */}
        <div className="lv2-features">
          <span>🚐 Live fleet</span>
          <span>🎟️ Events</span>
          <span>⚡ Rallies</span>
          <span>👥 Squads</span>
          <span>🛍️ Marketplace</span>
        </div>
      </div>
    </div>
  );
}
