import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, defaultAvatar, type AvatarConfig } from '../lib/AuthContext';

/**
 * Simulation Labs.
 *
 * "What would it look like if every member of your squad committed to the same
 * destination at the same time?" Runs entirely client-side: synthetic GPS,
 * synthetic ETAs, AI-flavored stats. Real-time animated SVG map.
 *
 * Two modes:
 *   - Solo / Mock — five demo squadmates with cartoon avatars
 *   - My Squad   — pull members from the signed-in user's squad (TODO: hook
 *                  into watchUserSquads). For now we always render a 5-member
 *                  squadron with the signed-in user as the leader.
 */

type Mode = 'walk' | 'bike' | 'drive' | 'transit';
type Status = 'queued' | 'moving' | 'arrived';

type SimMember = {
  uid: string;
  name: string;
  color: string;
  avatar: AvatarConfig;
  mode: Mode;
  status: Status;
  // World-space coords on the 400x500 SVG canvas.
  x: number;
  y: number;
  startX: number;
  startY: number;
  // Path progress 0..1.
  t: number;
  // Curve control points (gives the path personality, not a ruler-straight line).
  cx: number;
  cy: number;
  // "Real-world" metrics.
  totalDistanceMi: number;
  speedMph: number;
  etaSec: number;
  remainingSec: number;
  // AI-flavored extras.
  confidence: number;    // 0..1
  congestion: number;    // 0..1
  fatigue: number;       // 0..1
  // For chat/commentary log entry rotation.
  lastQuipAt: number;
};

const PRESETS = [
  { id: 'pizza',  label: '🍕 Tony\'s Pizza',     hint: 'Downtown · 0.4 mi avg' },
  { id: 'beach',  label: '🏖️ Sunset Beach',     hint: 'Coast · 3.2 mi avg' },
  { id: 'arena',  label: '🏟️ The Arena',        hint: 'Stadium district · 5.6 mi avg' },
  { id: 'park',   label: '🌳 Riverside Park',   hint: 'Greenway · 1.8 mi avg' },
  { id: 'bar',    label: '🍻 The Watering Hole', hint: 'Nightlife strip · 0.9 mi avg' }
];

const MODE_META: Record<Mode, { icon: string; label: string; mph: [number, number] }> = {
  walk:    { icon: '🚶', label: 'Walking', mph: [2.6, 3.6] },
  bike:    { icon: '🚲', label: 'Biking',  mph: [9, 13]    },
  drive:   { icon: '🚗', label: 'Driving', mph: [22, 38]   },
  transit: { icon: '🚌', label: 'Transit', mph: [14, 22]   }
};

const DEMO_MEMBERS: Array<{ name: string; color: string }> = [
  { name: 'You',     color: '#8b5cf6' },
  { name: 'Maya',    color: '#0ea5e9' },
  { name: 'Tyler',   color: '#22c55e' },
  { name: 'Jasmine', color: '#f97316' },
  { name: 'Devon',   color: '#ec4899' }
];

const QUIPS = [
  '🟢 Re-routing around congestion',
  '🛰️ GPS lock confirmed',
  '⚡ Optimal corridor found',
  '🧭 Maintaining group sync',
  '🚦 Light traffic ahead',
  '🪫 Battery efficient pace',
  '☕ Coffee detour declined',
  '👟 Foot-traffic pattern detected',
  '🧠 AI confidence rising',
  '📡 Squad heartbeat received'
];

// Canvas (SVG viewport) constants.
const W = 400;
const H = 500;
const DEST: [number, number] = [W / 2, H / 2 + 30];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s & 0xffffffff) / 0x100000000;
  };
}

