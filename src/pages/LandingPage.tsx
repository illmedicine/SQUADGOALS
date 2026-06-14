import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { fetchEvents, fmtEventDate, fmtPrice, CATEGORY_ICONS, type VenueEvent, TM_CONFIGURED } from '../lib/venues';
import SquadAPECommercial from '../components/SquadAPECommercial';

// ─── Route hero card definitions ─────────────────────────────────────────────

type RouteHero = {
  id: string;
  title: string;
  cityLabel: string;
  detail: string;
  departDetail: string;
  price: string;
  savings: string;
  accentColor: string;
  gradient: string;
  icon: string;
  silhouette: 'nyc' | 'toronto' | 'niagara' | 'darien' | 'jails';
  heroImage?: string; // free Unsplash hi-res hero, falls back to gradient
};

const ROUTE_HEROES: RouteHero[] = [
  {
    id: 'nyc', title: 'NYC Shopping Turnaround', cityLabel: '🗽 New York City',
    detail: 'Buffalo → Rochester → Albany → New York City',
    departDetail: 'Departs 6:00 AM · Returns 1:00 AM',
    price: '$45', savings: 'vs $180+ Uber XL', icon: '🗽',
    accentColor: '#f59e0b', silhouette: 'nyc',
    gradient: 'linear-gradient(175deg,#060d1f 0%,#0d1b3e 35%,#1c0d00 70%,#060d1f 100%)',
    // NYC Times Square at night — Unsplash, free to use
    heroImage: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'toronto', title: 'Toronto Night Out', cityLabel: '🇨🇦 Toronto, Ontario',
    detail: 'Via Peace Bridge · St. Catharines · Hamilton',
    departDetail: 'Daily departures · 1.5 hr trip',
    price: '$45', savings: 'vs $160+ solo', icon: '🇨🇦',
    accentColor: '#ef4444', silhouette: 'toronto',
    gradient: 'linear-gradient(175deg,#1a0000 0%,#3d0000 40%,#1a1a2e 80%,#0d0d1a 100%)',
    // Toronto CN Tower at night — Unsplash, free to use
    heroImage: 'https://images.unsplash.com/photo-1517090186835-e348b621c9ca?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'niagara', title: 'Clifton Hill & Niagara Falls', cityLabel: '🌊 Niagara Falls, NY',
    detail: 'Falls · Casino Strip · Clifton Hill attractions',
    departDetail: 'Shortest run from Buffalo · 30 min each way',
    price: '$15', savings: 'Cheapest group run in WNY', icon: '🌊',
    accentColor: '#22d3ee', silhouette: 'niagara',
    gradient: 'linear-gradient(175deg,#020617 0%,#0c4a6e 40%,#0369a1 70%,#164e63 100%)',
    // Niagara Falls illuminated — Unsplash, free to use
    heroImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'darien', title: 'Darien Lake Day Trip', cityLabel: '🎢 Darien Lake, NY',
    detail: 'Full-day park access · Daily summer departures',
    departDetail: 'Leaves 9:00 AM · Returns 9:00 PM',
    price: '$18', savings: 'vs $60+ rideshare', icon: '🎢',
    accentColor: '#a855f7', silhouette: 'darien',
    gradient: 'linear-gradient(175deg,#0f0020 0%,#3b0764 30%,#6d28d9 60%,#92400e 100%)',
    // Roller coaster / theme park — Unsplash, free to use
    heroImage: 'https://images.unsplash.com/photo-1575364289537-3df13f26f89a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'jails', title: 'Regional Jails Run', cityLabel: '🔐 WNY Correctional',
    detail: 'Erie County · Alden · Lancaster · Attica',
    departDetail: 'Reliable daily routes — serving WNY families',
    price: '$18', savings: 'Affordable · Dependable', icon: '🔐',
    accentColor: '#94a3b8', silhouette: 'jails',
    gradient: 'linear-gradient(175deg,#020617 0%,#0f172a 40%,#1e293b 70%,#334155 100%)',
  },
];

// ─── Feed item union ──────────────────────────────────────────────────────────

type FeedItem =
  | { kind: 'splash' }
  | { kind: 'ape' }
  | { kind: 'event'; event: VenueEvent }
  | { kind: 'route'; route: RouteHero };

