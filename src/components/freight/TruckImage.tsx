// Vector side-profile renderer for a Class 8 rig. The silhouette is chosen by
// the model's body style (long-nose / aero / vocational / cab-over / electric),
// painted in the driver's color with metallic gradients, and badged with the
// make. Being SVG it stays crisp at any size — dashboard hero or map card.
import { useId } from 'react';
import { MAKE_BY_ID, PAINT_BY_ID, findModel, type TruckSpec, type TruckModel } from '../../lib/freight/trucks';
import { TRAILER_BY_ID } from '../../lib/freight/cargo';

type Props = {
  spec: TruckSpec;
  trailerId?: string;
  showTrailer?: boolean;
  usePhoto?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
};

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(hex: string, pct: number) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(pct < 0 ? c * (1 + pct) : c + (255 - c) * pct)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const GROUND = 270;
const WHEEL_Y = 238;
const STEER_X = 345;
const DRIVE_X = [95, 165];

type Shape = {
  body: string;           // painted silhouette
  windows: string[];      // glass
  backX: number;          // rearmost painted x — trailer couples behind this
  stacks: boolean;
  airCleaner?: boolean;
  skirts?: boolean;
  visor?: string;
  grille?: { x: number; y1: number; y2: number };
  doorLine?: string;
  headlight: { cx: number; cy: number; rx: number; ry: number };
  badgeAt: { x: number; y: number; size: number };
  bumper: string;
};

function sleeperTop(m: TruckModel) {
  return m.sleeper === 'raised' ? 34 : m.sleeper === 'mid' ? 52 : m.sleeper === 'flat' ? 70 : null;
}

const fenderArch = (front: number) => `L ${front},206 L 388,206 A 43 43 0 0 0 302,206`;

