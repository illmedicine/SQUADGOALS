import { useState } from 'react';
import { Link } from 'react-router-dom';

// First-time onboarding wizard. Two parallel tracks introduced through a
// chooser on step 1:
//   • Squad Platform users  — explore the map, join a squad, climb prestige
//   • Storefront / business owners — claim a storefront, list inventory,
//     run promo campaigns, get featured on the leaderboard
//
// The component is still exported as `TimelineTutorial` so MapPage and the
// `squadren.timelineTutorialSeen` storage key keep working — the only thing
// that changed is the content.

type Track = 'user' | 'vendor';

type Step = {
  icon: string;
  title: string;
  body: React.ReactNode;
};

const USER_STEPS: Step[] = [
  {
    icon: '👋',
    title: 'Welcome to Squad REN',
    body: (
      <>
        <p>
          Squad REN is the <strong>live-presence social map</strong> — see who's around,
          rally your crew, and earn prestige for the places you actually go.
        </p>
        <ul>
          <li>🗺️ A real-time map of squad-mates, public pins, and reviews near you</li>
          <li>👥 Squads with shared XP, trips, leaderboards, and squad-only chat</li>
          <li>🏆 7 prestige tiers, 16 badges, avatar accessories you unlock by exploring</li>
          <li>🛍️ A built-in marketplace of local storefronts run by other squadders</li>
        </ul>
        <p className="muted small">This walkthrough takes about a minute.</p>
      </>
    )
  },
  {
    icon: '🙂',
    title: 'Step 1 — Build your avatar',
    body: (
      <>
        <p>
          Your avatar is what other squadders see on the map and on the leaderboard.
        </p>
        <ol>
          <li>Tap the <strong>Profile</strong> tab → <strong>Edit Avatar</strong>.</li>
          <li>Pick your character, outfit, and accessories.</li>
          <li>Set a short display name — this is your identity across squads.</li>
        </ol>
        <p className="muted small">
          As you earn prestige you'll unlock crowns, halos, 🔥 flame, and ✨ cosmic auras automatically.
        </p>
      </>
    )
  },
  {
    icon: '📍',
    title: 'Step 2 — Go live on the map',
    body: (
      <>
        <p>The map is the heart of Squad REN.</p>
        <ol>
          <li>Open the <strong>Map</strong> tab.</li>
          <li>
            Toggle <strong>Sharing</strong> in the top card so your squad sees you live.
            Flip <strong>Public</strong> if you also want to show up on the world map.
          </li>
          <li>
            Tap any pin to read reviews, leave a comment, or send a{' '}
            <span className="chip-inline">👋 Wave</span> — a Bump-style hello with an optional note.
          </li>
          <li>Drop your own pin with the <span className="chip-inline">＋</span> button to log a place + review.</li>
        </ol>
      </>
    )
  },
  {
    icon: '👥',
    title: 'Step 3 — Join or start a squad',
    body: (
      <>
        <p>Squads turn solo travel into a team sport.</p>
        <ol>
          <li>Tap the <strong>Squads</strong> tab to browse public squads near you.</li>
          <li>Hit <strong>Join</strong> on any squad that matches your vibe — or scroll to the bottom to start your own.</li>
          <li>Once you're in, you'll see your squad-mates on the map, share trips, and stack squad XP together.</li>
        </ol>
        <p className="muted small">
          Squads can be public, invite-only, or tied to a city/tag like <em>#brooklyn-coffee</em>.
        </p>
      </>
    )
  },
  {
    icon: '🏆',
    title: 'Step 4 — Earn prestige & badges',
    body: (
      <>
        <p>Every check-in, review, and public pin adds XP toward your next tier.</p>
        <ul>
          <li>🥉 <strong>Rookie → Mythic</strong> — 7 tiers of prestige</li>
          <li>🎖️ 16 badges across check-ins, pins, reviews, and squad proximity</li>
          <li>👑 Avatar accessories unlock as you climb</li>
          <li>🏆 Climb the leaderboard globally, near you, or by interest tag</li>
        </ul>
        <p className="muted small">
          Bonus XP fires the first time anyone in the Squad REN world logs a brand-new place.
        </p>
      </>
    )
  },
  {
    icon: '🛍️',
    title: "Step 5 — Shop the marketplace",
    body: (
      <>
        <p>
          Real local businesses run their storefronts inside Squad REN. Find them
          under the <strong>Leaderboard</strong> tab → <strong>Newest Storefronts</strong>{' '}
          or tap any vendor pin on the map.
        </p>
        <ul>
          <li>Browse inventory, prices, and photos right in the app</li>
          <li>Look for the 🌟 <strong>Founding Vendor</strong> rainbow glow — that's a charter-class business</li>
          <li>Many storefronts post a <em>squad-only offer</em> for the week</li>
        </ul>
        <p className="muted small">
          Own a business yourself? Pick <strong>← Back</strong> on step 1 and choose
          <em> "I run a storefront"</em> for the vendor walkthrough.
        </p>
      </>
    )
  }
];

