import { useState, useEffect } from 'react';

// ─── Scene system ──────────────────────────────────────────────────────────────

const SCENE_MS = [3200, 3500, 3000, 3200, 3500, 3200, 2800];
const TOTAL_SCENES = SCENE_MS.length;

// ─── Gorilla Robot Head SVG ────────────────────────────────────────────────────

function GorillaSvg({ glow = false, size = 120 }: { glow?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="1"/>
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/>
        </radialGradient>
        <filter id="glowFilter">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Skull / head */}
      <polygon points="20,90 15,60 20,30 35,15 60,10 85,15 100,30 105,60 100,90 80,100 60,104 40,100"
        fill="#1e293b" stroke="#f59e0b" strokeWidth="2"/>
      {/* Mechanical forehead plates */}
      <rect x="35" y="20" width="50" height="8" rx="2" fill="#0f172a" stroke="#475569" strokeWidth="1"/>
      <rect x="40" y="22" width="10" height="4" rx="1" fill="#f59e0b" opacity="0.7"/>
      <rect x="70" y="22" width="10" height="4" rx="1" fill="#f59e0b" opacity="0.7"/>
      {/* Ears / side modules */}
      <rect x="8" y="42" width="12" height="20" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="1.5"/>
      <rect x="10" y="46" width="8" height="3" rx="1" fill="#22d3ee" opacity="0.8"/>
      <rect x="10" y="52" width="8" height="3" rx="1" fill="#22d3ee" opacity="0.5"/>
      <rect x="100" y="42" width="12" height="20" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="1.5"/>
      <rect x="102" y="46" width="8" height="3" rx="1" fill="#22d3ee" opacity="0.8"/>
      <rect x="102" y="52" width="8" height="3" rx="1" fill="#22d3ee" opacity="0.5"/>
      {/* Eyes */}
      {glow && <ellipse cx="42" cy="54" rx="12" ry="8" fill="#f59e0b" opacity="0.15"/>}
      {glow && <ellipse cx="78" cy="54" rx="12" ry="8" fill="#f59e0b" opacity="0.15"/>}
      <ellipse cx="42" cy="54" rx="8" ry="6" fill="#0f172a" stroke="#f59e0b" strokeWidth="2"/>
      <ellipse cx="78" cy="54" rx="8" ry="6" fill="#0f172a" stroke="#f59e0b" strokeWidth="2"/>
      <ellipse cx="42" cy="54" rx="4" ry="4" fill="#f59e0b" filter={glow ? 'url(#glowFilter)' : ''}/>
      <ellipse cx="78" cy="54" rx="4" ry="4" fill="#f59e0b" filter={glow ? 'url(#glowFilter)' : ''}/>
      <ellipse cx="42" cy="54" rx="2" ry="2" fill="#fff8"/>
      <ellipse cx="78" cy="54" rx="2" ry="2" fill="#fff8"/>
      {/* Nose / sensor */}
      <rect x="54" y="62" width="12" height="8" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1"/>
      <circle cx="57" cy="66" r="1.5" fill="#22d3ee"/>
      <circle cx="63" cy="66" r="1.5" fill="#22d3ee"/>
      {/* Jaw / chin module */}
      <rect x="30" y="74" width="60" height="18" rx="6" fill="#0f172a" stroke="#334155" strokeWidth="1.5"/>
      <rect x="36" y="78" width="16" height="6" rx="2" fill="#1e3a5f"/>
      <rect x="68" y="78" width="16" height="6" rx="2" fill="#1e3a5f"/>
      {/* Center chin LED strip */}
      <rect x="54" y="80" width="12" height="2" rx="1" fill="#f59e0b" opacity="0.9"/>
      {/* Antenna */}
      <line x1="60" y1="10" x2="60" y2="0" stroke="#f59e0b" strokeWidth="2"/>
      <circle cx="60" cy="0" r="3" fill="#f59e0b">
        {glow && <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/>}
      </circle>
      {/* Circuit lines on cheeks */}
      <path d="M22 65 h8 v-5 h5" stroke="#22d3ee" strokeWidth="0.8" fill="none" opacity="0.6"/>
      <path d="M98 65 h-8 v-5 h-5" stroke="#22d3ee" strokeWidth="0.8" fill="none" opacity="0.6"/>
      <circle cx="35" cy="65" r="1.5" fill="#22d3ee" opacity="0.8"/>
      <circle cx="85" cy="65" r="1.5" fill="#22d3ee" opacity="0.8"/>
    </svg>
  );
}