function shapeFor(m: TruckModel): Shape {
  const top = sleeperTop(m);
  switch (m.style) {
    case 'longnose': {
      const sx = top === null ? 212 : m.sleeper === 'raised' ? 100 : 114;
      const sleeper = top === null ? '' :
        `M ${sx},206 L ${sx},${top + 16} Q ${sx},${top} ${sx + 16},${top} L 214,${top} L 214,206 Z `;
      return {
        body: sleeper +
          `M 212,206 L 212,66 Q 212,58 220,58 L 266,58 L 289,114 L 392,118 Q 400,119 400,128 ${fenderArch(400)} L 212,206 Z`,
        windows: [
          'M 222,68 L 262,68 L 280,110 L 222,110 Z',
          ...(top === null ? [] : [`M ${sx + 18},${top + 22} h 30 a 5 5 0 0 1 5 5 v 18 a 5 5 0 0 1 -5 5 h -30 a 5 5 0 0 1 -5 -5 v -18 a 5 5 0 0 1 5 -5 Z`]),
        ],
        backX: top === null ? 212 : sx,
        stacks: true,
        airCleaner: true,
        visor: 'M 258,54 L 296,62 L 292,66 L 262,60 Z',
        grille: { x: 393, y1: 124, y2: 200 },
        doorLine: 'M 218,66 L 262,66 L 282,112 L 282,198 L 218,198 Z',
        headlight: { cx: 394, cy: 188, rx: 6, ry: 8 },
        badgeAt: { x: 352, y: 152, size: 11 },
        bumper: 'M 386,198 L 412,198 Q 416,198 416,202 L 416,216 Q 416,220 412,220 L 386,220 Z',
      };
    }
    case 'aero': {
      const day = top === null;
      const bx = day ? 206 : 96;
      const t = day ? 54 : top!;
      const roof = day
        ? `M ${bx},206 L ${bx},64 Q ${bx},54 ${bx + 12},54 L 258,54`
        : `M ${bx},206 L ${bx},${t + 16} Q ${bx},${t} ${bx + 16},${t} L 200,${t} Q 232,${t + 4} 258,54`;
      return {
        body: `${roof} Q 268,58 274,64 L 302,118 Q 352,126 384,142 Q 400,150 400,168 ${fenderArch(400)} L ${bx},206 Z`,
        windows: [
          'M 226,66 L 266,66 L 292,116 L 226,116 Z',
          ...(day ? [] : [`M ${bx + 20},${t + 26} h 34 a 6 6 0 0 1 6 6 v 16 a 6 6 0 0 1 -6 6 h -34 a 6 6 0 0 1 -6 -6 v -16 a 6 6 0 0 1 6 -6 Z`]),
        ],
        backX: bx,
        stacks: false,
        skirts: !day,
        grille: { x: 396, y1: 156, y2: 196 },
        doorLine: 'M 220,62 L 268,62 L 296,116 L 296,198 L 220,198 Z',
        headlight: { cx: 388, cy: 158, rx: 10, ry: 5 },
        badgeAt: { x: 340, y: 168, size: 10 },
        bumper: 'M 380,192 L 404,192 Q 410,192 410,198 L 410,214 Q 410,220 404,220 L 380,220 Z',
      };
    }
    case 'vocational': {
      const sl = top === null ? '' : `M 150,206 L 150,${Math.max(top, 60) + 12} Q 150,${Math.max(top, 60)} 162,${Math.max(top, 60)} L 206,${Math.max(top, 60)} L 206,206 Z `;
      return {
        body: sl + `M 202,206 L 202,62 Q 202,54 210,54 L 260,54 L 278,110 L 394,114 Q 402,115 402,124 ${fenderArch(402)} L 202,206 Z`,
        windows: ['M 212,64 L 256,64 L 270,106 L 212,106 Z'],
        backX: top === null ? 202 : 150,
        stacks: true,
        visor: 'M 254,50 L 284,58 L 280,62 L 258,56 Z',
        grille: { x: 395, y1: 118, y2: 202 },
        doorLine: 'M 208,62 L 256,62 L 272,108 L 272,198 L 208,198 Z',
        headlight: { cx: 396, cy: 186, rx: 6, ry: 9 },
        badgeAt: { x: 340, y: 148, size: 12 },
        bumper: 'M 384,198 L 418,198 Q 422,198 422,202 L 422,222 Q 422,226 418,226 L 384,226 Z',
      };
    }
    case 'cabover': {
      const sl = top === null ? '' : `M 226,206 L 226,${top + 14} Q 226,${top} 240,${top} L 304,${top} L 304,206 Z `;
      return {
        body: sl + `M 300,206 L 300,56 Q 300,46 310,46 L 386,46 Q 398,46 398,58 L 400,206 L 388,206 A 43 43 0 0 0 302,206 Z`,
        windows: ['M 312,58 L 384,58 Q 392,58 393,66 L 395,110 L 312,110 Z'],
        backX: top === null ? 300 : 226,
        stacks: true,
        grille: { x: 396, y1: 130, y2: 196 },
        doorLine: 'M 308,54 L 360,54 L 360,198 L 308,198 Z',
        headlight: { cx: 396, cy: 182, rx: 5, ry: 9 },
        badgeAt: { x: 350, y: 140, size: 10 },
        bumper: 'M 384,196 L 410,196 Q 414,196 414,200 L 414,216 Q 414,220 410,220 L 384,220 Z',
      };
    }
    case 'electric':
    default:
      return {
        body: 'M 168,206 L 168,64 Q 170,40 196,38 L 250,38 Q 296,42 336,88 Q 376,132 394,156 Q 402,168 400,186 L 400,206 L 388,206 A 43 43 0 0 0 302,206 L 168,206 Z',
        windows: ['M 218,50 L 262,50 Q 294,56 320,92 L 334,112 L 218,112 Z'],
        backX: 168,
        stacks: false,
        skirts: true,
        doorLine: 'M 212,46 L 268,46 Q 300,54 324,90 L 338,114 L 338,198 L 212,198 Z',
        headlight: { cx: 392, cy: 164, rx: 9, ry: 3 },
        badgeAt: { x: 268, y: 160, size: 11 },
        bumper: 'M 378,194 L 402,194 Q 408,194 408,200 L 408,214 Q 408,220 402,220 L 378,220 Z',
      };
  }
}

function Wheel({ x, id, steer }: { x: number; id: string; steer?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={WHEEL_Y} r={32} fill="#15171c" />
      <circle cx={x} cy={WHEEL_Y} r={29} fill="none" stroke="#2a2d35" strokeWidth={3} />
      <circle cx={x} cy={WHEEL_Y} r={19} fill={`url(#${id}-chrome)`} stroke="#6b7280" strokeWidth={1} />
      <circle cx={x} cy={WHEEL_Y} r={steer ? 8 : 10} fill={steer ? `url(#${id}-chrome)` : '#9ca3af'} stroke="#4b5563" strokeWidth={1} />
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <circle key={i} cx={x + Math.cos(a) * 13.5} cy={WHEEL_Y + Math.sin(a) * 13.5} r={1.4} fill="#4b5563" />;
      })}
      {!steer && <circle cx={x} cy={WHEEL_Y} r={4} fill="#374151" />}
    </g>
  );
}