const VENDOR_STEPS: Step[] = [
  {
    icon: '🛍️',
    title: 'Welcome, vendor',
    body: (
      <>
        <p>
          Squad REN lets you run a real online storefront inside the same app your
          customers already use to discover places.
        </p>
        <ul>
          <li>📸 Cover photo, logo, inventory with photos & prices</li>
          <li>📍 Your city &amp; state, hours, contact info, website + Instagram</li>
          <li>🎟️ Promo codes that unlock prestige perks (rainbow glow, animated avatar, Founding Vendor badge)</li>
          <li>🔔 Every Squad REN user gets a popup the moment you publish</li>
          <li>🏆 Newest storefronts get a featured spot on the global leaderboard</li>
        </ul>
        <p className="muted small">Setup takes about 5 minutes.</p>
      </>
    )
  },
  {
    icon: '🪪',
    title: 'Step 1 — Claim your storefront',
    body: (
      <>
        <p>Every Squad REN account can own one storefront.</p>
        <ol>
          <li>From the <strong>Profile</strong> tab tap{' '}
            <span className="chip-inline">🛍️ Manage Storefront</span> — or open{' '}
            <Link to="/storefront"><code>/storefront</code></Link> directly.</li>
          <li>Pick a <strong>type</strong>: business, service, creator, venue, or personal page.</li>
          <li>Enter your <strong>brand name</strong>, a one-line <strong>tagline</strong>, and a short <strong>about</strong> blurb.</li>
        </ol>
      </>
    )
  },
  {
    icon: '📸',
    title: 'Step 2 — Add cover, logo & location',
    body: (
      <>
        <p>Make your storefront look like a real shopfront.</p>
        <ol>
          <li>Tap the cover area → upload a wide hero photo (storefront, product hero shot, team).</li>
          <li>Tap the logo circle → upload a square mark or wordmark.</li>
          <li>
            Fill in <strong>city, state, country</strong> — this is what shows on the
            leaderboard and on the &ldquo;new storefront&rdquo; popup that every user receives.
          </li>
          <li>Add <strong>hours</strong>, <strong>phone</strong>, <strong>email</strong>, <strong>website</strong>, and <strong>Instagram</strong>.</li>
        </ol>
        <p className="muted small">
          Photos are resized client-side so they fit comfortably in the user document.
        </p>
      </>
    )
  },
  {
    icon: '📦',
    title: 'Step 3 — Build your inventory',
    body: (
      <>
        <p>Inventory is what turns your storefront into a marketplace listing.</p>
        <ol>
          <li>Scroll to <strong>📦 Inventory</strong> and tap <strong>+ Add product</strong>.</li>
          <li>For each item add a <strong>name</strong>, <strong>description</strong>, <strong>price</strong>, <strong>stock</strong>, optional <strong>SKU</strong> and a product photo.</li>
          <li>Repeat for as many items as you sell — the inventory total appears in the header.</li>
        </ol>
        <p className="muted small">
          Prices are stored as numbers so they can be sorted and totaled. Use the <em>SKU</em> field
          if you sync with an external POS.
        </p>
      </>
    )
  },
  {
    icon: '🎟️',
    title: 'Step 4 — Redeem your promo code',
    body: (
      <>
        <p>
          If you came in from a Squad REN partner campaign (e.g. the Indeed hiring email)
          you have an unlock code. Apply it to make your storefront <em>pop</em>.
        </p>
        <ol>
          <li>In the <strong>🎟️ Promo code</strong> card paste your code (e.g. <code>NAILSON10</code>).</li>
          <li>Tap <strong>Redeem</strong> — your perks appear instantly:
            <ul>
              <li>🌟 <strong>Founding Vendor</strong> prestige badge</li>
              <li>🌈 Animated rainbow glow around your storefront card</li>
              <li>✨ Animated avatar aura visible everywhere you appear</li>
              <li>👗 Exclusive avatar outfit unlock (e.g. Aurora Apron + Sparkle Crown)</li>
            </ul>
          </li>
          <li>A popup goes out to every Squad REN user announcing your unlock.</li>
        </ol>
      </>
    )
  },
  {
    icon: '🚀',
    title: 'Step 5 — Publish & get featured',
    body: (
      <>
        <p>Visibility is yours to control.</p>
        <ol>
          <li>
            Pick a visibility:
            <ul>
              <li><strong>🔒 Hidden</strong> — drafts only, no one sees it</li>
              <li><strong>👥 Squad-only</strong> — visible to your squad-mates</li>
              <li><strong>🌎 Public</strong> — listed in the global marketplace</li>
            </ul>
          </li>
          <li>Tap <strong>💾 Save draft</strong> any time to checkpoint your work.</li>
          <li>
            When you're ready, tap <strong>🚀 Publish storefront</strong>. The first time you
            publish a 🎉 <em>NEW STOREFRONT JUST OPENED</em> toast pops on every Squad REN
            user's device with your city &amp; state.
          </li>
          <li>
            Your storefront appears in the <strong>🛍️ Newest Storefronts</strong> board on the{' '}
            <Link to="/leaderboard">leaderboard</Link>, newest first, with a <em>NEW</em> pill
            for the first 24 hours.
          </li>
        </ol>
        <p className="muted small">
          Tip: add a <strong>squad-only offer</strong> (e.g. "15% off any squadder this week") to
          drive walk-ins from nearby squad-mates.
        </p>
      </>
    )
  }
];

