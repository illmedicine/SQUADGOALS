// Squad Logo Library
//
// Each squad can pick a "crest" that appears on their map marker, profile card,
// and squad list row. We ship 24 original emoji-based crests grouped by the
// prestige tier needed to unlock them. Five are available immediately; the
// rest unlock as the squad ranks up — giving teams something to chase.
//
// NOTE: We deliberately do NOT ship any trademarked / copyrighted logos
// (Wu-Tang, Hello Kitty, Louis Vuitton, Batman, etc). The categories below
// are inspired by the *vibe* of those iconic marks but use generic glyphs.

export type SquadLogo = {
  id: string;
  name: string;
  glyph: string;       // single emoji rendered as the crest
  bg: string;          // background color for badge
  tier: number;        // prestige tier required (0..6)
};

export const SQUAD_LOGOS: SquadLogo[] = [
  // ---- Tier 0: Rookie (5 starters) ----
  { id: 'star',      name: 'North Star',     glyph: '★',  bg: '#fbbf24', tier: 0 },
  { id: 'bolt',      name: 'Bolt',           glyph: '⚡', bg: '#facc15', tier: 0 },
  { id: 'flame',     name: 'Flame',          glyph: '🔥', bg: '#f97316', tier: 0 },
  { id: 'diamond',   name: 'Diamond',        glyph: '💎', bg: '#38bdf8', tier: 0 },
  { id: 'rose',      name: 'Black Rose',     glyph: '🌹', bg: '#ec4899', tier: 0 },

  // ---- Tier 1: Regular ----
  { id: 'dragon',    name: 'Dragon',         glyph: '🐉', bg: '#16a34a', tier: 1 },
  { id: 'eagle',     name: 'Eagle',          glyph: '🦅', bg: '#0ea5e9', tier: 1 },
  { id: 'swords',    name: 'Twin Blades',    glyph: '⚔️', bg: '#64748b', tier: 1 },

  // ---- Tier 2: Local ----
  { id: 'crown',     name: 'Crown',          glyph: '👑', bg: '#eab308', tier: 2 },
  { id: 'lion',      name: 'Lion',           glyph: '🦁', bg: '#d97706', tier: 2 },
  { id: 'wave',      name: 'Tidal',          glyph: '🌊', bg: '#0284c7', tier: 2 },

  // ---- Tier 3: Explorer ----
  { id: 'scorpion',  name: 'Scorpion',       glyph: '🦂', bg: '#7c2d12', tier: 3 },
  { id: 'moon',      name: 'Crescent',       glyph: '🌙', bg: '#475569', tier: 3 },
  { id: 'fleur',     name: 'Fleur',          glyph: '⚜️', bg: '#a16207', tier: 3 },

  // ---- Tier 4: Trailblazer ----
  { id: 'wolf',      name: 'Wolf',           glyph: '🐺', bg: '#374151', tier: 4 },
  { id: 'dagger',    name: 'Dagger',         glyph: '🗡️', bg: '#1e293b', tier: 4 },
  { id: 'orb',       name: 'Orb',            glyph: '🔮', bg: '#a855f7', tier: 4 },

  // ---- Tier 5: Legend ----
  { id: 'unicorn',   name: 'Unicorn',        glyph: '🦄', bg: '#f472b6', tier: 5 },
  { id: 'comet',     name: 'Comet',          glyph: '☄️', bg: '#1d4ed8', tier: 5 },
  { id: 'skull',     name: 'Skull',          glyph: '💀', bg: '#0f172a', tier: 5 },

  // ---- Tier 6: Mythic ----
  { id: 'serpent',   name: 'Serpent',        glyph: '🐲', bg: '#065f46', tier: 6 },
  { id: 'atom',      name: 'Atom',           glyph: '⚛️', bg: '#7c3aed', tier: 6 },
  { id: 'infinity',  name: 'Infinity',       glyph: '♾️', bg: '#be123c', tier: 6 }
];

export const DEFAULT_LOGO_ID = 'star';

export function getLogo(id: string | undefined | null): SquadLogo {
  return SQUAD_LOGOS.find(l => l.id === id) || SQUAD_LOGOS[0];
}

export function logosForTier(tier: number): SquadLogo[] {
  return SQUAD_LOGOS.filter(l => l.tier <= tier);
}

export function isLogoUnlocked(logoId: string, tier: number): boolean {
  const l = SQUAD_LOGOS.find(x => x.id === logoId);
  return !!l && l.tier <= tier;
}