// ─── Van SVG ───────────────────────────────────────────────────────────────────

function VanSvg({ branded = true }: { branded?: boolean }) {
  return (
    <svg viewBox="0 0 280 110" xmlns="http://www.w3.org/2000/svg" aria-hidden style={{ width: '100%', maxWidth: 280 }}>
      {/* Body */}
      <rect x="10" y="30" width="240" height="65" rx="8" fill="#e2e8f0"/>
      {/* Cab */}
      <path d="M185,30 L215,30 L240,58 L240,95 L185,95 Z" fill="#cbd5e1"/>
      {/* Windshield */}
      <path d="M190,34 L212,34 L234,58 L234,72 L190,72 Z" fill="#bfdbfe" opacity="0.8"/>
      {/* Side windows */}
      <rect x="16" y="36" width="30" height="24" rx="3" fill="#bfdbfe" opacity="0.8"/>
      <rect x="52" y="36" width="30" height="24" rx="3" fill="#bfdbfe" opacity="0.8"/>
      <rect x="88" y="36" width="30" height="24" rx="3" fill="#bfdbfe" opacity="0.8"/>
      <rect x="130" y="36" width="50" height="24" rx="3" fill="#bfdbfe" opacity="0.8"/>
      {/* Branding stripe */}
      <rect x="10" y="65" width="240" height="12" rx="0" fill="#1e40af"/>
      {/* SquadREN text on side */}
      {branded && (
        <>
          <text x="90" y="60" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="9" fontWeight="900" fill="#1e40af" letterSpacing="2">SquadREN</text>
          <text x="90" y="73" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="5" fontWeight="700" fill="#fff" letterSpacing="1">GROUP TRANSIT</text>
        </>
      )}
      {/* Gorilla logo on door */}
      <circle cx="155" cy="55" r="10" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5"/>
      <text x="155" y="59" textAnchor="middle" fontFamily="Arial" fontSize="9" fill="#f59e0b">🦍</text>
      {/* Wheels */}
      <circle cx="55" cy="95" r="18" fill="#334155" stroke="#1e293b" strokeWidth="2"/>
      <circle cx="55" cy="95" r="10" fill="#475569"/>
      <circle cx="55" cy="95" r="4" fill="#94a3b8"/>
      <circle cx="210" cy="95" r="18" fill="#334155" stroke="#1e293b" strokeWidth="2"/>
      <circle cx="210" cy="95" r="10" fill="#475569"/>
      <circle cx="210" cy="95" r="4" fill="#94a3b8"/>
      {/* Front bumper / grill */}
      <rect x="245" y="60" width="18" height="28" rx="4" fill="#94a3b8"/>
      <rect x="248" y="65" width="12" height="3" rx="1" fill="#64748b"/>
      <rect x="248" y="70" width="12" height="3" rx="1" fill="#64748b"/>
      <rect x="248" y="75" width="12" height="3" rx="1" fill="#64748b"/>
      {/* Headlight */}
      <ellipse cx="256" cy="55" rx="5" ry="4" fill="#fef08a" opacity="0.9"/>
      {/* Rear */}
      <rect x="2" y="55" width="8" height="20" rx="2" fill="#94a3b8"/>
      <ellipse cx="4" cy="87" rx="4" ry="3" fill="#fca5a5" opacity="0.8"/>
    </svg>
  );
}