const CHOOSER_STEP: Step = {
  icon: '🎯',
  title: 'Pick your path',
  body: <></> // rendered specially with track buttons
};


export default function TimelineTutorial({ onClose }: { onClose: () => void }) {
  // Step 0 is always the chooser; once a track is picked we advance through
  // that track's steps. "Back" from step 1 of a track returns to the chooser.
  const [track, setTrack] = useState<Track | null>(null);
  const [i, setI] = useState(0);

  const steps: Step[] = track === 'user' ? USER_STEPS
    : track === 'vendor' ? VENDOR_STEPS
    : [CHOOSER_STEP];
  const step = steps[Math.min(i, steps.length - 1)];
  const last = track !== null && i === steps.length - 1;
  const isChooser = track === null;

  function pickTrack(t: Track) {
    setTrack(t);
    setI(0);
  }
  function back() {
    if (i > 0) {
      setI(i - 1);
    } else if (track !== null) {
      // Return to the chooser.
      setTrack(null);
      setI(0);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal tutorial" onClick={e => e.stopPropagation()}>
        <div className="tutorial-head">
          <div className="tutorial-icon">{step.icon}</div>
          <div className="tutorial-dots">
            {!isChooser && steps.map((_, n) => (
              <span key={n} className={'dot' + (n === i ? ' active' : n < i ? ' done' : '')} />
            ))}
            {!isChooser && (
              <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>
                {track === 'vendor' ? '🛍️ Vendor' : '👤 Squadder'}
              </span>
            )}
          </div>
        </div>
        <h2 style={{ margin: '8px 0 4px' }}>{step.title}</h2>
        <div className="tutorial-body">
          {isChooser ? (
            <>
              <p>
                Squad REN works two ways. Pick the path that fits you — you can
                always re-open this walkthrough from the Profile page.
              </p>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                <button
                  className="btn"
                  onClick={() => pickTrack('user')}
                  style={{ textAlign: 'left', padding: '14px 16px', lineHeight: 1.35 }}
                >
                  <div style={{ fontSize: 16, fontWeight: 900 }}>👤 I'm a Squad Platform user</div>
                  <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 500 }}>
                    Build my avatar, join squads, climb the leaderboard, shop local storefronts.
                  </div>
                </button>
                <button
                  className="btn storefront-cta-btn"
                  onClick={() => pickTrack('vendor')}
                  style={{ textAlign: 'left', padding: '14px 16px', lineHeight: 1.35, border: 'none' }}
                >
                  <div style={{ fontSize: 16, fontWeight: 900 }}>🛍️ I run a storefront / business</div>
                  <div style={{ fontSize: 12, opacity: 0.95, fontWeight: 600 }}>
                    Claim my storefront, list inventory, redeem a promo code, get featured.
                  </div>
                </button>
              </div>
              <p className="muted small" style={{ marginTop: 12 }}>
                Have a code like <code>NAILSON10</code>? Pick the vendor path — step 4 is where you redeem it.
              </p>
            </>
          ) : step.body}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          {!isChooser && (
            <button className="btn secondary" onClick={back} style={{ flex: 1 }}>
              ← Back
            </button>
          )}
          {isChooser ? (
            <button className="btn ghost" onClick={onClose} style={{ flex: 1 }}>
              Skip for now
            </button>
          ) : !last ? (
            <button className="btn" onClick={() => setI(i + 1)} style={{ flex: 2 }}>Next →</button>
          ) : (
            <button className="btn" onClick={onClose} style={{ flex: 2 }}>
              {track === 'vendor' ? '🚀 Open my storefront' : "Got it — let's go!"}
            </button>
          )}
        </div>
        <button className="tutorial-skip" onClick={onClose}>Skip</button>
      </div>
    </div>
  );
}

