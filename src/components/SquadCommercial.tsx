import { useEffect, useRef, useState } from 'react';

/**
 * Squad REN — animated commercial.
 *
 * Capital-One-style 30-second spot, but rendered entirely with CSS + SVG so it
 * ships in the bundle (no video file to host or buffer). Scenes auto-advance,
 * loop, and end on the tagline:  "What's in your squad?"
 *
 * Storyboard (≈ 6s per scene, ~30s total):
 *   1. Tap. One avatar lights up — "Pizza tonight?"
 *   2. Rally. A pulse fans out to four squadmates; they all reply with 👍.
 *   3. Converge. Four colored dots glide across a stylized map to a pin.
 *   4. The business gets pinged: "🏪 SQUAD INCOMING — 5 guests, ETA 8 min."
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

  // Close on Escape so it feels like a real overlay.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function jump(i: number) { setScene(i); }
  function replay() { setScene(0); setPlaying(true); }

  return (
    <div className="commercial-backdrop" onClick={onClose} role="dialog" aria-label="Squad REN commercial">
      <div className="commercial" onClick={e => e.stopPropagation()}>
        <button className="commercial-close" onClick={onClose} aria-label="Close commercial">✕</button>

        <div className="commercial-stage" key={scene /* remount each scene = fresh CSS animations */}>
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

// Scene 1: One avatar lights up with the idea.
function SceneOne() {
  return (
    <div className="scene scene-1">
      <div className="caption top">Friday, 7:14 PM</div>
      <div className="hero-avatar">
        <div className="bubble">Pizza tonight? 🍕</div>
        <Face color="#8b5cf6" eyes="^^" />
      </div>
      <div className="caption bottom big">You have an idea.</div>
    </div>
  );
}

// Scene 2: Pulse goes out to four squadmates, replies pop back.
function SceneTwo() {
  const friends = [
    { color: '#0ea5e9', x: 18, y: 28, delay: 0.4 },
    { color: '#22c55e', x: 82, y: 30, delay: 0.7 },
    { color: '#f97316', x: 22, y: 72, delay: 1.0 },
    { color: '#ec4899', x: 80, y: 70, delay: 1.3 }
  ];
  return (
    <div className="scene scene-2">
      <div className="caption top">Rally the squad.</div>
      <div className="rally-stage">
        <div className="pulse-source">
          <Face color="#8b5cf6" eyes="^^" size={64} />
          <span className="pulse-ring" />
          <span className="pulse-ring d2" />
          <span className="pulse-ring d3" />
        </div>
        {friends.map((f, i) => (
          <div
            key={i}
            className="friend"
            style={{ left: `${f.x}%`, top: `${f.y}%`, animationDelay: `${f.delay}s` }}
          >
            <Face color={f.color} eyes="••" size={44} />
            <div className="reply" style={{ animationDelay: `${f.delay + 0.6}s` }}>👍</div>
          </div>
        ))}
      </div>
      <div className="caption bottom">4 squadmates, 1 second.</div>
    </div>
  );
}

// Scene 3: Dots converge on a pin on a stylized map.
function SceneThree() {
  return (
    <div className="scene scene-3">
      <div className="caption top">Converge.</div>
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

        {/* "roads" */}
        <path d="M 0 120 Q 100 80 200 120 T 400 120" stroke="rgba(255,255,255,0.18)" strokeWidth="3" fill="none" />
        <path d="M 200 0 L 200 240" stroke="rgba(255,255,255,0.12)" strokeWidth="2" fill="none" />

        {/* destination pin */}
        <g transform="translate(200 120)">
          <circle r="22" fill="rgba(249,115,22,0.18)">
            <animate attributeName="r" values="18;30;18" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <circle r="12" fill="#f97316" />
          <text textAnchor="middle" y="5" fontSize="14" fill="#fff">🍕</text>
        </g>

        {/* converging dots */}
        <Dot color="#8b5cf6" from={[20, 30]}  to={[200, 120]} delay={0}   />
        <Dot color="#0ea5e9" from={[380, 30]} to={[200, 120]} delay={0.3} />
        <Dot color="#22c55e" from={[20, 210]} to={[200, 120]} delay={0.6} />
        <Dot color="#ec4899" from={[380, 210]} to={[200, 120]} delay={0.9} />
      </svg>
      <div className="caption bottom">Everyone routes to the same pin.</div>
    </div>
  );
}

// Scene 4: Business gets the heads-up.
function SceneFour() {
  return (
    <div className="scene scene-4">
      <div className="caption top">The shop already knows.</div>
      <div className="storefront">
        <div className="awning">
          <span>TONY'S PIZZA</span>
        </div>
        <div className="window">
          <div className="ping">
            <div className="ping-head">
              <span className="dot" /> SQUAD INCOMING
            </div>
            <div className="ping-body">
              <div><strong>5 guests</strong> · ETA <strong>8 min</strong></div>
              <div className="ping-sub">Squad: <em>Pizza Goblins</em> · Regulars × 3</div>
            </div>
            <div className="ping-cta">Prep table 4 · Apply squad deal 🎁</div>
          </div>
        </div>
      </div>
      <div className="caption bottom">No call. No reservation. Just ready.</div>
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
          alt="Squad REN"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
      <div className="tagline">
        <span className="t1">What's in your</span>
        <span className="t2">squad?</span>
      </div>
      <div className="brand">SQUAD REN <span className="brand-sub">· Reputable Engagement Network</span></div>
    </div>
  );
}

/* ---------- Tiny building blocks ---------- */

function Face({ color, eyes, size = 80 }: { color: string; eyes: string; size?: number }) {
  return (
    <div
      className="face"
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: `0 8px 24px ${color}66`
      }}
    >
      <span className="eyes">{eyes}</span>
    </div>
  );
}

function Dot({
  color, from, to, delay
}: { color: string; from: [number, number]; to: [number, number]; delay: number }) {
  return (
    <g>
      <line
        x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}
        stroke={color} strokeOpacity="0.35" strokeWidth="2" strokeDasharray="4 6"
      />
      <circle r="7" fill={color} stroke="#fff" strokeWidth="2">
        <animate
          attributeName="cx"
          values={`${from[0]};${to[0]}`}
          dur="2.8s"
          begin={`${delay}s`}
          fill="freeze"
        />
        <animate
          attributeName="cy"
          values={`${from[1]};${to[1]}`}
          dur="2.8s"
          begin={`${delay}s`}
          fill="freeze"
        />
      </circle>
    </g>
  );
}
