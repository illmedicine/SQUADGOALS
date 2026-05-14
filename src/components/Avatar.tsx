import type { AvatarConfig } from '../lib/AuthContext';

// Toca-style cartoon avatar built from layered SVG. Pure SVG so it scales
// crisp at any size (map markers, profile bubble, customization screen).
// Optional config fields fall back to sensible defaults so older saved
// avatars keep working.
type Props = {
  config: AvatarConfig;
  size?: number;
  showBackground?: boolean;
  headOnly?: boolean;
};

export default function Avatar({ config, size = 140, showBackground = false, headOnly = false }: Props) {
  const skin = config.skin;
  const hair = config.hair;
  const shirt = config.shirt;
  const accessory = config.accessory;
  const body = config.body || 'neutral';
  const hairStyle = config.hairStyle || 'short';
  const eyes = config.eyes || '#1a1a1a';
  const pants = config.pants || '#1e293b';
  const shoes = config.shoes || '#0f172a';
  const background = config.background || '#fef3c7';

  const shoulders = body === 'masc' ? 96 : body === 'fem' ? 72 : 84;
  const hips = body === 'fem' ? 74 : body === 'masc' ? 56 : 64;

  const viewBox = headOnly ? '20 30 160 140' : '0 0 200 260';
  const h = headOnly ? size : size * (260 / 200);

  return (
    <svg viewBox={viewBox} width={size} height={h} aria-label="avatar" xmlns="http://www.w3.org/2000/svg">
      {showBackground && (
        <rect x="0" y="0" width="200" height="260" rx="24" fill={background} />
      )}

      {!headOnly && (
        <>
          {/* legs */}
          <rect x={100 - hips / 2} y="200" width={hips / 2 - 2} height="50" rx="6" fill={pants} />
          <rect x="102" y="200" width={hips / 2 - 2} height="50" rx="6" fill={pants} />
          {/* shoes */}
          <ellipse cx={100 - hips / 4 - 1} cy="252" rx={hips / 4} ry="6" fill={shoes} />
          <ellipse cx={100 + hips / 4 + 1} cy="252" rx={hips / 4} ry="6" fill={shoes} />
          {/* torso / shirt */}
          <path
            d={`M${100 - shoulders / 2},155 Q100,140 ${100 + shoulders / 2},155 L${100 + hips / 2 + 4},205 Q100,215 ${100 - hips / 2 - 4},205 Z`}
            fill={shirt}
          />
          {/* neck */}
          <rect x="90" y="138" width="20" height="18" fill={skin} />
        </>
      )}

      {/* head */}
      <circle cx="100" cy="100" r="52" fill={skin} />
      {/* ears */}
      <ellipse cx="48" cy="102" rx="6" ry="9" fill={skin} />
      <ellipse cx="152" cy="102" rx="6" ry="9" fill={skin} />

      {/* hair */}
      {hairStyle !== 'bald' && <HairLayer style={hairStyle} color={hair} />}

      {/* eyes */}
      <circle cx="82" cy="104" r="5.5" fill={eyes} />
      <circle cx="118" cy="104" r="5.5" fill={eyes} />
      <circle cx="84" cy="102" r="1.8" fill="#fff" />
      <circle cx="120" cy="102" r="1.8" fill="#fff" />

      {/* cheeks */}
      <circle cx="72" cy="120" r="6" fill="rgba(255,120,150,0.45)" />
      <circle cx="128" cy="120" r="6" fill="rgba(255,120,150,0.45)" />

      {/* smile */}
      <path d="M85,126 Q100,140 115,126" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* accessories */}
      {accessory === 'glasses' && (
        <g stroke="#1a1a1a" strokeWidth="3" fill="none">
          <circle cx="82" cy="104" r="11" />
          <circle cx="118" cy="104" r="11" />
          <line x1="93" y1="104" x2="107" y2="104" />
        </g>
      )}
      {accessory === 'sunglasses' && (
        <g fill="#1a1a1a">
          <rect x="69" y="96" width="26" height="14" rx="3" />
          <rect x="105" y="96" width="26" height="14" rx="3" />
          <rect x="95" y="101" width="10" height="3" />
        </g>
      )}
      {accessory === 'hat' && (
        <g>
          <rect x="48" y="68" width="104" height="9" rx="2" fill="#1a1a1a" />
          <rect x="63" y="38" width="74" height="34" rx="6" fill="#1a1a1a" />
        </g>
      )}
      {accessory === 'beanie' && (
        <g>
          <path d="M55,78 Q55,38 100,38 Q145,38 145,78 Z" fill="#ec4899" />
          <rect x="55" y="74" width="90" height="10" fill="#be185d" />
        </g>
      )}
      {accessory === 'headphones' && (
        <g>
          <path d="M48,98 a52,52 0 0 1 104,0" fill="none" stroke="#1a1a1a" strokeWidth="7" />
          <rect x="40" y="96" width="14" height="22" rx="4" fill="#1a1a1a" />
          <rect x="146" y="96" width="14" height="22" rx="4" fill="#1a1a1a" />
        </g>
      )}
      {accessory === 'earrings' && (
        <g fill="#fbbf24">
          <circle cx="48" cy="116" r="3.5" />
          <circle cx="152" cy="116" r="3.5" />
        </g>
      )}
      {accessory === 'mask' && (
        <path d="M65,118 Q100,108 135,118 L135,138 Q100,150 65,138 Z" fill="#22d3ee" stroke="#0e7490" strokeWidth="1.5" />
      )}
    </svg>
  );
}