// ─── Rider silhouette ─────────────────────────────────────────────────────────

function RiderSvg({ x = 0, hasHat = false, label = '' }: { x?: number; hasHat?: boolean; label?: string }) {
  return (
    <g transform={`translate(${x}, 0)`}>
      {/* Body */}
      <circle cx="20" cy="12" r="9" fill="#334155"/>
      {hasHat && <rect x="12" y="4" width="16" height="5" rx="2" fill="#1e40af"/>}
      {hasHat && <rect x="10" y="6" width="20" height="2" rx="1" fill="#1e40af"/>}
      {/* Jacket/shirt */}
      <rect x="12" y="22" width="16" height="20" rx="3" fill="#1e40af"/>
      {/* SR badge */}
      <rect x="14" y="25" width="12" height="7" rx="1" fill="#f59e0b"/>
      <text x="20" y="31" textAnchor="middle" fontFamily="Arial" fontSize="5" fontWeight="900" fill="#000">SR</text>
      {/* Legs */}
      <rect x="13" y="42" width="6" height="12" rx="2" fill="#334155"/>
      <rect x="21" y="42" width="6" height="12" rx="2" fill="#334155"/>
      {/* Arms */}
      <rect x="4" y="23" width="6" height="14" rx="2" fill="#1e40af"/>
      <rect x="30" y="23" width="6" height="14" rx="2" fill="#1e40af"/>
      {label && <text x="20" y="62" textAnchor="middle" fontFamily="Arial" fontSize="5" fill="#94a3b8">{label}</text>}
    </g>
  );
}

// ─── Gear SVG ─────────────────────────────────────────────────────────────────

function GearSvg({ r = 30, teeth = 8, fill = '#1e293b', stroke = '#f59e0b', cx = 0, cy = 0, speed = '4s' }: {
  r?: number; teeth?: number; fill?: string; stroke?: string; cx?: number; cy?: number; speed?: string;
}) {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const angle = (i * Math.PI) / teeth;
    const rad = i % 2 === 0 ? r : r * 0.75;
    pts.push(`${cx + rad * Math.cos(angle)},${cy + rad * Math.sin(angle)}`);
  }
  return (
    <g>
      <polygon points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth="1.5">
        <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur={speed} repeatCount="indefinite"/>
      </polygon>
      <circle cx={cx} cy={cy} r={r * 0.3} fill="#0f172a" stroke={stroke} strokeWidth="1"/>
      <circle cx={cx} cy={cy} r={r * 0.12} fill={stroke}/>
    </g>
  );
}

// ─── Data flow line ────────────────────────────────────────────────────────────

function FlowLine({ x1, y1, x2, y2, color = '#22d3ee', delay = '0s' }: {
  x1: number; y1: number; x2: number; y2: number; color?: string; delay?: string;
}) {
  const len = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2"
      strokeDasharray={`${len}`} strokeDashoffset={`${len}`} opacity="0.8">
      <animate attributeName="stroke-dashoffset" from={`${len}`} to="0" dur="0.8s" begin={delay} fill="freeze"/>
      <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" begin={delay} repeatCount="indefinite"/>
    </line>
  );
}

// ─── Scene components ─────────────────────────────────────────────────────────

