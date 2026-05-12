import type { AvatarConfig } from '../lib/AuthContext';

// SVG cartoon avatar — Toca-style minimal. Pure CSS/SVG so it scales for both
// the map markers and the customization screen.
type Props = { config: AvatarConfig; size?: number };

export default function Avatar({ config, size = 140 }: Props) {
  const { skin, hair, shirt, accessory } = config;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-label="avatar">
      {/* shirt / shoulders */}
      <ellipse cx="100" cy="195" rx="80" ry="40" fill={shirt} />
      {/* neck */}
      <rect x="88" y="135" width="24" height="20" fill={skin} />
      {/* head */}
      <circle cx="100" cy="105" r="55" fill={skin} />
      {/* hair */}
      <path d="M45,95 C45,55 155,55 155,95 C155,80 130,68 100,68 C70,68 45,80 45,95 Z" fill={hair} />
      {/* eyes */}
      <circle cx="82" cy="108" r="5" fill="#1a1a1a" />
      <circle cx="118" cy="108" r="5" fill="#1a1a1a" />
      <circle cx="84" cy="106" r="1.5" fill="#fff" />
      <circle cx="120" cy="106" r="1.5" fill="#fff" />
      {/* cheeks */}
      <circle cx="74" cy="122" r="6" fill="rgba(255,120,150,0.4)" />
      <circle cx="126" cy="122" r="6" fill="rgba(255,120,150,0.4)" />
      {/* smile */}
      <path d="M86,128 Q100,140 114,128" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* accessories */}
      {accessory === 'glasses' && (
        <g stroke="#1a1a1a" strokeWidth="3" fill="none">
          <circle cx="82" cy="108" r="11" />
          <circle cx="118" cy="108" r="11" />
          <line x1="93" y1="108" x2="107" y2="108" />
        </g>
      )}
      {accessory === 'hat' && (
        <g>
          <rect x="50" y="70" width="100" height="10" fill="#1a1a1a" />
          <rect x="65" y="40" width="70" height="35" rx="6" fill="#1a1a1a" />
        </g>
      )}
      {accessory === 'headphones' && (
        <g fill="#1a1a1a">
          <path d="M45,100 a55,55 0 0 1 110,0" fill="none" stroke="#1a1a1a" strokeWidth="6" />
          <rect x="38" y="98" width="14" height="22" rx="4" />
          <rect x="148" y="98" width="14" height="22" rx="4" />
        </g>
      )}
    </svg>
  );
}