function makeMember(i: number, base: typeof DEMO_MEMBERS[number], avatar: AvatarConfig, mode: Mode, seed: number): SimMember {
  const rand = rng(seed + i * 7919);
  // Spawn around the edges of the canvas with some jitter.
  const corners: Array<[number, number]> = [
    [40, 60], [W - 40, 70], [60, H - 60], [W - 60, H - 50], [W / 2, 30]
  ];
  const [bx, by] = corners[i % corners.length];
  const sx = bx + (rand() - 0.5) * 40;
  const sy = by + (rand() - 0.5) * 40;
  const mph = MODE_META[mode].mph;
  const speedMph = mph[0] + rand() * (mph[1] - mph[0]);
  // Pseudo-distance: scale SVG distance to "real miles" so it feels plausible.
  const dx = DEST[0] - sx;
  const dy = DEST[1] - sy;
  const svgDist = Math.sqrt(dx * dx + dy * dy);
  const totalDistanceMi = +(svgDist / 110).toFixed(2);
  const etaSec = Math.max(20, Math.round((totalDistanceMi / speedMph) * 3600));
  // Curve control: pull perpendicular to the line for a bezier with character.
  const mx = (sx + DEST[0]) / 2;
  const my = (sy + DEST[1]) / 2;
  const perpX = -(DEST[1] - sy);
  const perpY = (DEST[0] - sx);
  const perpLen = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
  const offset = (rand() - 0.5) * 0.45; // -22% to +22% of line length
  const cx = mx + (perpX / perpLen) * svgDist * offset;
  const cy = my + (perpY / perpLen) * svgDist * offset;
  return {
    uid: `m${i}`,
    name: base.name,
    color: base.color,
    avatar,
    mode,
    status: 'queued',
    x: sx, y: sy, startX: sx, startY: sy, t: 0,
    cx, cy,
    totalDistanceMi,
    speedMph,
    etaSec,
    remainingSec: etaSec,
    confidence: 0.78 + rand() * 0.2,
    congestion: rand() * 0.4,
    fatigue: 0,
    lastQuipAt: 0
  };
}

