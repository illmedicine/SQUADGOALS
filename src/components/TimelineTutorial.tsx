import { useState } from 'react';

// Tutorial for importing Google Maps data into Squad REN. Google has
// shipped *three different* export formats in the last few years, so we
// walk users through what they'll actually see today (May 2026):
//   • Google Takeout → "Maps (your places)" → Reviews.json + Saved Places.json
//   • Google Takeout → "Saved" → CSV files for each saved list
//   • Google Maps app → on-device Timeline export → Timeline.json
//   • (legacy) Google Takeout → "Location History" → Records.json

const STEPS = [
  {
    icon: '🗺️',
    title: 'Turn your Google Maps history into XP',
    body: (
      <>
        <p>
          Squad REN reads your Google Maps export and turns every place into a
          pin on your personal map — coffee shops, parks, venues, reviews
          you've written, lists you've saved.
        </p>
        <ul>
          <li>Bank XP and climb the prestige ladder instantly</li>
          <li>Unlock the <strong>Globetrotter</strong> & <strong>Cartographer</strong> badges</li>
          <li>Keep everything private, or share specific pins with your squad</li>
        </ul>
        <p className="muted small">
          Google split Maps data across <em>three</em> different Takeout sections.
          The next steps cover all of them — pick whichever you have.
        </p>
      </>
    )
  },
  {
    icon: '⭐',
    title: 'Option A — Reviews & Saved Places (recommended)',
    body: (
      <>
        <p>This is the easiest path and works for everyone.</p>
        <ol>
          <li>
            Go to{' '}
            <a href="https://takeout.google.com/" target="_blank" rel="noreferrer">
              takeout.google.com
            </a>{' '}
            and click <strong>Deselect all</strong>.
          </li>
          <li>Scroll down and check <strong>Maps (your places)</strong>.</li>
          <li>Click <strong>Next step</strong> → leave the defaults → <strong>Create export</strong>.</li>
          <li>Wait for the email (usually a few minutes), download the ZIP, and unzip it.</li>
          <li>
            Open <code>Takeout/Maps (your places)/</code> — you'll see:
            <ul>
              <li><code>Reviews.json</code> — every review you've left with coordinates and stars ⭐</li>
              <li><code>Saved Places.json</code> — places you've starred or saved</li>
            </ul>
          </li>
          <li>Drop <strong>both files</strong> into Squad REN (step 5). You can multi-select.</li>
        </ol>
      </>
    )
  },
  {
    icon: '📋',
    title: 'Option B — Saved lists (CSV)',
    body: (
      <>
        <p>
          If you also exported the <strong>Saved</strong> section, you'll get a folder
          of CSVs — one per list (<em>Want to go</em>, <em>Favorites</em>, <em>Starred places</em>, etc.).
        </p>
        <ol>
          <li>In Takeout, also check <strong>Saved</strong> alongside Maps (your places).</li>
          <li>
            Inside <code>Takeout/Saved/</code> you'll find files like{' '}
            <code>Want to go.csv</code>, <code>Favorites.csv</code>, <code>Starred places.csv</code>.
          </li>
          <li>Select all of them when importing — Squad REN tags each pin with the list name.</li>
        </ol>
        <p className="muted small">
          We extract coordinates from the Google Maps URL in each row. A few
          obscure CIDs may not resolve; those are skipped silently.
        </p>
      </>
    )
  },
  {
    icon: '📱',
    title: 'Option C — Full Timeline (Android only)',
    body: (
      <>
        <p>
          Want every place you've been to, not just the ones you reviewed or
          saved? Use the on-device Timeline export.
        </p>
        <ol>
          <li>Open the <strong>Google Maps</strong> app on Android.</li>
          <li>Tap your profile picture → <strong>Your Timeline</strong>.</li>
          <li>Tap <strong>⋯</strong> → <strong>Location &amp; privacy settings</strong>.</li>
          <li>Scroll to <strong>Export Timeline data</strong> → save <code>Timeline.json</code>.</li>
          <li>Email / AirDrop / Drive it to this device and pick it in step 5.</li>
        </ol>
        <p className="muted small">
          Heads-up: Google removed Timeline from Takeout in mid-2024. Older
          Takeout archives may still contain <code>Records.json</code> or a
          <code> Semantic Location History/</code> folder — both are also supported.
        </p>
      </>
    )
  },
  {
    icon: '📥',
    title: 'Drop the files into Squad REN',
    body: (
      <>
        <ol>
          <li>Open the <strong>Map</strong> tab.</li>
          <li>Tap the <span className="chip-inline">📥 Import Maps</span> chip in the top card.</li>
          <li>
            Select <strong>one or many</strong> files. All formats are auto-detected:
            <ul>
              <li><code>Reviews.json</code> · <code>Saved Places.json</code></li>
              <li><code>Want to go.csv</code> · <code>Favorites.csv</code> · any saved CSV</li>
              <li><code>Timeline.json</code> · <code>Records.json</code> · Semantic Location History</li>
            </ul>
          </li>
          <li>Squad REN dedupes by location + name and imports up to 2,000 places per batch.</li>
        </ol>
        <p className="muted small">
          All imported pins start <strong>private to you</strong>. Tap any pin to
          share it with your squad, or drop a public review with the <span className="chip-inline">＋</span> button.
        </p>
      </>
    )
  },
  {
    icon: '🏆',
    title: 'Earn prestige & unlock accessories',
    body: (
      <>
        <p>Every imported place + check-in + review adds to your tier:</p>
        <ul>
          <li>🥉 <strong>Rookie → Mythic</strong> — 7 tiers of prestige</li>
          <li>👑 Unlock crown, halo, 🔥 flame, and ✨ cosmic avatar accessories</li>
          <li>🎖️ Stack 16 badges across check-ins, pins, reviews, and squad proximity</li>
          <li>🏆 Climb the <strong>Squad Leaderboard</strong> globally, near you, or by interest</li>
        </ul>
        <p className="muted small">
          Tip: turn on <strong>Sharing</strong> in the map header so squad-mates see
          you live, and toggle <strong>Public</strong> to appear on the world map.
        </p>
      </>
    )
  }
];

export default function TimelineTutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal tutorial" onClick={e => e.stopPropagation()}>
        <div className="tutorial-head">
          <div className="tutorial-icon">{step.icon}</div>
          <div className="tutorial-dots">
            {STEPS.map((_, n) => (
              <span key={n} className={'dot' + (n === i ? ' active' : n < i ? ' done' : '')} />
            ))}
          </div>
        </div>
        <h2 style={{ margin: '8px 0 4px' }}>{step.title}</h2>
        <div className="tutorial-body">{step.body}</div>
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          {i > 0 && (
            <button className="btn secondary" onClick={() => setI(i - 1)} style={{ flex: 1 }}>← Back</button>
          )}
          {!last ? (
            <button className="btn" onClick={() => setI(i + 1)} style={{ flex: 2 }}>Next →</button>
          ) : (
            <button className="btn" onClick={onClose} style={{ flex: 2 }}>Got it — let's go!</button>
          )}
        </div>
        <button className="tutorial-skip" onClick={onClose}>Skip</button>
      </div>
    </div>
  );
}