function HairLayer({ style, color }: { style: string; color: string }) {
  switch (style) {
    case 'long':
      return (
        <g fill={color}>
          <path d="M48,100 Q40,180 70,210 L70,150 Z" />
          <path d="M152,100 Q160,180 130,210 L130,150 Z" />
          <path d="M48,98 C48,55 152,55 152,98 C152,80 130,68 100,68 C70,68 48,80 48,98 Z" />
        </g>
      );
    case 'bun':
      return (
        <g fill={color}>
          <circle cx="100" cy="42" r="18" />
          <path d="M50,92 C50,60 150,60 150,92 C150,78 128,68 100,68 C72,68 50,78 50,92 Z" />
        </g>
      );
    case 'curly':
      return (
        <g fill={color}>
          <circle cx="62" cy="74" r="14" />
          <circle cx="80" cy="60" r="14" />
          <circle cx="100" cy="55" r="15" />
          <circle cx="120" cy="60" r="14" />
          <circle cx="138" cy="74" r="14" />
          <circle cx="55" cy="88" r="12" />
          <circle cx="145" cy="88" r="12" />
        </g>
      );
    case 'mohawk':
      return (
        <g fill={color}>
          <path d="M70,90 Q70,55 100,38 Q130,55 130,90 Z" />
          <path d="M52,98 C52,86 70,82 70,90 L70,98 Z" opacity="0.55" />
          <path d="M148,98 C148,86 130,82 130,90 L130,98 Z" opacity="0.55" />
        </g>
      );
    case 'ponytail':
      return (
        <g fill={color}>
          <path d="M150,90 Q175,130 162,180 Q150,160 148,120 Z" />
          <path d="M48,95 C48,55 152,55 152,95 C152,80 130,68 100,68 C70,68 48,80 48,95 Z" />
        </g>
      );
    case 'buzz':
      return <path d="M52,95 Q100,55 148,95 Q148,82 100,62 Q52,82 52,95 Z" fill={color} opacity="0.6" />;
    case 'short':
    default:
      return (
        <path d="M48,95 C48,55 152,55 152,95 C152,78 128,66 100,66 C72,66 48,78 48,95 Z" fill={color} />
      );
  }
}

// Render the avatar to a data: URL — used as a Google Maps marker icon.
export function avatarToDataUrl(config: AvatarConfig): string {
  const skin = config.skin;
  const hair = config.hair;
  const eyes = config.eyes || '#1a1a1a';
  const hairStyle = config.hairStyle || 'short';
  const ring = config.shirt || '#8b5cf6';

  // Hand-rolled compact SVG for marker performance (no React render).
  const hairPath = (() => {
    switch (hairStyle) {
      case 'long':   return `<path d='M48,98 C48,55 152,55 152,98 C152,80 130,68 100,68 C70,68 48,80 48,98 Z M48,100 Q40,180 70,210 L70,150 Z M152,100 Q160,180 130,210 L130,150 Z' fill='${hair}'/>`;
      case 'bun':    return `<circle cx='100' cy='42' r='18' fill='${hair}'/><path d='M50,92 C50,60 150,60 150,92 C150,78 128,68 100,68 C72,68 50,78 50,92 Z' fill='${hair}'/>`;
      case 'curly':  return `<g fill='${hair}'><circle cx='62' cy='74' r='14'/><circle cx='80' cy='60' r='14'/><circle cx='100' cy='55' r='15'/><circle cx='120' cy='60' r='14'/><circle cx='138' cy='74' r='14'/></g>`;
      case 'mohawk': return `<path d='M70,90 Q70,55 100,38 Q130,55 130,90 Z' fill='${hair}'/>`;
      case 'ponytail': return `<path d='M150,90 Q175,130 162,180 Q150,160 148,120 Z M48,95 C48,55 152,55 152,95 C152,80 130,68 100,68 C70,68 48,80 48,95 Z' fill='${hair}'/>`;
      case 'buzz':   return `<path d='M52,95 Q100,55 148,95 Q148,82 100,62 Q52,82 52,95 Z' fill='${hair}' opacity='0.6'/>`;
      case 'bald':   return '';
      default:       return `<path d='M48,95 C48,55 152,55 152,95 C152,78 128,66 100,66 C72,66 48,78 48,95 Z' fill='${hair}'/>`;
    }
  })();

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 220' width='64' height='70'>
    <defs><filter id='s' x='-20%' y='-20%' width='140%' height='140%'><feDropShadow dx='0' dy='3' stdDeviation='4' flood-color='#000' flood-opacity='0.35'/></filter></defs>
    <g filter='url(#s)'>
      <circle cx='100' cy='105' r='86' fill='${ring}'/>
      <circle cx='100' cy='105' r='74' fill='#fff'/>
      <circle cx='100' cy='105' r='62' fill='${skin}'/>
      ${hairPath}
      <circle cx='82' cy='108' r='6' fill='${eyes}'/>
      <circle cx='118' cy='108' r='6' fill='${eyes}'/>
      <circle cx='84' cy='106' r='2' fill='#fff'/>
      <circle cx='120' cy='106' r='2' fill='#fff'/>
      <path d='M85,126 Q100,140 115,126' stroke='#1a1a1a' stroke-width='3' fill='none' stroke-linecap='round'/>
      <path d='M100,192 L88,210 L112,210 Z' fill='${ring}'/>
    </g>
  </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}