function Scene0Title() {
  return (
    <div className="ape-scene-inner">
      {/* Circuit board grid */}
      <svg className="ape-circuit-bg" viewBox="0 0 800 500" aria-hidden preserveAspectRatio="xMidYMid slice">
        {Array.from({length: 20}).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i*26} x2="800" y2={i*26}
            stroke="#22d3ee" strokeWidth="0.3" opacity={0.08 + (i%4)*0.03}/>
        ))}
        {Array.from({length: 32}).map((_, i) => (
          <line key={`v${i}`} x1={i*26} y1="0" x2={i*26} y2="500"
            stroke="#22d3ee" strokeWidth="0.3" opacity={0.06 + (i%3)*0.02}/>
        ))}
        {/* Pulsing nodes */}
        {[{x:100,y:80},{x:700,y:100},{x:150,y:400},{x:650,y:380},{x:400,y:50}].map((n,i) => (
          <circle key={i} cx={n.x} cy={n.y} r="3" fill="#f59e0b" opacity="0.5">
            <animate attributeName="r" values="3;6;3" dur={`${1.5+i*0.3}s`} repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.5;0.9;0.5" dur={`${1.5+i*0.3}s`} repeatCount="indefinite"/>
          </circle>
        ))}
      </svg>

      {/* Center content */}
      <div className="ape-title-wrap">
        <div className="ape-gorilla-wrap">
          <GorillaSvg glow size={140}/>
        </div>
        <div className="ape-by-line">BY ILLY ROBOTIC INSTRUMENTS</div>
        <div className="ape-huge-text">
          <span className="ape-a">A</span>
          <span className="ape-p">P</span>
          <span className="ape-e">E</span>
        </div>
        <div className="ape-full-name">ALGORITHMIC PRICING ENGINE</div>
        <div className="ape-tagline-sub">Powering unprecedented savings for group transit</div>
      </div>
    </div>
  );
}

const INPUTS = [
  { icon: '👥', label: 'RIDER COUNT',       value: '65%',  color: '#22d3ee', desc: 'More riders = deeper discount' },
  { icon: '📍', label: 'DISTANCE',           value: '+15%', color: '#f59e0b', desc: 'Route length factor' },
  { icon: '🕐', label: 'TIME OF DAY',        value: '56%',  color: '#a855f7', desc: 'Peak & off-peak rates' },
  { icon: '🎟️', label: 'VENUE POPULARITY',   value: '28%',  color: '#ef4444', desc: 'Event demand signal' },
  { icon: '📊', label: 'MARKET DEMAND',      value: '50%',  color: '#22c55e', desc: 'Real-time booking velocity' },
];

function Scene1Inputs({ active }: { active: boolean }) {
  return (
    <div className="ape-scene-inner ape-inputs-scene">
      <div className="ape-section-label">5 REAL-TIME INPUTS</div>
      <div className="ape-inputs-grid">
        {INPUTS.map((inp, i) => (
          <div
            key={inp.label}
            className="ape-input-card"
            style={{
              borderColor: inp.color,
              transitionDelay: active ? `${i * 0.12}s` : '0s',
              opacity: active ? 1 : 0,
              transform: active ? 'translateX(0)' : 'translateX(-40px)',
            }}
          >
            <span className="ape-inp-icon">{inp.icon}</span>
            <div className="ape-inp-body">
              <div className="ape-inp-label" style={{ color: inp.color }}>{inp.label}</div>
              <div className="ape-inp-desc">{inp.desc}</div>
            </div>
            <div className="ape-inp-val" style={{ color: inp.color }}>{inp.value}</div>
          </div>
        ))}
      </div>
      <div className="ape-inputs-arrow">→ APE ENGINE</div>
    </div>
  );
}

