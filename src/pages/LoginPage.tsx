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
      <p>by illy robotic instruments — Friend Finder</p>

      {firebaseConfigured ? (
        <button className="btn" onClick={signIn} style={{ maxWidth: 320 }}>
          <span>🔐</span> Continue with Google
        </button>
      ) : (
        <div className="card" style={{ maxWidth: 360, width: '100%' }}>
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>
            Firebase isn't configured yet. Run in <b>Demo Mode</b> — data lives in your browser.
          </p>
          <label>Display name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
          <div style={{ height: 12 }} />
          <button className="btn" onClick={() => signInDemo(name)}>Enter Demo Mode</button>
        </div>
      )}
      {error && <p className="error" style={{ marginTop: 16 }}>{error}</p>}
      <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 24, maxWidth: 320, textAlign: 'center' }}>
        Squad REN uses your location to share with your chosen squads. You control visibility per squad.
      </p>
    </div>
  );
}
