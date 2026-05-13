import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { firebaseConfigured } from '../lib/firebase';

export default function LoginPage() {
  const { signIn, signInDemo, error } = useAuth();
  const [name, setName] = useState('');

  return (
    <div className="login">
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Squad REN" className="logo-img" />
      <h1>Squad REN</h1>
      <p className="tagline">Find your crew. Anywhere. Anytime. ✨</p>

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
      <p className="footnote" style={{ opacity: 0.4, fontSize: 11 }}>
        build {new Date().toISOString().slice(0,16)}
      </p>
    </div>
  );
}