function Scene2Engine() {
  return (
    <div className="ape-scene-inner ape-engine-scene">
      <div className="ape-section-label">THE ENGINE</div>
      <div className="ape-engine-wrap">
        {/* SVG gears + data flows */}
        <svg viewBox="0 0 400 300" className="ape-engine-svg" aria-hidden>
          {/* Input lines flowing into center */}
          <FlowLine x1={10} y1={60}  x2={160} y2={150} color="#22d3ee" delay="0s"/>
          <FlowLine x1={10} y1={100} x2={160} y2={150} color="#f59e0b" delay="0.15s"/>
          <FlowLine x1={10} y1={150} x2={160} y2={150} color="#a855f7" delay="0.3s"/>
          <FlowLine x1={10} y1={200} x2={160} y2={150} color="#ef4444" delay="0.45s"/>
          <FlowLine x1={10} y1={240} x2={160} y2={150} color="#22c55e" delay="0.6s"/>
          {/* Input labels */}
          {INPUTS.map((inp, i) => (
            <text key={inp.label} x="12" y={60 + i*45} fontSize="9" fill={inp.color} fontFamily="monospace">{inp.icon} {inp.label}</text>
          ))}
          {/* Center gears */}
          <GearSvg cx={200} cy={150} r={42} teeth={12} fill="#1e293b" stroke="#f59e0b" speed="4s"/>
          <GearSvg cx={255} cy={110} r={22} teeth={8}  fill="#0f172a" stroke="#22d3ee" speed="2.5s"/>
          <GearSvg cx={255} cy={190} r={22} teeth={8}  fill="#0f172a" stroke="#a855f7" speed="3s"/>
          {/* Gorilla face at center */}
          <circle cx="200" cy="150" r="25" fill="#0f172a" stroke="#f59e0b" strokeWidth="2"/>
          <ellipse cx="192" cy="147" rx="5" ry="4" fill="#f59e0b"/>
          <ellipse cx="208" cy="147" rx="5" ry="4" fill="#f59e0b"/>
          <circle cx="192" cy="147" r="2" fill="#000"/>
          <circle cx="208" cy="147" r="2" fill="#000"/>
          {/* Output line */}
          <FlowLine x1={280} y1={150} x2={390} y2={150} color="#f59e0b" delay="1.2s"/>
          <text x="300" y="140" fontSize="10" fill="#f59e0b" fontFamily="monospace" fontWeight="bold">OUTPUT →</text>
          {/* Floating math symbols */}
          {['×','%','√','Σ','+'].map((s, i) => (
            <text key={s} x={155 + (i%3)*35} y={80 + Math.floor(i/3)*80}
              fontSize="14" fill="#22d3ee" opacity="0.4" fontFamily="serif">
              {s}
              <animate attributeName="opacity" values="0.4;0.8;0.4" dur={`${1.2+i*0.3}s`} repeatCount="indefinite"/>
            </text>
          ))}
        </svg>
        <div className="ape-processing-text">
          <ProcessingCounter />
        </div>
      </div>
    </div>
  );
}

function ProcessingCounter() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN(Math.floor(Math.random() * 9999)), 120);
    return () => clearInterval(t);
  }, []);
  return <span className="ape-counter">{String(n).padStart(4, '0')}</span>;
}

function Scene3Output() {
  return (
    <div className="ape-scene-inner ape-output-scene">
      <div className="ape-section-label">DYNAMIC PRICING OUTPUT</div>
      <div className="ape-output-wrap">
        {/* Gorilla head above output */}
        <div className="ape-output-ape">
          <GorillaSvg glow size={80}/>
        </div>
        <div className="ape-output-cards">
          <div className="ape-out-card squadron">
            <div className="ape-out-label">SQUADRON SEAT</div>
            <div className="ape-out-price">$45</div>
            <div className="ape-out-sub">per rider · NYC run</div>
            <div className="ape-out-badge">⚡ APE RATE</div>
          </div>
          <div className="ape-out-vs">VS</div>
          <div className="ape-out-card uber">
            <div className="ape-out-label">SOLO RIDESHARE</div>
            <div className="ape-out-price strikeout">$140+</div>
            <div className="ape-out-sub">Uber XL · same trip</div>
            <div className="ape-out-badge muted">NO GROUP RATE</div>
          </div>
        </div>
        <div className="ape-discount-banner">
          <span className="ape-disc-num">68%</span>
          <span className="ape-disc-label">DYNAMIC GROUP DISCOUNT</span>
          <span className="ape-disc-rate">$.192% RATE</span>
        </div>
        <div className="ape-formula-strip">
          Base × (1 − Rider Discount − Fill Discount + Demand Surcharge)
        </div>
      </div>
    </div>
  );
}

