export default function RidesPage() {
  return (
    <div className="page">
      <div style={{ textAlign: 'center', padding: '24px 0 12px' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🚐</div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>Squadron Rides</h1>
        <span style={{
          display: 'inline-block', marginTop: 8, padding: '3px 14px',
          borderRadius: 999, background: '#f59e0b', color: '#fff',
          fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase'
        }}>
          Coming Soon · Buffalo, NY
        </span>
      </div>

      <div className="card" style={{ marginTop: 16, background: 'linear-gradient(135deg,#0ea5e922,#8b5cf622)', borderRadius: 16 }}>
        <p style={{ fontSize: 15, lineHeight: 1.65, margin: 0, fontWeight: 500 }}>
          Squadron transforms the traditional rideshare model by merging{' '}
          <strong>live-presence social networking</strong> with{' '}
          <strong>dynamic, high-capacity group transit.</strong> Traditional services isolate
          passengers and penalize groups with surge pricing. Squadron solves this.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 30 }}>🚐</div>
          <div style={{ fontWeight: 800, fontSize: 14, marginTop: 6 }}>10-Van Fleet</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Fully-wrapped, high-capacity passenger vans for private charters &amp; scheduled public routes
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 30 }}>📍</div>
          <div style={{ fontWeight: 800, fontSize: 14, marginTop: 6 }}>Buffalo, NY</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Gateway to international and high-volume regional tourism — strategically positioned
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 30 }}>💸</div>
          <div style={{ fontWeight: 800, fontSize: 14, marginTop: 6 }}>Group Pricing</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Algorithmic pricing that makes group travel cheaper for riders while maximizing per-trip profit
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 30 }}>🎟️</div>
          <div style={{ fontWeight: 800, fontSize: 14, marginTop: 6 }}>Two Modes</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Book a private charter for your squad or hop on a scheduled public route
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 800 }}>Why Squadron?</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: 'var(--muted)' }}>
          <li>Traditional rideshares isolate passengers and <strong style={{ color: 'inherit' }}>surge-price groups</strong></li>
          <li>No existing service combines <strong style={{ color: 'inherit' }}>live social presence</strong> with group transit</li>
          <li>High-capacity vans mean <strong style={{ color: 'inherit' }}>lower cost per seat</strong> — the bigger your squad, the better the deal</li>
          <li>Dedicated fleet means <strong style={{ color: 'inherit' }}>no driver uncertainty</strong> — every ride is a Squadron vehicle</li>
          <li>Dynamic algorithmic pricing <strong style={{ color: 'inherit' }}>maximizes profitability</strong> without penalizing your group</li>
        </ul>
      </div>

      <div style={{
        marginTop: 16, padding: '16px', borderRadius: 14,
        background: 'linear-gradient(135deg,#111,#1e1b4b)',
        color: '#fff', textAlign: 'center'
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, opacity: 0.7, textTransform: 'uppercase' }}>
          Launching in Buffalo, NY
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6 }}>
          Group travel. Reimagined.
        </div>
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
          More details dropping soon. Stay tuned in the app.
        </div>
      </div>
    </div>
  );
}