function Trailer({ id, trailerId, front }: { id: string; trailerId: string; front: number }) {
  const t = TRAILER_BY_ID[trailerId];
  const len = trailerId === 'dryvan28' ? 360 : trailerId === 'carhauler' ? 620 : 640;
  const x0 = front - len;
  const axles = [x0 + 70, x0 + 138];
  const deckY = 196;
  const open = t?.open;
  return (
    <g>
      {/* landing gear */}
      <rect x={front - 120} y={deckY + 10} width={6} height={44} fill="#4b5563" />
      <rect x={front - 128} y={deckY + 52} width={22} height={6} rx={2} fill="#374151" />
      {/* chassis */}
      <rect x={x0 + 10} y={deckY + 4} width={len - 20} height={10} fill="#2b2f37" />
      {axles.map(ax => <Wheel key={ax} x={ax} id={id} />)}
      <rect x={x0 + 2} y={deckY + 8} width={14} height={26} fill="#111827" />
      {trailerId === 'flatbed48' || trailerId === 'stepdeck53' ? (
        <g>
          {trailerId === 'stepdeck53' ? (
            <>
              <rect x={front - 150} y={deckY - 26} width={150} height={14} fill="#6b7280" />
              <rect x={front - 162} y={deckY - 26} width={14} height={30} fill="#4b5563" />
              <rect x={x0} y={deckY - 8} width={len - 160} height={14} fill="#6b7280" />
            </>
          ) : (
            <rect x={x0} y={deckY - 10} width={len} height={16} fill="#6b7280" />
          )}
          <rect x={x0} y={deckY - 12} width={len} height={3} fill="#9ca3af" opacity={0.6} />
          {Array.from({ length: 12 }).map((_, i) => (
            <rect key={i} x={x0 + 20 + i * (len - 40) / 11} y={deckY - 6} width={3} height={10} fill="#374151" />
          ))}
        </g>
      ) : trailerId === 'carhauler' ? (
        <g>
          <rect x={x0} y={deckY - 8} width={len} height={10} fill="#4b5563" />
          <rect x={x0 + 10} y={110} width={len - 30} height={8} fill="#6b7280" />
          {Array.from({ length: 8 }).map((_, i) => (
            <rect key={i} x={x0 + 14 + i * (len - 40) / 7} y={110} width={6} height={86} fill="#4b5563" />
          ))}
          {[0, 1, 2, 3].map(i => (
            <g key={i} transform={`translate(${x0 + 30 + i * 150}, 0)`}>
              <path d="M 0,186 L 6,166 Q 20,154 46,152 L 86,152 Q 104,154 118,170 L 124,186 Z" fill={['#ef4444', '#3b82f6', '#e5e7eb', '#111827'][i]} />
              <path d="M 0,100 L 6,80 Q 20,68 46,66 L 86,66 Q 104,68 118,84 L 124,100 Z" fill={['#a3a3a3', '#f59e0b', '#16a34a', '#7c3aed'][i]} />
              <circle cx={24} cy={188} r={8} fill="#111" /><circle cx={100} cy={188} r={8} fill="#111" />
              <circle cx={24} cy={102} r={8} fill="#111" /><circle cx={100} cy={102} r={8} fill="#111" />
            </g>
          ))}
        </g>
      ) : (
        <g>
          {trailerId === 'conestoga53' ? (
            <path d={`M ${x0},${deckY} L ${x0},50 Q ${x0},34 ${x0 + 16},34 L ${front - 16},34 Q ${front},34 ${front},50 L ${front},${deckY} Z`} fill="#cbd5e1" stroke="#94a3b8" />
          ) : (
            <rect x={x0} y={30} width={len} height={deckY - 28} rx={4} fill={`url(#${id}-van)`} stroke="#9aa3af" strokeWidth={1} />
          )}
          {Array.from({ length: Math.floor(len / 26) }).map((_, i) => (
            <line key={i} x1={x0 + 13 + i * 26} y1={trailerId === 'conestoga53' ? 38 : 34} x2={x0 + 13 + i * 26} y2={deckY - 2} stroke={trailerId === 'conestoga53' ? '#94a3b8' : '#d1d5db'} strokeWidth={1.2} />
          ))}
          {trailerId === 'reefer53' && (
            <g>
              <rect x={front - 2} y={52} width={16} height={86} rx={3} fill="#e5e7eb" stroke="#9ca3af" />
              {Array.from({ length: 6 }).map((_, i) => <rect key={i} x={front + 1} y={58 + i * 13} width={10} height={6} fill="#6b7280" />)}
            </g>
          )}
          {/* SquadREN livery */}
          <g opacity={trailerId === 'conestoga53' ? 0.65 : 1}>
            <rect x={x0 + len * 0.18} y={88} width={len * 0.64} height={58} rx={29} fill="url(#brand-grad)" opacity={0.95} />
            <text x={x0 + len * 0.5} y={126} textAnchor="middle" fontFamily="Inter, Nunito, Arial, sans-serif" fontWeight={900} fontSize={30} fill="#fff" letterSpacing={2}>SQUADREN</text>
            <text x={x0 + len * 0.5} y={166} textAnchor="middle" fontFamily="Inter, Nunito, Arial, sans-serif" fontWeight={700} fontSize={11} fill="#475569" letterSpacing={3}>NATIONWIDE SHARED-SPACE FREIGHT</text>
          </g>
          <rect x={x0} y={deckY - 4} width={len} height={6} fill="#c8102e" opacity={0.8} />
        </g>
      )}
      {/* mud flap */}
      <rect x={axles[1] + 38} y={deckY + 14} width={8} height={48} rx={2} fill="#0b0d12" />
    </g>
  );
}

