import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useDeviceLocation } from '../../lib/LocationContext';
import type { Driver } from '../../lib/freight/types';
import { liveState, STATUS_COLOR, STATUS_LABEL, type LiveState } from '../../lib/freight/network';
import type { MapTruck } from './NetworkMap';

export function initials(name: string) {
  return name.replace(/["'].*?["']/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('');
}

export function DriverAvatar({ driver, size = 44 }: { driver: Pick<Driver, 'name' | 'avatarColor' | 'photoURL'>; size?: number }) {
  if (driver.photoURL) {
    return <img src={driver.photoURL} alt="" className="avatar" style={{ width: size, height: size }} referrerPolicy="no-referrer" />;
  }
  return (
    <span className="avatar" style={{ width: size, height: size, background: driver.avatarColor, fontSize: size * 0.38 }}>
      {initials(driver.name)}
    </span>
  );
}

export function Stars({ rating }: { rating: number }) {
  return <span className="stars" title={`${rating.toFixed(2)} / 5`}>★ {rating.toFixed(1)}</span>;
}

export function StatusDot({ live }: { live: Pick<LiveState, 'status'> }) {
  return (
    <span className="status-dot" style={{ ['--c' as any]: STATUS_COLOR[live.status] }}>
      <i />{STATUS_LABEL[live.status]}
    </span>
  );
}

const PALETTE = ['#f97316', '#22d3ee', '#a78bfa', '#4ade80', '#facc15', '#f472b6', '#60a5fa', '#fb7185', '#34d399', '#fbbf24'];
export function routeColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function toMapTruck(d: Driver, now: number, opts: { dim?: boolean; remainingOnly?: boolean } = {}): MapTruck {
  const live = liveState(d, now);
  const pts = live.journey?.geom.points ?? [];
  return {
    id: d.id,
    pos: live.pos,
    heading: live.heading,
    color: routeColor(d.id),
    label: `${d.name} — ${STATUS_LABEL[live.status]}`,
    route: opts.remainingOnly ? pts.filter(p => p.mile >= live.mile) : pts,
    dim: opts.dim,
  };
}

export function AppHeader({ children }: { children?: ReactNode }) {
  const { user, logout, setRole } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const isDriver = user?.role === 'driver';
  return (
    <header className="app-header">
      <Link to="/" className="brand">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        <span>Squad<b>REN</b></span>
        <em className={`role-chip ${isDriver ? 'driver' : 'shipper'}`}>{isDriver ? 'Driver' : 'Shipper'}</em>
      </Link>
      <nav className="header-nav">
        {isDriver ? (
          <>
            <NavLink to="/" end>Dashboard</NavLink>
            <NavLink to="/driver/setup">My Rig &amp; Trip</NavLink>
            <NavLink to="/network">Network</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/" end>Find a Truck</NavLink>
            <NavLink to="/shipments">My Shipments</NavLink>
          </>
        )}
      </nav>
      {children}
      <div className="account">
        <button className="account-btn" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}>
          {user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <span>{initials(user?.displayName || '?')}</span>}
        </button>
        {open && (
          <div className="account-menu" role="menu" onMouseLeave={() => setOpen(false)}>
            <div className="account-name">{user?.displayName}<small>{user?.email ?? 'Demo account'}</small></div>
            <button role="menuitem" onClick={async () => { setOpen(false); await setRole(isDriver ? 'shipper' : 'driver'); nav('/'); }}>
              {isDriver ? '📦 Switch to shipping' : '🚛 Switch to driving'}
            </button>
            <Link role="menuitem" to="/privacy" onClick={() => setOpen(false)}>Privacy</Link>
            <button role="menuitem" onClick={() => { setOpen(false); logout(); }}>Sign out</button>
          </div>
        )}
      </div>
    </header>
  );
}

export function MobileTabs() {
  const { user } = useAuth();
  const isDriver = user?.role === 'driver';
  return (
    <nav className="mobile-tabs">
      {isDriver ? (
        <>
          <NavLink to="/" end><span>📊</span>Dashboard</NavLink>
          <NavLink to="/driver/setup"><span>🚛</span>My Rig</NavLink>
          <NavLink to="/network"><span>🗺️</span>Network</NavLink>
        </>
      ) : (
        <>
          <NavLink to="/" end><span>🔎</span>Find</NavLink>
          <NavLink to="/shipments"><span>📦</span>Shipments</NavLink>
        </>
      )}
    </nav>
  );
}

export function LocationGate({ children }: { children: ReactNode }) {
  const { state, error, request } = useDeviceLocation();
  const { user, logout } = useAuth();
  if (state === 'granted') return <>{children}</>;
  const isDriver = user?.role === 'driver';
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-icon">📍</div>
        <h1>Turn on location to continue</h1>
        <p>
          {isDriver
            ? 'SquadREN shares your truck’s live position with shippers on your route so they can book space and track pickups accurately.'
            : 'SquadREN uses your location to find drivers passing near you and to set an accurate pickup point for your shipment.'}
        </p>
        {state === 'checking' && <p className="muted">Checking permission…</p>}
        {(state === 'prompt' || state === 'checking') && (
          <button className="btn primary big" onClick={request}>Enable location</button>
        )}
        {state === 'denied' && (
          <div className="gate-denied">
            <b>Location is blocked for this site.</b>
            <ol>
              <li>Tap the 🔒 / ⓘ icon in your browser’s address bar.</li>
              <li>Set <b>Location</b> to <b>Allow</b>.</li>
              <li>Come back and tap <b>Try again</b>.</li>
            </ol>
            <button className="btn primary" onClick={() => { request(); setTimeout(() => window.location.reload(), 400); }}>Try again</button>
          </div>
        )}
        {state === 'unsupported' && <p className="error">This device doesn’t support location services. Please use a phone or a browser with GPS/location support.</p>}
        {error && <p className="error">{error}</p>}
        <button className="link-btn" onClick={logout}>Sign out</button>
      </div>
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head"><h2>{title}</h2>{action}</div>
      {children}
    </section>
  );
}

export function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