function Scene4Van() {
  return (
    <div className="ape-scene-inner ape-van-scene">
      <div className="ape-section-label">REAL WORLD: BUFFALO → NYC</div>
      {/* Route line */}
      <div className="ape-route-strip">
        <span className="ape-route-city">🦬 BUFFALO</span>
        <div className="ape-route-line">
          <div className="ape-route-dot"/>
          <div className="ape-route-track"/>
          <div className="ape-van-animated">🚐</div>
        </div>
        <span className="ape-route-city">🗽 NYC</span>
      </div>
      {/* Van illustration */}
      <div className="ape-van-illustration">
        <VanSvg branded/>
      </div>
      {/* Squad boarding */}
      <div className="ape-boarding-wrap">
        <svg viewBox="0 0 320 75" className="ape-riders-svg" aria-hidden>
          <RiderSvg x={0}   hasHat label="Driver"/>
          <RiderSvg x={55}  label="Rider 1"/>
          <RiderSvg x={110} label="Rider 2"/>
          <RiderSvg x={165} label="Rider 3"/>
          <RiderSvg x={220} label="Rider 4"/>
          <RiderSvg x={275} label="Rider 5"/>
        </svg>
        <div className="ape-price-tag">$45 / seat · APE Group Rate · Save 68%</div>
      </div>
    </div>
  );
}

function Scene5Comparison() {
  return (
    <div className="ape-scene-inner ape-compare-scene">
      <div className="ape-section-label">SQUAD ECONOMICS</div>
      <div className="ape-compare-grid">
        <div className="ape-compare-route">
          <div className="ape-cr-emoji">🗽</div>
          <div className="ape-cr-name">NYC Shopping Run</div>
          <div className="ape-cr-sq">$45 <span className="ape-cr-per">/ seat</span></div>
          <div className="ape-cr-uber">vs $180+ Uber XL</div>
          <div className="ape-cr-save">Save 75%</div>
        </div>
        <div className="ape-compare-route">
          <div className="ape-cr-emoji">🇨🇦</div>
          <div className="ape-cr-name">Toronto Night Out</div>
          <div className="ape-cr-sq">$45 <span className="ape-cr-per">/ seat</span></div>
          <div className="ape-cr-uber">vs $160+ solo</div>
          <div className="ape-cr-save">Save 72%</div>
        </div>
        <div className="ape-compare-route">
          <div className="ape-cr-emoji">🌊</div>
          <div className="ape-cr-name">Clifton Hill</div>
          <div className="ape-cr-sq">$15 <span className="ape-cr-per">/ seat</span></div>
          <div className="ape-cr-uber">vs $60+ solo</div>
          <div className="ape-cr-save">Save 75%</div>
        </div>
        <div className="ape-compare-route">
          <div className="ape-cr-emoji">🎢</div>
          <div className="ape-cr-name">Darien Lake</div>
          <div className="ape-cr-sq">$18 <span className="ape-cr-per">/ seat</span></div>
          <div className="ape-cr-uber">vs $60+ solo</div>
          <div className="ape-cr-save">Save 70%</div>
        </div>
      </div>
      <div className="ape-powered-label">Powered by APE · Algorithmic Pricing Engine</div>
    </div>
  );
}

function Scene6Features() {
  return (
    <div className="ape-scene-inner ape-features-scene">
      <div className="ape-section-label">PLATFORM PILLARS</div>
      <div className="ape-pillars">
        <div className="ape-pillar">
          <div className="ape-pillar-icon">🚐</div>
          <div className="ape-pillar-title">LIVE PRESENCE</div>
          <div className="ape-pillar-desc">15-passenger vans tracked in real time. Hitchhiker AI for en-route pickups.</div>
        </div>
        <div className="ape-pillar">
          <div className="ape-pillar-icon">🤖</div>
          <div className="ape-pillar-title">UNIFIED RIDING</div>
          <div className="ape-pillar-desc">Group rideshare van control with APE arrival-time optimization.</div>
        </div>
        <div className="ape-pillar">
          <div className="ape-pillar-icon">✅</div>
          <div className="ape-pillar-title">CHECK-IN WO</div>
          <div className="ape-pillar-desc">Digitalize high-quality Public Group check-in. $1.00 boarding fee confirmation.</div>
        </div>
        <div className="ape-pillar">
          <div className="ape-pillar-icon">🏟️</div>
          <div className="ape-pillar-title">VENUE INTEGRATION</div>
          <div className="ape-pillar-desc">Redefine venue marketplace — manned center + local deals.</div>
        </div>
      </div>
    </div>
  );
}