function buildFeed(events: VenueEvent[]): FeedItem[] {
  // Splash → APE commercial → events+routes interleaved
  const feed: FeedItem[] = [{ kind: 'splash' }, { kind: 'ape' }];
  const shuffled = [...events].sort((a, b) => {
    if (a.city !== b.city) return a.city === 'buffalo' ? -1 : 1;
    return a.date.localeCompare(b.date);
  });
  let routeIdx = 0;
  shuffled.forEach((event, i) => {
    if (i > 0 && i % 4 === 0 && routeIdx < ROUTE_HEROES.length) {
      feed.push({ kind: 'route', route: ROUTE_HEROES[routeIdx++] });
    }
    feed.push({ kind: 'event', event });
  });
  while (routeIdx < ROUTE_HEROES.length) {
    feed.push({ kind: 'route', route: ROUTE_HEROES[routeIdx++] });
  }
  return feed;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LandingPage() {
  const { signIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(TM_CONFIGURED);
  const [activeIdx, setActiveIdx] = useState(0);
  const [signingIn, setSigningIn] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const autoRef = useRef<number | null>(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const AUTO_MS = 5500;

  // Load events from both cities
  useEffect(() => {
    if (!TM_CONFIGURED) { setLoadingEvents(false); return; }
    Promise.all([
      fetchEvents('buffalo').catch(() => [] as VenueEvent[]),
      fetchEvents('toronto').catch(() => [] as VenueEvent[]),
    ]).then(([buf, tor]) => {
      setEvents([...buf, ...tor]);
      setLoadingEvents(false);
    });
  }, []);

  const feed = buildFeed(events);
  const total = feed.length;

  // Scroll to a slide by index
  const goTo = useCallback((idx: number) => {
    const el = slideRefs.current[idx];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveIdx(idx);
    }
  }, []);

  // IntersectionObserver — track which slide is in view
  useEffect(() => {
    if (!feedRef.current) return;
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            const i = slideRefs.current.findIndex(r => r === e.target);
            if (i !== -1) setActiveIdx(i);
          }
        });
      },
      { root: feedRef.current, threshold: 0.6 }
    );
    slideRefs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, [feed.length]);

  // Auto-advance
  useEffect(() => {
    if (!autoPlay || total <= 1) return;
    autoRef.current = window.setInterval(() => {
      setActiveIdx(prev => {
        const next = (prev + 1) % total;
        slideRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return next;
      });
    }, AUTO_MS);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [autoPlay, total]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') goTo(Math.min(activeIdx + 1, total - 1));
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') goTo(Math.max(activeIdx - 1, 0));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIdx, total, goTo]);

  async function handleSignIn() {
    setSigningIn(true);
    try { await signIn(); navigate('/'); }
    catch { setSigningIn(false); }
  }

  if (authLoading) return <div className="center" style={{ height: '100dvh' }}>Loading…</div>;

  return (
    <div className="landing-shell">
      {/* Top HUD — always visible */}
      <div className="landing-hud">
        <div className="landing-logo">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Squad REN"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <span>SquadREN</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="landing-hud-btn ghost" onClick={() => goTo(feed.findIndex(f => f.kind === 'route'))}>
            🚐 Routes
          </button>
          <button className="landing-hud-btn primary" onClick={handleSignIn} disabled={signingIn}>
            {signingIn ? '…' : 'Sign In'}
          </button>
        </div>
      </div>

      {/* Story progress bar */}
      <div className="landing-progress">
        {feed.map((_, i) => (
          <button key={i} className="landing-seg" onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`}>
            <div
              className="landing-seg-fill"
              style={{ width: i < activeIdx ? '100%' : i === activeIdx ? undefined : '0%' }}
            />
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="landing-feed" ref={feedRef}>
        {feed.map((item, i) => (
          <div
            key={i}
            className="landing-slide"
            ref={el => { slideRefs.current[i] = el; }}
          >
            {item.kind === 'splash' && <SplashSlide onSignIn={handleSignIn} signingIn={signingIn} onScroll={() => goTo(2)} />}
            {item.kind === 'ape'   && <APESlide onSignIn={handleSignIn} signingIn={signingIn} />}
            {item.kind === 'event' && <EventSlide event={item.event} onSignIn={handleSignIn} signingIn={signingIn} />}
            {item.kind === 'route' && <RouteSlide route={item.route} onSignIn={handleSignIn} signingIn={signingIn} />}
          </div>
        ))}
        {feed.length === 0 && loadingEvents && (
          <div className="landing-slide" style={{ background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#fff', textAlign: 'center' }}>
              <div style={{ fontSize: 48 }}>🚐</div>
              <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.6)' }}>Loading live events…</div>
            </div>
          </div>
        )}
      </div>

      {/* Right sidebar — TikTok style */}
      <div className="landing-sidebar">
        <SideBtn icon="🚐" label="Rides" onClick={() => { handleSignIn(); }} />
        <SideBtn icon="🎟️" label="Events" onClick={() => goTo(feed.findIndex(f => f.kind === 'event') || 1)} />
        <SideBtn icon="⚡" label="Rally" onClick={() => handleSignIn()} />
        <SideBtn icon="👥" label="Squad" onClick={() => handleSignIn()} />
        <SideBtn
          icon={autoPlay ? '⏸' : '▶'}
          label={autoPlay ? 'Pause' : 'Play'}
          onClick={() => setAutoPlay(p => !p)}
        />
      </div>

      {/* Scroll hint on first slide */}
      {activeIdx === 0 && (
        <button className="landing-scroll-hint" onClick={() => goTo(1)} aria-label="Scroll to see events">
          <span className="landing-scroll-chevron">⌄</span>
        </button>
      )}
    </div>
  );
}

// ─── Slide types ──────────────────────────────────────────────────────────────

function APESlide({ onSignIn, signingIn }: { onSignIn: () => void; signingIn: boolean }) {
  return (
    <div className="landing-slide-inner" style={{ background: '#060d1f', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <SquadAPECommercial embedded/>
      {/* CTA overlay at bottom */}
      <div className="ape-slide-cta-bar">
        <button className="slide-cta-primary" style={{ background: '#f59e0b', color: '#000' }} onClick={onSignIn} disabled={signingIn}>
          🚐 Join Squadron — It's Free
        </button>
        <span className="ape-slide-cta-note">⚡ APE calculates your group discount in real time</span>
      </div>
    </div>
  );
}

function SplashSlide({ onSignIn, signingIn, onScroll }: { onSignIn: () => void; signingIn: boolean; onScroll: () => void }) {
  return (
    <div className="landing-slide-inner" style={{ background: 'linear-gradient(135deg,#0a0118 0%,#1a003a 25%,#0a1128 50%,#003020 75%,#0a0118 100%)' }}>
      {/* Animated particle-like dots */}
      <div className="splash-bg-art" aria-hidden>
        {Array.from({ length: 24 }, (_, i) => (
          <div key={i} className="splash-dot" style={{
            left: `${(i * 37 + 11) % 100}%`,
            top: `${(i * 53 + 7) % 100}%`,
            animationDelay: `${(i * 0.31) % 3}s`,
            width: i % 3 === 0 ? 6 : 3,
            height: i % 3 === 0 ? 6 : 3,
            opacity: 0.15 + (i % 5) * 0.08,
          }} />
        ))}
      </div>

      {/* Decorative van route line */}
      <svg className="splash-route-svg" viewBox="0 0 400 100" aria-hidden preserveAspectRatio="xMidYMid slice">
        <path d="M-10 60 Q 50 20 100 55 T 200 45 T 300 60 T 410 40"
          stroke="rgba(139,92,246,0.25)" strokeWidth="2" fill="none" strokeDasharray="8 6" />
        <path d="M-10 70 Q 80 30 150 65 T 300 55 T 410 70"
          stroke="rgba(14,165,233,0.2)" strokeWidth="1.5" fill="none" strokeDasharray="5 8" />
        <text x="60%" y="55" fontSize="18" fill="rgba(255,255,255,0.15)" textAnchor="middle">🚐</text>
      </svg>

      <div className="splash-content">
        <div className="splash-badge">🚐 GROUP TRANSIT · LIVE EVENTS · SQUAD LIFE</div>
        <h1 className="splash-headline">
          <span className="splash-h1-line1">Roll with</span>
          <span className="splash-h1-squad">your Squad</span>
        </h1>
        <p className="splash-sub">
          NYC for $45. Toronto for $45. Niagara for $15.<br />
          Live events. Private charters. Van fleet, tracked live.
        </p>

        <div className="splash-stats">
          <div className="splash-stat"><span className="splash-stat-n">10</span><span>Vans</span></div>
          <div className="splash-stat-div" />
          <div className="splash-stat"><span className="splash-stat-n">5</span><span>Routes</span></div>
          <div className="splash-stat-div" />
          <div className="splash-stat"><span className="splash-stat-n">$15</span><span>From</span></div>
        </div>

        <button className="splash-cta-primary" onClick={onSignIn} disabled={signingIn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {signingIn ? 'Signing in…' : 'Continue with Google'}
        </button>

        <button className="splash-cta-secondary" onClick={onScroll}>
          Explore routes & events ↓
        </button>
      </div>
    </div>
  );
}

function EventSlide({ event, onSignIn, signingIn }: { event: VenueEvent; onSignIn: () => void; signingIn: boolean }) {
  const catIcon = CATEGORY_ICONS[event.category] || '📅';
  const priceStr = fmtPrice(event.minPrice, event.maxPrice, event.currency);
  const dateStr = fmtEventDate(event.date, event.time);
  const hasImage = Boolean(event.imageUrl);

  return (
    <div className="landing-slide-inner" style={{
      background: hasImage
        ? `url(${event.imageUrl}) center/cover no-repeat`
        : 'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%)',
    }}>
      <div className="slide-scrim" />

      <div className="slide-content">
        <div className="slide-badges">
          <span className="slide-badge cat">{catIcon} {event.category}</span>
          <span className="slide-badge city">{event.city === 'buffalo' ? '🦬 Buffalo' : '🇨🇦 Toronto'}</span>
          {event.status === 'onsale' && <span className="slide-badge live">● ON SALE</span>}
        </div>

        <h2 className="slide-title">{event.name}</h2>

        <div className="slide-meta">
          <span>📅 {dateStr}</span>
          <span>📍 {event.venueName}</span>
          {event.minPrice !== null && <span>🎟️ {priceStr}</span>}
        </div>

        <div className="slide-ctas">
          <button className="slide-cta-primary" onClick={onSignIn} disabled={signingIn}>
            🚐 Book Squad Ride
          </button>
          <a
            href={event.url}
            target="_blank"
            rel="noreferrer"
            className="slide-cta-secondary"
            onClick={e => { if (!event.url) e.preventDefault(); }}
          >
            🎟️ Get Tickets
          </a>
        </div>

        <div className="slide-upsell">
          <span className="slide-upsell-chip">⚡ Rally your squad → auto-book a van</span>
        </div>
      </div>
    </div>
  );
}

function RouteSlide({ route, onSignIn, signingIn }: { route: RouteHero; onSignIn: () => void; signingIn: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = route.heroImage && !imgFailed;

  return (
    <div className="landing-slide-inner" style={{
      background: showPhoto
        ? `url(${route.heroImage}) center/cover no-repeat, ${route.gradient}`
        : route.gradient,
    }}>
      {/* Invisible img tag to detect load failure — falls back to gradient */}
      {route.heroImage && !imgFailed && (
        <img src={route.heroImage} alt="" style={{ display: 'none' }}
          onError={() => setImgFailed(true)}/>
      )}
      <div className="slide-scrim route-scrim" style={{ background: showPhoto
        ? 'linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.55) 50%, rgba(0,0,0,.35) 100%)'
        : undefined }}
      />

      {/* City silhouette art */}
      <CitySilhouette id={route.silhouette} accent={route.accentColor} />

      <div className="slide-content">
        <div className="slide-badges">
          <span className="slide-badge route-badge" style={{ background: route.accentColor + '33', borderColor: route.accentColor + '66', color: route.accentColor }}>
            🚐 SQUADRON ROUTE
          </span>
          <span className="slide-badge city">{route.cityLabel}</span>
        </div>

        <h2 className="slide-title">{route.title}</h2>

        <div className="slide-meta">
          <span>📍 {route.detail}</span>
          <span>🕐 {route.departDetail}</span>
        </div>

        {/* Price comparison */}
        <div className="route-price-row">
          <div className="route-price-card squad">
            <div className="rpc-label">SQUADRON</div>
            <div className="rpc-price" style={{ color: route.accentColor }}>{route.price}</div>
            <div className="rpc-per">per seat</div>
          </div>
          <div className="route-vs">VS</div>
          <div className="route-price-card uber">
            <div className="rpc-label">SOLO</div>
            <div className="rpc-price strikethrough">{route.savings.split(' ')[0]}</div>
            <div className="rpc-per">rideshare</div>
          </div>
        </div>

        <div className="slide-ctas">
          <button className="slide-cta-primary" style={{ background: route.accentColor }} onClick={onSignIn} disabled={signingIn}>
            🚐 Book a Seat
          </button>
          <button className="slide-cta-secondary" onClick={onSignIn} disabled={signingIn}>
            📋 View Schedule
          </button>
        </div>

        <div className="slide-upsell">
          <span className="slide-upsell-chip">🚐 Private charter: <strong>$350 flat rate</strong> · any destination</span>
        </div>
      </div>
    </div>
  );
}

// ─── Right sidebar button ─────────────────────────────────────────────────────

function SideBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button className="landing-side-btn" onClick={onClick} aria-label={label}>
      <span className="lsb-icon">{icon}</span>
      <span className="lsb-label">{label}</span>
    </button>
  );
}

// ─── City silhouette SVGs ─────────────────────────────────────────────────────

function CitySilhouette({ id, accent }: { id: RouteHero['silhouette']; accent: string }) {
  const color = accent + '40';
  const bright = accent + '90';

  if (id === 'nyc') return (
    <svg className="city-svg" viewBox="0 0 800 200" aria-hidden preserveAspectRatio="xMidYMax meet">
      {/* Manhattan skyline simplified */}
      <g fill={color}>
        <rect x="10" y="120" width="18" height="80" /><rect x="30" y="100" width="14" height="100" />
        <rect x="46" y="80" width="22" height="120" /><rect x="70" y="95" width="10" height="105" />
        <rect x="82" y="60" width="26" height="140" /><rect x="82" y="50" width="8" height="15" />
        <rect x="110" y="75" width="18" height="125" /><rect x="130" y="55" width="30" height="145" />
        <rect x="130" y="30" width="6" height="30" />{/* antenna */}
        <rect x="162" y="85" width="16" height="115" />
        <rect x="180" y="45" width="38" height="155" />{/* Empire State */}
        <rect x="193" y="10" width="10" height="40" />{/* spire */}
        <rect x="220" y="70" width="20" height="130" /><rect x="242" y="90" width="14" height="110" />
        <rect x="258" y="65" width="28" height="135" /><rect x="288" y="80" width="18" height="120" />
        <rect x="308" y="95" width="22" height="105" /><rect x="332" y="75" width="16" height="125" />
        <rect x="350" y="100" width="30" height="100" /><rect x="382" y="85" width="12" height="115" />
        <rect x="396" y="60" width="22" height="140" /><rect x="420" y="78" width="18" height="122" />
        <rect x="440" y="95" width="26" height="105" /><rect x="468" y="70" width="14" height="130" />
        <rect x="484" y="90" width="20" height="110" /><rect x="506" y="80" width="16" height="120" />
        <rect x="524" y="105" width="30" height="95" /><rect x="556" y="88" width="12" height="112" />
        <rect x="570" y="75" width="24" height="125" /><rect x="596" y="95" width="18" height="105" />
        <rect x="616" y="110" width="22" height="90" /><rect x="640" y="90" width="16" height="110" />
        <rect x="658" y="100" width="28" height="100" /><rect x="688" y="85" width="14" height="115" />
        <rect x="704" y="112" width="20" height="88" /><rect x="726" y="95" width="18" height="105" />
        <rect x="746" y="108" width="26" height="92" /><rect x="774" y="90" width="16" height="110" />
      </g>
      {/* Water line */}
      <rect x="0" y="196" width="800" height="4" fill={bright} />
      {/* One Vanderbilt / WTC glows */}
      <rect x="180" y="45" width="38" height="155" fill={bright} opacity="0.4" />
    </svg>
  );

  if (id === 'toronto') return (
    <svg className="city-svg" viewBox="0 0 800 240" aria-hidden preserveAspectRatio="xMidYMax meet">
      <g fill={color}>
        {/* CN Tower */}
        <polygon points="395,8 400,8 415,180 385,180" fill={bright} opacity="0.7" />
        <ellipse cx="400" cy="95" rx="22" ry="12" fill={bright} opacity="0.5" />
        {/* Buildings */}
        <rect x="30" y="120" width="22" height="120" /><rect x="54" y="100" width="18" height="140" />
        <rect x="74" y="85" width="26" height="155" /><rect x="102" y="105" width="14" height="135" />
        <rect x="118" y="90" width="30" height="150" /><rect x="150" y="110" width="16" height="130" />
        <rect x="168" y="80" width="24" height="160" /><rect x="194" y="100" width="20" height="140" />
        <rect x="216" y="115" width="28" height="125" /><rect x="246" y="95" width="18" height="145" />
        <rect x="266" y="130" width="16" height="110" /><rect x="284" y="112" width="22" height="128" />
        <rect x="308" y="125" width="14" height="115" /><rect x="324" y="105" width="20" height="135" />
        <rect x="346" y="140" width="16" height="100" />
        <rect x="430" y="140" width="16" height="100" /><rect x="448" y="105" width="20" height="135" />
        <rect x="470" y="125" width="14" height="115" /><rect x="486" y="112" width="22" height="128" />
        <rect x="510" y="130" width="16" height="110" /><rect x="528" y="95" width="18" height="145" />
        <rect x="548" y="115" width="28" height="125" /><rect x="578" y="100" width="20" height="140" />
        <rect x="600" y="80" width="24" height="160" /><rect x="626" y="110" width="16" height="130" />
        <rect x="644" y="90" width="30" height="150" /><rect x="676" y="105" width="14" height="135" />
        <rect x="692" y="85" width="26" height="155" /><rect x="720" y="100" width="18" height="140" />
        <rect x="740" y="120" width="22" height="120" />
      </g>
      <rect x="0" y="236" width="800" height="4" fill={bright} />
    </svg>
  );

  if (id === 'niagara') return (
    <svg className="city-svg" viewBox="0 0 800 200" aria-hidden preserveAspectRatio="xMidYMax meet">
      {/* Waterfall lines */}
      {Array.from({ length: 20 }, (_, i) => (
        <line key={i}
          x1={40 * i + 10} y1="0"
          x2={40 * i - 10} y2="200"
          stroke={accent}
          strokeOpacity={0.08 + (i % 4) * 0.05}
          strokeWidth={i % 3 === 0 ? 6 : 2}
        />
      ))}
      {/* Mist cloud at bottom */}
      <ellipse cx="400" cy="195" rx="380" ry="30" fill={accent} opacity="0.15" />
      <ellipse cx="400" cy="190" rx="300" ry="20" fill={accent} opacity="0.2" />
      {/* Horseshoe Falls outline */}
      <path d="M 50 80 Q 200 180 400 185 T 750 80" stroke={bright} strokeWidth="3" fill="none" strokeOpacity="0.6" />
    </svg>
  );

  if (id === 'darien') return (
    <svg className="city-svg" viewBox="0 0 800 200" aria-hidden preserveAspectRatio="xMidYMax meet">
      {/* Roller coaster track */}
      <path d="M 0 180 Q 100 60 200 120 Q 300 180 400 60 Q 500 -20 600 100 Q 700 180 800 140"
        stroke={accent} strokeWidth="5" fill="none" strokeOpacity="0.5" />
      <path d="M 0 185 Q 100 65 200 125 Q 300 185 400 65 Q 500 -15 600 105 Q 700 185 800 145"
        stroke={accent} strokeWidth="2" fill="none" strokeOpacity="0.3" strokeDasharray="4 4" />
      {/* Support struts */}
      {[100, 200, 300, 400, 500, 600, 700].map((x, i) => (
        <line key={i} x1={x} y1="200" x2={x} y2={90 + (i % 3) * 30} stroke={color} strokeWidth="3" />
      ))}
      {/* Cart */}
      <rect x="390" y="48" width="30" height="18" rx="4" fill={bright} />
      <text x="405" y="62" textAnchor="middle" fontSize="12" fill="#fff">🎢</text>
    </svg>
  );

  // Jails — institutional bars silhouette
  return (
    <svg className="city-svg" viewBox="0 0 800 200" aria-hidden preserveAspectRatio="xMidYMax meet">
      <g fill={color} stroke={bright} strokeWidth="1" strokeOpacity="0.3">
        <rect x="100" y="80" width="600" height="120" rx="4" />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={130 + i * 47} y="90" width="14" height="100" rx="3" fill={bright} fillOpacity="0.2" />
        ))}
        <rect x="100" y="70" width="600" height="18" />{/* header */}
        {/* Guard tower left */}
        <rect x="60" y="50" width="50" height="150" />
        <rect x="50" y="40" width="70" height="18" />
        {/* Guard tower right */}
        <rect x="690" y="50" width="50" height="150" />
        <rect x="680" y="40" width="70" height="18" />
      </g>
    </svg>
  );
}