function bezier(p0: number, p1: number, p2: number, t: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

export default function SimulationLabsPage() {
  const { user } = useAuth();
  const [presetId, setPresetId] = useState<string>('pizza');
  const [committed, setCommitted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speedX, setSpeedX] = useState(8);          // Sim time multiplier.
  const [members, setMembers] = useState<SimMember[]>([]);
  const [tick, setTick] = useState(0);
  const [log, setLog] = useState<Array<{ at: number; who: string; text: string; color: string }>>([]);
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 9e6) + 1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  const preset = PRESETS.find(p => p.id === presetId) || PRESETS[0];

  // Build squad on commit. The signed-in user becomes member 0 with their real
  // avatar; the rest are demo characters with the default avatar.
  function commit() {
    const base = DEMO_MEMBERS.map((m, i) => i === 0 && user
      ? { name: user.displayName || 'You', color: m.color }
      : m
    );
    const avatar = (user?.avatar) || defaultAvatar;
    const modes: Mode[] = ['drive', 'walk', 'bike', 'drive', 'transit'];
    const next: SimMember[] = base.map((b, i) =>
      makeMember(i, b, i === 0 ? avatar : defaultAvatar, modes[i % modes.length], seed)
    );
    // Stagger starts so members "leave" at slightly different times.
    next.forEach((m, i) => { m.status = i === 0 ? 'moving' : 'queued'; });
    setMembers(next);
    setCommitted(true);
    setPaused(false);
    lastRef.current = performance.now();
    setLog([{
      at: Date.now(),
      who: 'AI Coach',
      text: `Squad committed to ${preset.label}. Calculating optimal corridors…`,
      color: '#fde047'
    }]);
  }

  function reset() {
    setCommitted(false);
    setMembers([]);
    setLog([]);
    setTick(0);
    setSeed(Math.floor(Math.random() * 9e6) + 1);
  }

  // RAF loop — advances every member, fires log events.
  useEffect(() => {
    if (!committed || paused) return;
    function step(now: number) {
      const dt = Math.min(0.08, (now - lastRef.current) / 1000) * speedX;
      lastRef.current = now;
      setMembers(prev => {
        let releasedNext = false;
        const out = prev.map((m, idx) => {
          if (m.status === 'arrived') return m;
          // Stagger: release queued members after the previous one moves a bit.
          if (m.status === 'queued') {
            const lead = prev[idx - 1];
            if (lead && lead.t >= 0.08 && !releasedNext) {
              releasedNext = true;
              return { ...m, status: 'moving' as Status };
            }
            return m;
          }
          // Distance covered this frame, scaled to canvas progress.
          const progressPerSec = (m.speedMph / 3600) / Math.max(m.totalDistanceMi, 0.05);
          const dT = progressPerSec * dt * (1 - m.congestion * 0.4);
          let t = Math.min(1, m.t + dT);
          const x = bezier(m.startX, m.cx, DEST[0], t);
          const y = bezier(m.startY, m.cy, DEST[1], t);
          const remainingSec = Math.max(0, m.etaSec * (1 - t));
          const fatigue = Math.min(1, m.fatigue + dt * 0.002);
          // Small congestion drift so the AI numbers feel alive.
          const congestion = Math.max(0, Math.min(0.7, m.congestion + (Math.sin(now / 900 + idx) * 0.5 + 0.5 - 0.5) * 0.004));
          const confidence = Math.max(0.55, Math.min(0.99, m.confidence + (Math.cos(now / 1100 + idx * 2) * 0.5) * 0.003));
          const status: Status = t >= 1 ? 'arrived' : 'moving';
          return { ...m, t, x, y, remainingSec, fatigue, congestion, confidence, status };
        });
        return out;
      });
      setTick(n => n + 1);
      rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [committed, paused, speedX]);

  // Commentary log: emit a quip every ~1.5s of sim time, rotating speakers.
  useEffect(() => {
    if (!committed || paused || members.length === 0) return;
    const id = window.setInterval(() => {
      setMembers(prev => {
        if (prev.length === 0) return prev;
        const movers = prev.filter(m => m.status === 'moving');
        if (movers.length === 0) return prev;
        const m = movers[Math.floor(Math.random() * movers.length)];
        const text = QUIPS[Math.floor(Math.random() * QUIPS.length)];
        setLog(prevLog => [
          { at: Date.now(), who: m.name, text, color: m.color },
          ...prevLog
        ].slice(0, 12));
        return prev;
      });
    }, 1800);
    return () => window.clearInterval(id);
  }, [committed, paused, members.length]);

  // Arrival announcements (fires once per member crossing the line).
  const arrivedKeyRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    members.forEach(m => {
      if (m.status === 'arrived' && !arrivedKeyRef.current.has(m.uid)) {
        arrivedKeyRef.current.add(m.uid);
        setLog(prev => [
          { at: Date.now(), who: 'AI Coach', text: `🎉 ${m.name} has arrived at ${preset.label}.`, color: '#22c55e' },
          ...prev
        ].slice(0, 12));
      }
    });
  }, [members, preset.label]);
  useEffect(() => { arrivedKeyRef.current = new Set(); }, [committed]);

  // Aggregate stats for the AI banner.
  const stats = useMemo(() => {
    if (members.length === 0) return null;
    const arrived = members.filter(m => m.status === 'arrived').length;
    const avgConfidence = members.reduce((s, m) => s + m.confidence, 0) / members.length;
    const maxEta = Math.max(...members.map(m => m.remainingSec));
    const minEta = Math.min(...members.filter(m => m.status !== 'arrived').map(m => m.remainingSec).concat([0]));
    const avgCongestion = members.reduce((s, m) => s + m.congestion, 0) / members.length;
    const spread = maxEta - minEta;
    const syncScore = Math.max(0, Math.min(100, Math.round(100 - spread / 6)));
    return {
      arrived,
      total: members.length,
      avgConfidence,
      avgCongestion,
      maxEta,
      syncScore
    };
  }, [members, tick]);

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 26 }}>🧪</span>
        <div>
          <h1 style={{ margin: 0 }}>Simulation Labs</h1>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Experimental · Preview how a Squad commit would play out in real time
          </div>
        </div>
      </div>

      <div className="card" style={{ borderTop: '3px solid #8b5cf6' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#5b21b6', letterSpacing: 0.8, textTransform: 'uppercase' }}>
          What this is
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--fg-soft)' }}>
          Pick a destination. When your squad <strong>commits together</strong>, this lab simulates each member's
          live trip on the map — modes of travel, ETAs, congestion, and an AI-boosted <em>group sync score</em>
          so you can see how your run would unfold before you actually leave.
        </p>
      </div>

      {!committed && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Choose a destination</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                className="list-item"
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: presetId === p.id ? '2px solid #8b5cf6' : '1px solid rgba(139, 92, 246, 0.08)',
                  background: presetId === p.id ? 'rgba(139,92,246,0.06)' : 'var(--card)'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.hint}</div>
                </div>
                {presetId === p.id && <span style={{ color: '#8b5cf6', fontWeight: 900 }}>✓</span>}
              </button>
            ))}
          </div>
          <button
            className="btn"
            onClick={commit}
            style={{
              marginTop: 14,
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899, #f97316)',
              color: '#fff',
              border: 'none',
              fontWeight: 900,
              letterSpacing: 0.4,
              boxShadow: '0 10px 22px rgba(139, 92, 246, 0.35)'
            }}
          >
            🚀 Commit squad to {preset.label}
          </button>
        </div>
      )}

      {committed && (
        <>
          <div className="card sim-banner">
            <div className="sim-banner-head">
              <span className="sim-pill">🤖 AI COACH</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Updated live</span>
            </div>
            <div className="sim-banner-grid">
              <Stat label="Sync score"   value={`${stats?.syncScore ?? 0}`}  suffix="/100" tone={(stats?.syncScore ?? 0) > 70 ? 'good' : (stats?.syncScore ?? 0) > 40 ? 'warn' : 'bad'} />
              <Stat label="Confidence"   value={`${Math.round((stats?.avgConfidence ?? 0) * 100)}`} suffix="%" tone="good" />
              <Stat label="Avg congestion" value={`${Math.round((stats?.avgCongestion ?? 0) * 100)}`} suffix="%" tone={(stats?.avgCongestion ?? 0) > 0.4 ? 'warn' : 'good'} />
              <Stat label="Arrived"      value={`${stats?.arrived ?? 0}`}    suffix={`/${stats?.total ?? 0}`} tone={stats && stats.arrived === stats.total ? 'good' : undefined} />
              <Stat label="Last ETA"     value={formatEta(stats?.maxEta ?? 0)} tone="info" />
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="sim-map-wrap">
              <SimMap members={members} preset={preset} />
              <div className="sim-controls">
                <button className="chip" onClick={() => setPaused(p => !p)}>{paused ? '▶ Resume' : '⏸ Pause'}</button>
                <button className="chip" onClick={reset}>↻ New run</button>
                <label className="sim-speed">
                  <span>Speed</span>
                  <input
                    type="range" min={1} max={20} step={1}
                    value={speedX}
                    onChange={e => setSpeedX(Number(e.target.value))}
                  />
                  <span style={{ fontWeight: 800 }}>{speedX}×</span>
                </label>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Squad telemetry</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {members.map(m => <MemberRow key={m.uid} m={m} />)}
            </div>
          </div>

          <div className="card sim-log">
            <h2 style={{ marginTop: 0 }}>Live commentary</h2>
            {log.length === 0 && <div className="empty">Stand by — AI is listening to the squad…</div>}
            {log.map((entry, i) => (
              <div key={i} className="sim-log-row">
                <span className="sim-log-dot" style={{ background: entry.color }} />
                <strong style={{ color: entry.color }}>{entry.who}</strong>
                <span style={{ flex: 1 }}>{entry.text}</span>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                  {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <p style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
        Simulation is fully on-device. Nothing is uploaded. <Link to="/squads">Back to Squads →</Link>
      </p>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function Stat({
  label, value, suffix, tone
}: { label: string; value: string; suffix?: string; tone?: 'good' | 'warn' | 'bad' | 'info' }) {
  const color = tone === 'good' ? '#22c55e'
    : tone === 'warn' ? '#f97316'
    : tone === 'bad' ? '#ef4444'
    : tone === 'info' ? '#0ea5e9'
    : 'var(--fg)';
  return (
    <div className="sim-stat">
      <div className="sim-stat-label">{label}</div>
      <div className="sim-stat-value" style={{ color }}>
        {value}{suffix && <span className="sim-stat-suffix">{suffix}</span>}
      </div>
    </div>
  );
}

function MemberRow({ m }: { m: SimMember }) {
  const meta = MODE_META[m.mode];
  const pct = Math.round(m.t * 100);
  return (
    <div className="sim-row">
      <div className="sim-row-head">
        <div className="sim-avatar" style={{ background: m.color }}>{m.name[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong>{m.name}</strong>
            <span className="pill" style={{ background: m.color, color: '#fff', fontSize: 10 }}>
              {meta.icon} {meta.label}
            </span>
            {m.status === 'arrived' && <span className="pill good" style={{ fontSize: 10 }}>Arrived ✓</span>}
            {m.status === 'queued' && <span className="pill" style={{ fontSize: 10 }}>Queued…</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {m.totalDistanceMi.toFixed(2)} mi · {Math.round(m.speedMph)} mph · ETA {formatEta(m.remainingSec)}
          </div>
        </div>
      </div>
      <div className="sim-bar">
        <div className="sim-bar-fill" style={{ width: `${pct}%`, background: m.color }} />
      </div>
      <div className="sim-row-stats">
        <span title="AI confidence in current route">🧠 {Math.round(m.confidence * 100)}%</span>
        <span title="Live congestion estimate">🚦 {Math.round(m.congestion * 100)}%</span>
        <span title="Estimated fatigue">🪫 {Math.round(m.fatigue * 100)}%</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}

function SimMap({ members, preset }: { members: SimMember[]; preset: typeof PRESETS[number] }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sim-map" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="sim-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(139,92,246,0.18)" strokeWidth="1" />
        </pattern>
        <radialGradient id="sim-bg" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#0b0820" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#sim-bg)" />
      <rect width={W} height={H} fill="url(#sim-grid)" />

      {/* Stylized "roads" */}
      <path d={`M 0 ${H * 0.35} Q ${W / 2} ${H * 0.2} ${W} ${H * 0.35}`} stroke="rgba(255,255,255,0.14)" strokeWidth="3" fill="none" />
      <path d={`M 0 ${H * 0.7} Q ${W / 2} ${H * 0.55} ${W} ${H * 0.7}`} stroke="rgba(255,255,255,0.10)" strokeWidth="3" fill="none" />
      <path d={`M ${W / 2} 0 L ${W / 2} ${H}`} stroke="rgba(255,255,255,0.10)" strokeWidth="2" fill="none" />

      {/* Member trails */}
      {members.map(m => (
        <path
          key={`trail-${m.uid}`}
          d={`M ${m.startX} ${m.startY} Q ${m.cx} ${m.cy} ${DEST[0]} ${DEST[1]}`}
          stroke={m.color}
          strokeOpacity="0.32"
          strokeWidth="2"
          strokeDasharray="4 6"
          fill="none"
        />
      ))}

      {/* Destination */}
      <g transform={`translate(${DEST[0]} ${DEST[1]})`}>
        <circle r="26" fill="rgba(249,115,22,0.18)">
          <animate attributeName="r" values="20;34;20" dur="1.8s" repeatCount="indefinite" />
        </circle>
        <circle r="14" fill="#f97316" />
        <text textAnchor="middle" y="5" fontSize="14" fill="#fff">{preset.label.split(' ')[0]}</text>
      </g>

      {/* Member markers */}
      {members.map(m => (
        <g key={`m-${m.uid}`} transform={`translate(${m.x} ${m.y})`}>
          {m.status === 'moving' && (
            <circle r="14" fill={m.color} fillOpacity="0.25">
              <animate attributeName="r" values="10;18;10" dur="1.2s" repeatCount="indefinite" />
            </circle>
          )}
          <circle r="9" fill={m.color} stroke="#fff" strokeWidth="2" />
          <text textAnchor="middle" y="3" fontSize="9" fontWeight="800" fill="#fff">
            {m.name[0]}
          </text>
          {m.status === 'arrived' && (
            <text textAnchor="middle" y="-14" fontSize="11" fill="#22c55e" fontWeight="800">✓</text>
          )}
        </g>
      ))}
    </svg>
  );
}

function formatEta(sec: number): string {
  if (sec <= 0) return '0s';
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}
