import { Link } from 'react-router-dom';

// Static privacy policy. Reachable at /privacy (linked from login + profile +
// footer) so Google OAuth verification, app-store review, and end-users can
// inspect exactly what Squad REN collects, who it talks to, and how to wipe
// their data. Update the lastUpdated string whenever this file is changed.
const lastUpdated = 'May 16, 2026';

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 18px 64px', lineHeight: 1.55 }}>
      <Link to="/" style={{ fontSize: 13, color: 'var(--muted)' }}>← Back to map</Link>
      <h1 style={{ marginTop: 8 }}>Privacy Policy</h1>
      <p style={{ color: 'var(--muted)', marginTop: -8 }}>Last updated: {lastUpdated}</p>

      <p>
        Squad REN ("Reputable Engagement Network", "we", "us") is an experimental
        social-mapping app built by <strong>illy robotic instruments</strong>. This
        page describes exactly what we collect, why, who it is shared with, and how
        you can delete it. We take the minimum necessary approach: we don't sell
        data, we don't run ad networks, and you can wipe everything from inside the
        app at any time.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li><strong>Google account profile</strong> — name, email address, and
          profile picture URL via Google OAuth. We use this only to sign you in,
          identify you to your squad, and display your avatar.</li>
        <li><strong>Location</strong> — your device's GPS coordinates while the
          app is open and you have toggled location sharing on. <strong>By
          default a new account ships with Squad share and Public share both
          ON</strong> so live squadders are visible to the wider community out of
          the box. You can flip either off at any time from the share toggles in
          the top-right of the map; when both are off, your position is never
          written to our servers.</li>
        <li><strong>Activity</strong> — places you pin, reviews you import or
          write, trips you plan, check-ins, squad memberships, and missile-game
          actions. These are stored under your account so you can see them later.</li>
        <li><strong>Presence heartbeat</strong> — a 60-second timestamp so the
          Population Pulse Counter can show how many users are currently online.
          This always contains your uid and display name. A coarse coordinate is
          attached <em>only</em> when both Squad share and Public share are on,
          so the live map pin that other users see is strictly consent-gated.</li>
        <li><strong>Diagnostic logs</strong> — anonymous error traces from the
          browser console. No personal data is included.</li>
      </ul>

      <h2>2. Google OAuth (Sign-In with Google)</h2>
      <p>
        We use Firebase Authentication with the Google identity provider. The
        OAuth scopes we request are strictly the default profile set: <em>openid,
        email, profile</em>. We do <strong>not</strong> request access to your
        Gmail, Drive, Calendar, Contacts, YouTube, Photos, or any other Google
        service. We do not receive or store your Google password — authentication
        is brokered entirely by Google.
      </p>
      <p>
        You can revoke Squad REN's access at any time from your Google account:{' '}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
          myaccount.google.com/permissions
        </a>.
      </p>
      <p>
        Squad REN's use of information received from Google APIs adheres to the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank" rel="noreferrer">Google API Services User Data Policy</a>,
        including the Limited Use requirements.
      </p>

      <h2>3. Google Maps Platform</h2>
      <p>
        Squad REN displays maps using the Google Maps JavaScript API and resolves
        place metadata using the Google Places API. When the map is visible, your
        browser communicates directly with Google to load tiles, geocode pins, and
        fetch place details. This usage is governed by Google's own{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
          Privacy Policy
        </a>{' '}
        and the{' '}
        <a href="https://cloud.google.com/maps-platform/terms" target="_blank" rel="noreferrer">
          Google Maps Platform Terms of Service
        </a>. We do not send your name, email, or any account identifier to Google
        Maps — only the queries the map needs to render (e.g. tile coordinates and
        place IDs you tap).
      </p>

      <h2>4. Where data is stored</h2>
      <p>
        All app data (pins, trips, presence, squads, missiles) is stored in{' '}
        <strong>Google Cloud Firestore</strong> inside the Firebase project we
        operate. Firestore data is encrypted at rest by Google and in transit via
        TLS. Access to the project's admin console is restricted to the developers
        listed in our internal access log and is protected by two-factor
        authentication.
      </p>

      <h2>5. Who sees what</h2>
      <ul>
        <li><strong>You</strong> always see everything you own.</li>
        <li><strong>Your squad-mates</strong> see your live location only while
          you have <em>Squad share</em> toggled on.</li>
        <li><strong>The public</strong> sees your live location — as a pin on
          the world map and an entry in the Population Pulse roster — while you
          have <em>Public share</em> toggled on. Public share is ON by default
          for new accounts; switch the share-stack toggle to “Squad only” to
          opt out at any time. Pins, reviews, and storefronts you mark as public
          remain visible per their own visibility settings.</li>
        <li><strong>Nobody else</strong> — we do not sell, rent, or share
          identifying data with advertisers or third-party data brokers.</li>
      </ul>

      <h2>6. Security</h2>
      <ul>
        <li>HTTPS-only delivery via squad-ren.com with a Let's Encrypt certificate.</li>
        <li>Firestore Security Rules restrict each document so it can only be
          written by its owner (uid match) and only read by audiences you opt
          into (squad members, public, or yourself).</li>
        <li>OAuth tokens never leave your browser — only short-lived Firebase
          ID tokens are used to authenticate requests.</li>
        <li>Reasonable, but not perfect: no internet service is 100% secure.
          Report a security issue to the contact below and we will respond
          promptly.</li>
      </ul>

      <h2>7. Children</h2>
      <p>
        Squad REN is not directed at children under 13. We do not knowingly
        collect data from children. If you believe a minor has signed up, contact
        us and we will delete the account.
      </p>

      <h2>8. Your rights & deletion</h2>
      <p>
        You can wipe your data at any time:
      </p>
      <ul>
        <li>From the app, open <Link to="/profile">Profile</Link> → "Delete my
          account". This removes your Firestore documents, presence record, and
          revokes your sign-in.</li>
        <li>To revoke Google OAuth access without contacting us, visit{' '}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
            myaccount.google.com/permissions
          </a>.</li>
        <li>Email the address below to request a manual export or deletion.</li>
      </ul>

      <h2>9. Changes</h2>
      <p>
        We may update this policy as the app evolves. Material changes will be
        flagged in-app on next sign-in. The "Last updated" date at the top of
        this page reflects the most recent revision.
      </p>

      <h2>10. Contact</h2>
      <p>
        illy robotic instruments<br />
        Email: <a href="mailto:privacy@squad-ren.com">privacy@squad-ren.com</a><br />
        Domain: <a href="https://squad-ren.com">squad-ren.com</a>
      </p>
    </div>
  );
}