function Scene7Outro() {
  return (
    <div className="ape-scene-inner ape-outro-scene">
      <div className="ape-gorilla-outro">
        <GorillaSvg glow size={100}/>
      </div>
      <div className="ape-outro-headline">POWERING UNPRECEDENTED SAVINGS</div>
      <div className="ape-outro-sub">SEAMLESS COMMUNITY · REAL-TIME OPTIMIZATION</div>
      <div className="ape-outro-stats">
        <div className="ape-outro-stat"><span className="ape-os-n">10</span><span>Vans</span></div>
        <div className="ape-outro-div"/>
        <div className="ape-outro-stat"><span className="ape-os-n">5</span><span>Routes</span></div>
        <div className="ape-outro-div"/>
        <div className="ape-outro-stat"><span className="ape-os-n">68%</span><span>Avg. Savings</span></div>
        <div className="ape-outro-div"/>
        <div className="ape-outro-stat"><span className="ape-os-n">$15</span><span>From</span></div>
      </div>
      <div className="ape-outro-brand">
        <div className="ape-outro-logo">SquadREN</div>
        <div className="ape-outro-by">APE.SQUADREN.APP · ILLYROBOTIC.COM</div>
        <div className="ape-outro-demo">REQUEST A DEMO</div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function SquadAPECommercial({ embedded = false }: { embedded?: boolean }) {
  const [scene, setScene] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const dur = SCENE_MS[scene];
    setProgress(0);
    const start = Date.now();
    const raf = () => {
      const pct = Math.min(100, ((Date.now() - start) / dur) * 100);
      setProgress(pct);
      if (pct < 100) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    const t = setTimeout(() => setScene(s => (s + 1) % TOTAL_SCENES), dur);
    return () => clearTimeout(t);
  }, [scene]);

  const scenes = [
    <Scene0Title/>,
    <Scene1Inputs active={scene === 1}/>,
    <Scene2Engine/>,
    <Scene3Output/>,
    <Scene4Van/>,
    <Scene5Comparison/>,
    <Scene6Features/>,
  ];
  // 7 scenes but SCENE_MS has 7 entries — last scene is outro only if TOTAL_SCENES === 8
  // Actually we have 7 scenes in the array, matching SCENE_MS length 7
  const activeScene = scene < scenes.length
    ? scenes[scene]
    : <Scene7Outro/>;

  return (
    <div className={`ape-com${embedded ? ' ape-com--embedded' : ''}`}>
      {/* Scene */}
      <div className="ape-scene-host" key={scene}>
        {activeScene}
      </div>

      {/* Scene progress dots */}
      <div className="ape-progress-row">
        {SCENE_MS.map((_, i) => (
          <button key={i} className={`ape-prog-seg ${i === scene ? 'active' : i < scene ? 'done' : ''}`}
            onClick={() => setScene(i)} aria-label={`Scene ${i+1}`}>
            {i === scene && (
              <div className="ape-prog-fill" style={{ width: `${progress}%` }}/>
            )}
          </button>
        ))}
      </div>

      {/* Static corner badge */}
      <div className="ape-corner-badge">
        <span className="ape-cb-text">APE</span>
        <span className="ape-cb-sub">BY ILLY ROBOTIC</span>
      </div>
    </div>
  );
}
