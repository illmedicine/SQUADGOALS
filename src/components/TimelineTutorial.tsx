import { useState } from 'react';

// Step-by-step tutorial that walks users through exporting their Google
// Timeline / Location History and importing the JSON file into Squad REN
// to bank XP, badges, and prestige.

const STEPS = [
  {
    icon: '🗺️',
    title: 'Import your Google Timeline',
    body: (
      <>
        <p>
          Squad REN turns the places you've already been into XP, badges, and
          prestige. Bring in your Google Maps Timeline once and the map fills
          with every coffee shop, park, and venue you've visited.
        </p>
        <ul>
          <li>Earn the <strong>Globetrotter</strong> & <strong>Cartographer</strong> badges instantly</li>
          <li>Watch your tier jump on the Badges page</li>
          <li>Choose later which places to share with squads or the world</li>
        </ul>
      </>
    )
  },
  {
    icon: '📱',
    title: 'Option A — Export from your phone (fastest)',
    body: (
      <>
        <ol>
          <li>Open the <strong>Google Maps</strong> app.</li>
          <li>Tap your profile picture → <strong>Your Timeline</strong>.</li>
          <li>Tap the <strong>⋯</strong> (more) menu → <strong>Location &amp; privacy settings</strong>.</li>
          <li>Scroll to <strong>Export Timeline data</strong> → save the <code>Timeline.json</code> file.</li>
          <li>Send it to yourself (email / Drive) so you can open it on this device.</li>
        </ol>
        <p className="muted small">
          On newer Android builds Google moved Timeline data to on-device storage,
          so this is the easiest path.
        </p>
      </>
    )
  },
  {
    icon: '💻',
    title: 'Option B — Google Takeout (desktop)',
    body: (
      <>
        <ol>
          <li>
            Go to{' '}
            <a href="https://takeout.google.com/" target="_blank" rel="noreferrer">
              takeout.google.com
            </a>.
          </li>
          <li>Click <strong>Deselect all</strong>, then check{' '}
            <strong>Location History (Timeline)</strong>.</li>
          <li>Choose <strong>JSON</strong> format and create the export.</li>
          <li>Wait for the email, download the ZIP, and unzip it.</li>
          <li>
            Look for any of these inside <code>Takeout/Location History/</code>:
            <ul>
              <li><code>Records.json</code> (full raw history)</li>
              <li><code>Semantic Location History/YYYY/YYYY_MONTH.json</code></li>
              <li><code>Timeline.json</code> (newer format)</li>
            </ul>
          </li>
        </ol>
      </>
    )
  },
  {
    icon: '📥',
    title: 'Drop the file into Squad REN',
    body: (
      <>
        <ol>
          <li>Open the <strong>Map</strong> tab in Squad REN.</li>
          <li>Tap the <span className="chip-inline">📥 Timeline</span> chip in the top card.</li>
          <li>Pick the JSON file you exported.</li>
          <li>
            We dedupe, batch-upload, and award XP automatically. Up to 2,000
            places are imported per file.
          </li>
        </ol>
        <p className="muted small">
          Your places start <strong>private to you</strong>. Tap any pin to share it
          with your squad, or use the <span className="chip-inline">＋</span> button to drop a
          public review the whole world can see.
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
        </ul>
        <p className="muted small">
          Tip: turn on <strong>Sharing</strong> in the map header so squad-mates can see
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
