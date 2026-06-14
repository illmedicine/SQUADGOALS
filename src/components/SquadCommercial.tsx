import { useEffect, useRef, useState } from 'react';

/**
 * Squadron — animated commercial.
 *
 * Storyboard (≈ 6s per scene, ~30s total):
 *   1. Tap. Squad chat lights up — "Toronto tonight? 🇨🇦"
 *   2. Venues. Live event card appears — squad rallies for the show.
 *   3. Fleet. Van moves across a map toward Squad HQ pickup.
 *   4. Aboard. Price comparison — $45/seat vs Uber XL.
 *   5. Tagline reveal: "What's in your squad?" + logo.
 */
export default function SquadCommercial({ onClose }: { onClose: () => void }) {
  const SCENE_COUNT = 5;
  const SCENE_MS = 6000;
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    timerRef.current = window.setTimeout(() => {
      setScene(s => (s + 1) % SCENE_COUNT);
    }, SCENE_MS);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [scene, playing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function jump(i: number) { setScene(i); }
  function replay() { setScene(0); setPlaying(true); }

  return (
    <div className="commercial-backdrop" onClick={onClose} role="dialog" aria-label="Squadron commercial">
      <div className="commercial" onClick={e => e.stopPropagation()}>
        <button className="commercial-close" onClick={onClose} aria-label="Close commercial">✕</button>

        <div className="commercial-stage" key={scene}>
          {scene === 0 && <SceneOne />}
          {scene === 1 && <SceneTwo />}
          {scene === 2 && <SceneThree />}
          {scene === 3 && <SceneFour />}
          {scene === 4 && <SceneFive />}
        </div>

        <div className="commercial-progress">
          {Array.from({ length: SCENE_COUNT }).map((_, i) => (
            <button
              key={i}
              className={'commercial-dot' + (i === scene ? ' active' : '') + (i < scene ? ' done' : '')}
              onClick={() => jump(i)}
              aria-label={`Scene ${i + 1}`}
            />
          ))}
        </div>

        <div className="commercial-controls">
          <button className="chip" onClick={() => setPlaying(p => !p)}>
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button className="chip" onClick={replay}>↻ Replay</button>
          <button className="chip" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Scenes ---------- */

// Scene 1: Squad chat lights up with a Toronto run idea.
function SceneOne() {
  const msgs = [
    { from: 'Maya',   color: '#0ea5e9', text: 'Toronto tonight? 🇨🇦', delay: 0.3 },
    { from: 'Tyler',  color: '#22c55e', text: 'IN 🙌',               delay: 1.1 },
    { from: 'Devon',  color: '#ec4899', text: 'Book the van!',        delay: 1.9 },
    { from: 'You',    color: '#8b5cf6', text: 'Already on it 🚐',     delay: 2.7 },
  ];
  return (
    <div className="scene scene-1">
      <div className="caption top">Saturday, 3:42 PM</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 12px', marginTop: 18 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-end', gap: 8,
            justifyContent: m.from === 'You' ? 'flex-end' : 'flex-start',
            animation: `fadeSlideUp 0.4s ease both`,
            animationDelay: `${m.delay}s`
          }}>
            {m.from !== 'You' && (
              <div style={{
                width: 30, height: 30, borderRadius: '50%', background: m.color,
                display: 'grid', placeItems: 'center', color: '#fff', fontSize: 12, fontWeight: 800, flex: '0 0 30px'
              }}>{m.from[0]}</div>
            )}
            <div style={{
              background: m.from === 'You' ? '#8b5cf6' : '#f1f5f9',
              color: m.from === 'You' ? '#fff' : '#0f172a',
              padding: '8px 12px', borderRadius: 14,
              fontSize: 14, fontWeight: 600, maxWidth: '70%'
            }}>{m.text}</div>
          </div>
        ))}
      </div>
      <div className="caption bottom big">The squad wants to roll.</div>
    </div>
  );
}

// Scene 2: Venues — live event card, squad rally.
function SceneTwo() {
  return (
    <div className="scene scene-2">
      <div className="caption top">Browse Venues 🎟️</div>
      <div style={{ padding: '8px 12px', marginTop: 10 }}>
        <div style={{
          background: '#fff', borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
          animation: 'fadeSlideUp 0.5s ease both'
        }}>
          <div style={{ height: 90, background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 44 }}>🎸</span>
          </div>
          <div style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <span className="pill" style={{ background: '#0ea5e9', color: '#fff', fontSize: 10 }}>🇨🇦 Toronto</span>
              <span className="pill" style={{ background: '#22c55e', color: '#fff', fontSize: 10 }}>Music</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Live Nation Summer Series</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Sat, Jun 21 · Scotiabank Arena</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <div style={{
                flex: 1, padding: '8px 10px', borderRadius: 10,
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                color: '#fff', fontSize: 13, fontWeight: 800, textAlign: 'center',
                animation: 'fadeSlideUp 0.4s ease both', animationDelay: '1.2s'
              }}>⚡ Rally Squad</div>
              <div style={{
                flex: 1, padding: '8px 10px', borderRadius: 10,
                background: 'linear-gradient(135deg, #0ea5e9, #22c55e)',
                color: '#fff', fontSize: 13, fontWeight: 800, textAlign: 'center',
                animation: 'fadeSlideUp 0.4s ease both', animationDelay: '1.6s'
              }}>🚐 Book a Ride</div>
            </div>
          </div>
        </div>
      </div>
      <div className="caption bottom">Event → ride in one tap.</div>
    </div>
  );
}

