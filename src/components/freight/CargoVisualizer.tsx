// Top-down trailer diagram: shows the driver's advertised free space at the
// rear of the deck and packs a chosen item (car, pallets, sofa…) into it so
// shippers can *see* what fits instead of doing square-foot math.
import { useMemo, useState } from 'react';
import {
  availableDeck, checkFit, pack, whatFits, fmtFt, fmtLbs, PRESET_BY_KIND,
  type CargoSpace, type ShipItem, type ItemKind, type Placement,
} from '../../lib/freight/cargo';

const VEHICLES: ItemKind[] = ['sedan', 'suv', 'pickup', 'motorcycle', 'atv', 'golfcart', 'boat'];

function ItemGlyph({ p, kind, color, icon, scale }: { p: Placement; kind: ItemKind; color: string; icon: string; scale: number }) {
  const x = p.x * scale, y = p.y * scale, w = p.l * scale, h = p.w * scale;
  const pad = Math.min(w, h) * 0.06;
  const ix = x + pad, iy = y + pad, iw = w - pad * 2, ih = h - pad * 2;
  if (VEHICLES.includes(kind)) {
    // Long axis is horizontal when l >= w (vehicle points toward the cab).
    const horiz = iw >= ih;
    const L = horiz ? iw : ih, W = horiz ? ih : iw;
    const tf = horiz ? `translate(${ix},${iy})` : `translate(${ix + iw},${iy}) rotate(90)`;
    if (kind === 'motorcycle') {
      return (
        <g transform={tf}>
          <rect x={L * 0.05} y={W * 0.3} width={L * 0.9} height={W * 0.4} rx={W * 0.2} fill={color} />
          <circle cx={L * 0.12} cy={W / 2} r={W * 0.18} fill="#111" />
          <circle cx={L * 0.88} cy={W / 2} r={W * 0.18} fill="#111" />
          <rect x={L * 0.7} y={W * 0.05} width={L * 0.05} height={W * 0.9} fill="#333" />
        </g>
      );
    }
    const wheelW = L * 0.14, wheelH = W * 0.12;
    return (
      <g transform={tf}>
        {[0.16, 0.8].map(f => (
          <g key={f}>
            <rect x={L * f - wheelW / 2} y={-wheelH * 0.15} width={wheelW} height={wheelH} rx={2} fill="#0b0b0b" />
            <rect x={L * f - wheelW / 2} y={W - wheelH * 0.85} width={wheelW} height={wheelH} rx={2} fill="#0b0b0b" />
          </g>
        ))}
        <rect x={0} y={W * 0.04} width={L} height={W * 0.92} rx={W * 0.32} fill={color} stroke="rgba(0,0,0,.35)" />
        {kind === 'pickup' ? (
          <>
            <rect x={L * 0.08} y={W * 0.16} width={L * 0.4} height={W * 0.68} rx={3} fill="rgba(0,0,0,.25)" />
            <rect x={L * 0.52} y={W * 0.16} width={L * 0.12} height={W * 0.68} rx={3} fill="#0f172a" opacity={0.85} />
          </>
        ) : kind === 'boat' ? (
          <path d={`M 0,${W / 2} Q ${L * 0.15},0 ${L * 0.5},${W * 0.06} L ${L},${W * 0.1} L ${L},${W * 0.9} L ${L * 0.5},${W * 0.94} Q ${L * 0.15},${W} 0,${W / 2} Z`} fill="#f8fafc" stroke="#0891b2" />
        ) : (
          <>
            <rect x={L * 0.24} y={W * 0.16} width={L * 0.12} height={W * 0.68} rx={4} fill="#0f172a" opacity={0.85} />
            <rect x={L * 0.36} y={W * 0.18} width={L * 0.3} height={W * 0.64} rx={5} fill="rgba(255,255,255,.18)" />
            <rect x={L * 0.66} y={W * 0.16} width={L * 0.14} height={W * 0.68} rx={4} fill="#0f172a" opacity={0.85} />
          </>
        )}
        <rect x={L * 0.95} y={W * 0.18} width={L * 0.04} height={W * 0.16} rx={1} fill="#fde68a" />
        <rect x={L * 0.95} y={W * 0.66} width={L * 0.04} height={W * 0.16} rx={1} fill="#fde68a" />
      </g>
    );
  }
  return (
    <g>
      <rect x={ix} y={iy} width={iw} height={ih} rx={Math.min(iw, ih) * 0.12} fill={color} stroke="rgba(0,0,0,.35)" />
      {kind === 'pallet' && Array.from({ length: 3 }).map((_, i) => (
        <rect key={i} x={ix + iw * 0.08} y={iy + ih * (0.15 + i * 0.3)} width={iw * 0.84} height={ih * 0.12} fill="rgba(0,0,0,.18)" />
      ))}
      <text x={ix + iw / 2} y={iy + ih / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(8, Math.min(iw, ih) * 0.55)}>{icon}</text>
    </g>
  );
}