export default function TruckImage({ spec, trailerId, showTrailer, usePhoto = true, className, style, title }: Props) {
  const rid = useId().replace(/:/g, '');
  if (usePhoto && spec.photoDataUrl) {
    return (
      <div className={className} style={{ ...style, overflow: 'hidden', borderRadius: 16 }}>
        <img src={spec.photoDataUrl} alt={title || 'Truck photo'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    );
  }
  const make = MAKE_BY_ID[spec.makeId];
  const model = findModel(spec) ?? { name: spec.model, style: 'aero' as const, years: [2020, 2027] as [number, number], sleeper: 'raised' as const };
  const paint = PAINT_BY_ID[spec.colorId]?.hex ?? '#1d4ed8';
  const metallic = PAINT_BY_ID[spec.colorId]?.metallic;
  const s = shapeFor(model);
  const light = luminance(paint) > 0.6;
  const trailerFront = Math.min(112, s.backX - 14);
  const vbX = showTrailer ? trailerFront - (trailerId === 'dryvan28' ? 380 : trailerId === 'carhauler' ? 640 : 660) : 20;
  const vbW = 440 - vbX;
  const badgeFill = light ? (make?.accent ?? '#111') : '#f8fafc';

  return (
    <svg
      viewBox={`${vbX} 0 ${vbW} 290`}
      className={className}
      style={style}
      role="img"
      aria-label={title || `${spec.year} ${make?.name ?? ''} ${spec.model}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={`${rid}-paint`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(paint, metallic ? 0.35 : 0.18)} />
          <stop offset="0.38" stopColor={paint} />
          <stop offset="0.62" stopColor={shade(paint, -0.12)} />
          <stop offset="1" stopColor={shade(paint, -0.42)} />
        </linearGradient>
        <linearGradient id={`${rid}-shine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#fff" stopOpacity={metallic ? 0.32 : 0.18} />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${rid}-chrome`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f9fafb" />
          <stop offset="0.35" stopColor="#9ca3af" />
          <stop offset="0.5" stopColor="#f3f4f6" />
          <stop offset="0.8" stopColor="#6b7280" />
          <stop offset="1" stopColor="#d1d5db" />
        </linearGradient>
        <linearGradient id={`${rid}-chromeV`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6b7280" />
          <stop offset="0.4" stopColor="#f9fafb" />
          <stop offset="0.7" stopColor="#9ca3af" />
          <stop offset="1" stopColor="#4b5563" />
        </linearGradient>
        <linearGradient id={`${rid}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a5c8e8" />
          <stop offset="0.4" stopColor="#1e293b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id={`${rid}-van`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e5e7eb" />
        </linearGradient>
        <linearGradient id="brand-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f97316" />
          <stop offset="1" stopColor="#ef4444" />
        </linearGradient>
        <radialGradient id={`${rid}-shadow`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.45" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${rid}-bodyclip`}><path d={s.body} /></clipPath>
      </defs>

      <ellipse cx={(vbX + 440) / 2} cy={GROUND + 2} rx={vbW / 2} ry={12} fill={`url(#${rid}-shadow)`} />

      {showTrailer && trailerId && <Trailer id={rid} trailerId={trailerId} front={trailerFront} />}

      {/* frame + fifth wheel */}
      <rect x={40} y={196} width={360} height={16} rx={3} fill="#1f232b" />
      <rect x={100} y={188} width={72} height={9} rx={2} fill="#30353f" />
      {s.stacks && (
        <g>
          <rect x={s.backX - 12} y={14} width={9} height={186} rx={3} fill={`url(#${rid}-chromeV)`} />
          <rect x={s.backX - 14} y={10} width={13} height={10} rx={2} fill="#4b5563" />
        </g>
      )}

      {/* drive wheels + mud flap */}
      {DRIVE_X.map(x => <Wheel key={x} x={x} id={rid} />)}
      <rect x={38} y={206} width={8} height={54} rx={2} fill="#0b0d12" />

      {/* painted body */}
      <path d={s.body} fill={`url(#${rid}-paint)`} stroke={shade(paint, -0.5)} strokeWidth={1.2} />
      <g clipPath={`url(#${rid}-bodyclip)`}>
        <rect x={vbX} y={0} width={vbW} height={290} fill={`url(#${rid}-shine)`} transform="skewX(-25)" />
        <rect x={0} y={170} width={440} height={4} fill={shade(paint, -0.35)} opacity={0.6} />
        <rect x={0} y={176} width={440} height={2} fill="#fff" opacity={0.25} />
      </g>
      {s.doorLine && <path d={s.doorLine} fill="none" stroke={shade(paint, -0.45)} strokeWidth={1.2} opacity={0.8} />}
      {s.windows.map((w, i) => <path key={i} d={w} fill={`url(#${rid}-glass)`} stroke="#0b0d12" strokeWidth={1.4} />)}
      {s.visor && <path d={s.visor} fill="#0f172a" />}
      {s.grille && (
        <g>
          <rect x={s.grille.x} y={s.grille.y1} width={8} height={s.grille.y2 - s.grille.y1} rx={2} fill={`url(#${rid}-chromeV)`} />
          {Array.from({ length: Math.floor((s.grille.y2 - s.grille.y1) / 7) }).map((_, i) => (
            <line key={i} x1={s.grille!.x} x2={s.grille!.x + 8} y1={s.grille!.y1 + 4 + i * 7} y2={s.grille!.y1 + 4 + i * 7} stroke="#374151" strokeWidth={1} />
          ))}
        </g>
      )}
      {s.airCleaner && (
        <g>
          <rect x={291} y={130} width={17} height={56} rx={8} fill={`url(#${rid}-chromeV)`} stroke="#6b7280" />
          <rect x={291} y={150} width={17} height={3} fill="#4b5563" />
        </g>
      )}
      {s.skirts && <path d="M 182,198 L 300,198 L 300,226 Q 300,232 294,232 L 188,232 Q 182,232 182,226 Z" fill={shade(paint, -0.2)} stroke={shade(paint, -0.5)} />}

      {/* fuel tank + steps */}
      <rect x={214} y={194} width={70} height={32} rx={14} fill={`url(#${rid}-chrome)`} stroke="#6b7280" opacity={s.skirts ? 0 : 1} />
      <rect x={232} y={226} width={30} height={5} rx={1.5} fill="#1f2937" />

      {/* mirror */}
      <rect x={s.badgeAt.x - 60 > 280 ? 292 : 284} y={70} width={6} height={36} rx={2} fill="#111827" />
      <line x1={278} y1={88} x2={287} y2={88} stroke="#9ca3af" strokeWidth={2} />

      <Wheel x={STEER_X} id={rid} steer />

      <path d={s.bumper} fill={`url(#${rid}-chrome)`} stroke="#6b7280" />
      <ellipse cx={s.headlight.cx} cy={s.headlight.cy} rx={s.headlight.rx} ry={s.headlight.ry} fill="#fef9c3" stroke="#a3a3a3" />
      <ellipse cx={s.headlight.cx + 1} cy={s.headlight.cy} rx={s.headlight.rx * 0.5} ry={s.headlight.ry * 0.5} fill="#fff" opacity={0.9} />
      <circle cx={s.backX + 4} cy={60} r={2.5} fill="#f59e0b" />

      {make && (
        <text x={s.badgeAt.x} y={s.badgeAt.y} textAnchor="middle" fontFamily="Inter, Arial Black, Arial, sans-serif" fontWeight={900}
          fontSize={Math.min(s.badgeAt.size, 74 / (make.badge.length * 0.78))} letterSpacing={1.2} fill={badgeFill} stroke={light ? 'none' : 'rgba(0,0,0,0.35)'} strokeWidth={0.5}>
          {make.badge}
        </text>
      )}
    </svg>
  );
}