// Scene 3: Van moving on the map toward Squad HQ.
function SceneThree() {
  return (
    <div className="scene scene-3">
      <div className="caption top">Live fleet · En route to HQ</div>
      <svg viewBox="0 0 400 240" className="map-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(139,92,246,0.18)" strokeWidth="1" />
          </pattern>
          <radialGradient id="bg3" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#0b0820" />
          </radialGradient>
        </defs>
        <rect width="400" height="240" fill="url(#bg3)" />
        <rect width="400" height="240" fill="url(#grid)" />

        {/* Roads */}
        <path d="M 0 120 Q 150 80 250 120 T 400 110" stroke="rgba(255,255,255,0.18)" strokeWidth="4" fill="none" />
        <path d="M 250 0 L 250 240" stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none" />

        {/* Route line */}
        <path d="M 60 120 Q 155 80 250 120" stroke="#8b5cf6" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="6 5" fill="none" />

        {/* Squad HQ destination */}
        <g transform="translate(250 120)">
          <circle r="22" fill="rgba(139,92,246,0.2)">
            <animate attributeName="r" values="18;30;18" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <circle r="13" fill="#8b5cf6" />
          <text textAnchor="middle" y="5" fontSize="13" fill="#fff">🏠</text>
          <text textAnchor="middle" y="-28" fontSize="9" fill="#c4b5fd" fontWeight="700">SQUAD HQ</text>
        </g>

        {/* Van moving along route */}
        <g>
          <circle r="18" fill="rgba(14,165,233,0.25)">
            <animateMotion dur="3s" repeatCount="indefinite" path="M 60 120 Q 155 80 250 120" />
          </circle>
          <text fontSize="20" textAnchor="middle" dominantBaseline="middle">
            🚐
            <animateMotion dur="3s" repeatCount="indefinite" path="M 60 120 Q 155 80 250 120" />
          </text>
        </g>

        {/* ETA badge */}
        <rect x="290" y="60" width="96" height="36" rx="10" fill="rgba(14,165,233,0.9)" />
        <text x="338" y="74" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">VAN-03 · TORONTO</text>
        <text x="338" y="88" textAnchor="middle" fontSize="10" fill="#bfdbfe">ETA 4 min</text>
      </svg>
      <div className="caption bottom">10-van fleet · real-time positions.</div>
    </div>
  );
}

// Scene 4: Price comparison — aboard the van.
function SceneFour() {
  const seats = Array.from({ length: 10 }, (_, i) => i);
  return (
    <div className="scene scene-4">
      <div className="caption top">Toronto run · 10 seats filled</div>
      <div style={{ padding: '8px 16px' }}>
        {/* Van seat grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6,
          background: 'rgba(139,92,246,0.08)', borderRadius: 14, padding: 12, marginBottom: 14
        }}>
          {seats.map(i => (
            <div key={i} style={{
              height: 32, borderRadius: 8,
              background: '#8b5cf6', display: 'grid', placeItems: 'center',
              fontSize: 16,
              animation: 'fadeSlideUp 0.3s ease both',
              animationDelay: `${i * 0.12}s`
            }}>🙂</div>
          ))}
        </div>
        {/* Price comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{
            padding: '12px 14px', borderRadius: 14,
            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
            color: '#fff', textAlign: 'center',
            animation: 'fadeSlideUp 0.4s ease 1.2s both'
          }}>
            <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 700 }}>SQUADRON</div>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>$45</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>per seat</div>
          </div>
          <div style={{
            padding: '12px 14px', borderRadius: 14,
            background: '#f1f5f9', textAlign: 'center',
            animation: 'fadeSlideUp 0.4s ease 1.5s both'
          }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>UBER XL</div>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: '#ef4444', textDecoration: 'line-through' }}>$140+</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>same trip</div>
          </div>
        </div>
        <div style={{
          marginTop: 10, padding: '8px 14px', borderRadius: 10,
          background: 'rgba(34,197,94,0.12)', border: '1px solid #22c55e',
          textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#15803d',
          animation: 'fadeSlideUp 0.4s ease 1.9s both'
        }}>
          Save 68% rolling with your squad 🎉
        </div>
      </div>
      <div className="caption bottom">Roll deeper. Spend less.</div>
    </div>
  );
}

// Scene 5: Tagline + logo.
function SceneFive() {
  return (
    <div className="scene scene-5">
      <div className="logo-pop">
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="Squadron"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
      <div className="tagline">
        <span className="t1">What's in your</span>
        <span className="t2">squad?</span>
      </div>
      <div className="brand">SQUADRON <span className="brand-sub">· Group Transit · Live Presence · Local Deals</span></div>
    </div>
  );
}

/* ---------- Helpers ---------- */

// No-op export to satisfy potential re-imports after rename.
export {};
