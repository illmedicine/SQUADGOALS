import { Link } from 'react-router-dom';

// Static privacy policy, reachable at /privacy for users, Google OAuth
// verification and app-store review. Update lastUpdated whenever it changes.
const lastUpdated = 'October 4, 2026';

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 18px 64px', lineHeight: 1.6 }}>
      <Link to="/" style={{ fontSize: 13, color: 'var(--muted)' }}>← Back to SquadREN</Link>
      <h1 style={{ marginTop: 8 }}>Privacy Policy</h1>
      <p style={{ color: 'var(--muted)' }}>Last updated: {lastUpdated}</p>

      <p>
        SquadREN ("we", "us") is a shared-space freight network operated by{' '}
        <strong>illy robotic instruments</strong>. It connects shippers with
        independent truck drivers who have open space on their trailers. This page
        explains what we collect, why, who can see it, and how to delete it. We do
        not sell personal data and we do not run ad networks.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li><strong>Google account profile</strong> — name, email address and
          profile photo URL via Google Sign-In, used to identify you and show
          your name to the other party on a shipment.</li>
        <li><strong>Your role</strong> — whether you use SquadREN as a shipper or
          a driver.</li>
        <li><strong>Location (required)</strong> — your device's GPS position
          while the app is open. Shippers' location is used to suggest pickup
          points and find nearby trucks. Drivers' location is published to the
          network while they are <em>Online</em> so shippers can see the truck
          and track pickups; switching to <em>Offline</em> stops publishing.</li>
        <li><strong>Driver profile</strong> — truck make, model, year and color,
          an optional truck photo, trailer type, available cargo space, posted
          trip itinerary, bio, years of experience and MC/DOT number.</li>
        <li><strong>Shipments</strong> — item descriptions, dimensions, weight,
          quantity, pickup and drop-off locations and addresses, quoted price,
          and status history.</li>
      </ul>

      <h2>2. Google Sign-In</h2>
      <p>
        We use Firebase Authentication with Google and request only the default
        <em> openid, email, profile</em> scopes. We never receive your Google
        password. Revoke access anytime at{' '}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>.
        Our use of information received from Google APIs adheres to the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>,
        including the Limited Use requirements.
      </p>

      <h2>3. Google Maps Platform</h2>
      <p>
        Maps are displayed with the Google Maps JavaScript API; your browser
        talks to Google directly to load map tiles, governed by Google's{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>{' '}
        and the{' '}
        <a href="https://cloud.google.com/maps-platform/terms" target="_blank" rel="noreferrer">Maps Platform Terms</a>.
        We do not send your name or email to Google Maps.
      </p>

      <h2>4. Who sees what</h2>
      <ul>
        <li><strong>Everyone signed in</strong> sees a driver's public profile:
          name, photo, truck, available space, itinerary and live position while
          the driver is Online.</li>
        <li><strong>The driver on your shipment</strong> sees your name, the item
          details and the pickup/drop-off addresses you entered.</li>
        <li><strong>The shipper on your load</strong> sees your truck's live
          position until the shipment is delivered.</li>
        <li><strong>Nobody else</strong> — we do not share identifying data with
          advertisers or data brokers.</li>
      </ul>

      <h2>5. Where data is stored</h2>
      <p>
        Account, driver and shipment data is stored in Google Cloud Firestore in
        the Firebase project we operate, encrypted at rest and in transit. Some
        data is also cached in your browser's local storage so the app loads
        quickly.
      </p>

      <h2>6. Children</h2>
      <p>SquadREN is not directed at children under 13, and drivers must be legally licensed to operate a commercial vehicle.</p>

      <h2>7. Your rights & deletion</h2>
      <p>
        Email us at the address below to export or delete your account and
        associated data. You can stop location sharing at any time by going
        Offline (drivers) or revoking location permission in your browser —
        note that SquadREN requires location to book or haul shipments.
      </p>

      <h2>8. Changes</h2>
      <p>We may update this policy as the service evolves; the date above reflects the latest revision.</p>

      <h2>9. Contact</h2>
      <p>
        illy robotic instruments<br />
        Email: <a href="mailto:privacy@squad-ren.com">privacy@squad-ren.com</a><br />
        Domain: <a href="https://squad-ren.com">squad-ren.com</a>
      </p>
    </div>
  );
}