type Props = {
  cargo: CargoSpace;
  item?: ShipItem | null;
  bookedSqft?: number;      // shown as greyed "already booked" region
  compact?: boolean;
  gallery?: boolean;        // show the "what fits" chooser
};

export default function CargoVisualizer({ cargo, item, bookedSqft = 0, compact, gallery = true }: Props) {
  const deck = availableDeck(cargo);
  const t = deck.trailer;
  const options = useMemo(() => whatFits(cargo), [cargo.trailerId, cargo.sqft, cargo.maxWeight]);
  const defaultKind = (options.find(o => o.preset.kind === 'sedan' && o.count > 0) ?? options.find(o => o.count > 0) ?? options[0]).preset.kind;
  const [previewKind, setPreviewKind] = useState<ItemKind>(defaultKind);

  const preset = PRESET_BY_KIND[previewKind];
  const showing: ShipItem | null = item ?? (preset ? { ...preset, qty: Math.max(1, options.find(o => o.preset.kind === previewKind)?.count ?? 1) } : null);
  const fit = item ? checkFit(cargo, item) : null;
  const placements = useMemo(() => {
    if (!showing) return [];
    if (fit) return fit.placements;
    return pack(deck, showing, showing.qty).placements;
  }, [showing?.kind, showing?.length, showing?.width, showing?.qty, deck.length, deck.width, fit?.placements.length]);

  const W = 720;
  const pxPerFt = (W - 70) / t.length;
  const deckH = t.width * pxPerFt;
  const H = deckH + 58;
  const availPx = deck.length * pxPerFt;
  const bookedPx = Math.min(t.length * pxPerFt - availPx, (bookedSqft / t.width) * pxPerFt);
  const x0 = 52;                                     // deck starts after the cab stub
  const availX = x0 + t.length * pxPerFt - availPx;  // free space at the rear (right)
  const layersUsed = placements.reduce((m, p) => Math.max(m, p.layer + 1), 0);
  const floorPlacements = placements.filter(p => p.layer === 0);
  const color = showing ? (PRESET_BY_KIND[showing.kind]?.color ?? '#f97316') : '#f97316';
  const icon = showing ? (PRESET_BY_KIND[showing.kind]?.icon ?? '📦') : '📦';

  return (
    <div className={`cargo-viz ${compact ? 'compact' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="cargo-svg" role="img" aria-label={`Trailer with ${deck.sqft} square feet available`}>
        <defs>
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#334155" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#475569" strokeWidth="3" />
          </pattern>
          <pattern id="floor" width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="#1e293b" />
            <line x1="0" y1="14" x2="14" y2="14" stroke="#273449" strokeWidth="1" />
          </pattern>
        </defs>
        {/* cab stub */}
        <rect x={6} y={20 + deckH * 0.12} width={40} height={deckH * 0.76} rx={10} fill="#64748b" />
        <rect x={12} y={20 + deckH * 0.2} width={12} height={deckH * 0.6} rx={4} fill="#0f172a" />
        <text x={26} y={14} textAnchor="middle" fontSize={10} fill="var(--muted)" fontWeight={700}>CAB</text>
        {/* deck */}
        <rect x={x0} y={20} width={t.length * pxPerFt} height={deckH} rx={6} fill="url(#hatch)" stroke={t.open ? '#64748b' : '#94a3b8'} strokeWidth={t.open ? 1 : 3} strokeDasharray={t.open ? '6 4' : undefined} />
        {bookedPx > 2 && (
          <g>
            <rect x={availX - bookedPx} y={20} width={bookedPx} height={deckH} fill="#7c2d12" opacity={0.55} />
            <text x={availX - bookedPx / 2} y={20 + deckH / 2} textAnchor="middle" dominantBaseline="central" fontSize={11} fill="#fed7aa" fontWeight={800}>BOOKED</text>
          </g>
        )}
        <rect x={availX} y={20} width={availPx} height={deckH} fill="url(#floor)" />
        <rect x={availX + 1.5} y={21.5} width={availPx - 3} height={deckH - 3} rx={4} fill="none" stroke="#22c55e" strokeWidth={2.5} strokeDasharray="8 5" />
        {availPx > 120 && availX - x0 > 60 && (
          <text x={(x0 + availX) / 2} y={20 + deckH / 2} textAnchor="middle" dominantBaseline="central" fontSize={11} fill="#94a3b8" fontWeight={800} letterSpacing={1}>DRIVER'S LOAD</text>
        )}
        {/* items */}
        {/* packed from the rear doors toward the cab */}
        {floorPlacements.map((p, i) => (
          <g key={i} transform={`translate(${availX + availPx - (p.x + p.l) * pxPerFt},20)`}>
            <ItemGlyph p={{ ...p, x: 0 }} kind={showing!.kind} color={color} icon={icon} scale={pxPerFt} />
            {layersUsed > 1 && placements.some(q => q.layer > 0 && q.x === p.x && q.y === p.y) && (
              <text x={p.l * pxPerFt - 6} y={p.y * pxPerFt + 12} textAnchor="end" fontSize={10} fontWeight={900} fill="#fff">
                ×{placements.filter(q => q.x === p.x && q.y === p.y).length}
              </text>
            )}
          </g>
        ))}
        {/* rear doors */}
        <rect x={x0 + t.length * pxPerFt - 4} y={20} width={6} height={deckH} fill="#e2e8f0" opacity={0.6} />
        {/* dimension lines */}
        <g fontSize={11} fontWeight={800} fill="#22c55e">
          <line x1={availX} y1={deckH + 34} x2={availX + availPx} y2={deckH + 34} stroke="#22c55e" strokeWidth={1.5} />
          <line x1={availX} y1={deckH + 28} x2={availX} y2={deckH + 40} stroke="#22c55e" strokeWidth={1.5} />
          <line x1={availX + availPx} y1={deckH + 28} x2={availX + availPx} y2={deckH + 40} stroke="#22c55e" strokeWidth={1.5} />
          <text x={availX + availPx / 2} y={deckH + 52} textAnchor="middle">{fmtFt(deck.length)} × {fmtFt(deck.width)} · {Math.round(deck.sqft)} sq ft free</text>
        </g>
        <text x={x0 + 4} y={deckH + 52} fontSize={11} fill="var(--muted)" fontWeight={700}>{t.name} · {fmtFt(t.height)} clearance</text>
      </svg>

      <div className="cargo-legend">
        {showing && (
          <span className="cargo-pill" style={{ borderColor: color }}>
            {icon} {placements.length} × {showing.name}
            {layersUsed > 1 && <em> · stacked {layersUsed} high</em>}
          </span>
        )}
        <span className="cargo-pill muted">⚖️ {fmtLbs(deck.maxWeight)} payload free</span>
        {fit && (
          <span className={`cargo-pill ${fit.fits ? 'good' : 'bad'}`}>
            {fit.fits ? `✅ Fits — uses ${Math.round(fit.pctFloor * 100)}% of the space` : `❌ ${fit.reasons[0]}`}
          </span>
        )}
      </div>

      {gallery && !item && (
        <div className="fits-grid">
          {options.map(o => (
            <button key={o.preset.kind} type="button"
              className={`fits-tile ${o.preset.kind === previewKind ? 'active' : ''} ${o.count === 0 ? 'none' : ''}`}
              onClick={() => setPreviewKind(o.preset.kind)}>
              <span className="fits-icon">{o.preset.icon}</span>
              <span className="fits-count">{o.count > 0 ? `×${o.count}` : '—'}</span>
              <span className="fits-name">{o.preset.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
