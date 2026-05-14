import Avatar from '../components/Avatar';
import { useAuth, defaultAvatar } from '../lib/AuthContext';
import { firebaseConfigured } from '../lib/firebase';
import { Link } from 'react-router-dom';

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

      <div className="card">
        <h2 style={{ marginTop: 0 }}>About</h2>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          Squad REN helps you find your friends in dense places — concert venues, campuses, downtowns, festivals.
          Your location is only shared with squads you join, and only while sharing is on.
        </p>
      </div>

      <button className="btn danger" onClick={logout}>Sign Out</button>
    </div>
  );
}
