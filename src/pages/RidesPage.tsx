import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { watchUserSquads, type Squad } from '../lib/data';
import {
  STATIC_ROUTES, CHARTER_FLAT_RATE, CHARTER_NOTE,
  simulateFleet,
  createBooking, watchMyBookings, cancelBooking,
  addPaymentMethod, removePaymentMethod, getPaymentMethods,
  type Booking, type PaymentMethod, type StaticRoute, type SimVan,
} from '../lib/rides';

type Tab = 'book' | 'rides' | 'fleet';
type BookMode = 'static' | 'charter';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusColor(s: Booking['status']) {
  return s === 'confirmed' || s === 'active' ? '#22c55e'
    : s === 'pending' ? '#f59e0b'
    : s === 'cancelled' ? '#ef4444' : '#94a3b8';
}

function vanStatusColor(s: SimVan['status']) {
  return s === 'on_route' ? '#0ea5e9'
    : s === 'charter' ? '#8b5cf6'
    : s === 'available' ? '#22c55e' : '#94a3b8';
}

function brandIcon(brand: string) {
  return brand === 'visa' ? '💳' : brand === 'amex' ? '💳' : brand === 'mastercard' ? '💳' : '💳';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RidesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('book');
  const [squads, setSquads] = useState<Squad[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [fleet, setFleet] = useState<SimVan[]>(() => simulateFleet());
  const [showAddCard, setShowAddCard] = useState(false);

  useEffect(() => {
    if (!user) return;
    return watchUserSquads(user.uid, setSquads);
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    return watchMyBookings(user.uid, setBookings);
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    getPaymentMethods(user.uid).then(setPaymentMethods).catch(() => {});
  }, [user?.uid]);

  // Live fleet simulation — tick every 10 s
  useEffect(() => {
    const id = setInterval(() => setFleet(simulateFleet()), 10_000);
    return () => clearInterval(id);
  }, []);

  if (!user) return null;

  const defaultPm = paymentMethods.find(p => p.isDefault) || paymentMethods[0] || null;

  async function handleAddCard(pm: Omit<PaymentMethod, 'id' | 'addedAt'>) {
    const id = await addPaymentMethod(user!.uid, pm);
    setPaymentMethods(prev => {
      const next = pm.isDefault ? prev.map(p => ({ ...p, isDefault: false })) : [...prev];
      return [{ ...pm, id, addedAt: Date.now() }, ...next];
    });
  }

  async function handleRemoveCard(pmId: string) {
    await removePaymentMethod(user!.uid, pmId);
    setPaymentMethods(prev => prev.filter(p => p.id !== pmId));
  }

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', padding: '12px 0 6px' }}>
        <div style={{ fontSize: 36 }}>🚐</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 900 }}>Squadron Rides</h1>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
          Group transit, reimagined · Buffalo, NY
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, margin: '14px 0 16px' }}>
        {(['book', 'rides', 'fleet'] as Tab[]).map(t => (
          <button key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '9px 4px', borderRadius: 12, border: 'none',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: tab === t ? '#111' : '#f1f5f9',
              color: tab === t ? '#fff' : '#334155',
            }}>
            {t === 'book' ? '🎟️ Book' : t === 'rides' ? '📋 My Rides' : '🚐 Fleet'}
          </button>
        ))}
      </div>

      {tab === 'book' && (
        <BookTab
          squads={squads}
          paymentMethods={paymentMethods}
          defaultPm={defaultPm}
          userId={user.uid}
          displayName={user.displayName}
          onBookingCreated={() => setTab('rides')}
          onNeedCard={() => setShowAddCard(true)}
        />
      )}

      {tab === 'rides' && (
        <RidesTab bookings={bookings} />
      )}

      {tab === 'fleet' && (
        <FleetTab fleet={fleet} />
      )}

      {/* Payment methods section (always visible at bottom) */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>💳 Payment Methods</h2>
          <button className="btn ghost" style={{ width: 'auto', fontSize: 12 }} onClick={() => setShowAddCard(true)}>
            ＋ Add Card
          </button>
        </div>
        {paymentMethods.length === 0 && (
          <div className="empty" style={{ fontSize: 13 }}>
            No cards saved. Add one to book a ride.
          </div>
        )}
        {paymentMethods.map(pm => (
          <div key={pm.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
            <span style={{ fontSize: 22 }}>{brandIcon(pm.brand)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{pm.label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {pm.brand.toUpperCase()} ···· {pm.last4} · Exp {pm.expiryMonth}/{pm.expiryYear}
                {pm.isDefault && <span style={{ marginLeft: 8, color: '#22c55e', fontWeight: 700 }}>✓ Default</span>}
              </div>
            </div>
            <button
              onClick={() => handleRemoveCard(pm.id)}
              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18 }}>
              ×
            </button>
          </div>
        ))}
      </div>

      {showAddCard && (
        <AddCardModal
          onClose={() => setShowAddCard(false)}
          onSave={async (pm) => {
            await handleAddCard(pm);
            setShowAddCard(false);
          }}
          isFirst={paymentMethods.length === 0}
        />
      )}
    </div>
  );
}

// ─── Book Tab ─────────────────────────────────────────────────────────────────

function BookTab({
  squads, paymentMethods, defaultPm, userId, displayName,
  onBookingCreated, onNeedCard
}: {
  squads: Squad[];
  paymentMethods: PaymentMethod[];
  defaultPm: PaymentMethod | null;
  userId: string;
  displayName: string;
  onBookingCreated: () => void;
  onNeedCard: () => void;
}) {
  const [mode, setMode] = useState<BookMode>('static');
  const [selectedRoute, setSelectedRoute] = useState<StaticRoute | null>(null);

  return (
    <>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button onClick={() => { setMode('static'); setSelectedRoute(null); }}
          style={{
            flex: 1, padding: '10px 8px', borderRadius: 12, border: '2px solid',
            borderColor: mode === 'static' ? '#111' : '#e2e8f0',
            background: mode === 'static' ? '#111' : '#fff',
            color: mode === 'static' ? '#fff' : '#334155',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
          🗺️ Static Daily Routes
        </button>
        <button onClick={() => { setMode('charter'); setSelectedRoute(null); }}
          style={{
            flex: 1, padding: '10px 8px', borderRadius: 12, border: '2px solid',
            borderColor: mode === 'charter' ? '#8b5cf6' : '#e2e8f0',
            background: mode === 'charter' ? '#8b5cf6' : '#fff',
            color: mode === 'charter' ? '#fff' : '#334155',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
          🚐 Private Charter
        </button>
      </div>

      {mode === 'static' && !selectedRoute && (
        <>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0, marginBottom: 12 }}>
            Scheduled group rides on fixed routes. Book a seat — the more people, the cheaper it gets vs. Uber XL.
          </p>
          {STATIC_ROUTES.map(route => (
            <RouteCard key={route.id} route={route} onSelect={() => setSelectedRoute(route)} />
          ))}
        </>
      )}

      {mode === 'static' && selectedRoute && (
        <StaticBookingForm
          route={selectedRoute}
          squads={squads}
          paymentMethods={paymentMethods}
          defaultPm={defaultPm}
          userId={userId}
          displayName={displayName}
          onBack={() => setSelectedRoute(null)}
          onBooked={onBookingCreated}
          onNeedCard={onNeedCard}
        />
      )}

      {mode === 'charter' && (
        <CharterForm
          squads={squads}
          paymentMethods={paymentMethods}
          defaultPm={defaultPm}
          userId={userId}
          displayName={displayName}
          onBooked={onBookingCreated}
          onNeedCard={onNeedCard}
        />
      )}
    </>
  );
}

// ─── Route Card ───────────────────────────────────────────────────────────────

function RouteCard({ route, onSelect }: { route: StaticRoute; onSelect: () => void }) {
  const savings = Math.round(((route.compPrice - route.pricePerRider) / route.compPrice) * 100);
  return (
    <div className="card" style={{ marginBottom: 10, cursor: 'pointer' }} onClick={onSelect}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          fontSize: 28, width: 48, height: 48, borderRadius: 14,
          background: 'linear-gradient(135deg,#0ea5e922,#8b5cf622)',
          display: 'grid', placeItems: 'center', flex: '0 0 48px'
        }}>{route.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{route.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {route.pickupName} → {route.dropoffName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {route.departureTime} · {route.durationLabel} · {route.frequency}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <div>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>${route.pricePerRider}</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>/ rider RT</span>
          <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8', textDecoration: 'line-through' }}>
            ${route.compPrice} Uber XL
          </span>
        </div>
        <div style={{
          padding: '3px 10px', borderRadius: 999, background: '#dcfce7',
          color: '#166534', fontSize: 11, fontWeight: 800
        }}>
          Save {savings}%
        </div>
      </div>
      <button className="btn" style={{ marginTop: 10, padding: '10px 0' }}>
        Book seats →
      </button>
    </div>
  );
}

// ─── Static Booking Form ──────────────────────────────────────────────────────

function StaticBookingForm({
  route, squads, paymentMethods, defaultPm, userId, displayName,
  onBack, onBooked, onNeedCard
}: {
  route: StaticRoute;
  squads: Squad[];
  paymentMethods: PaymentMethod[];
  defaultPm: PaymentMethod | null;
  userId: string;
  displayName: string;
  onBack: () => void;
  onBooked: () => void;
  onNeedCard: () => void;
}) {
  const [seats, setSeats] = useState(1);
  const [date, setDate] = useState(today());
  const [pickupName, setPickupName] = useState(route.pickupName);
  const [selectedPmId, setSelectedPmId] = useState<string>(defaultPm?.id || '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Auto-fill pickup from squad HQ if available
  const squadHqOptions = useMemo(() =>
    squads.filter(s => s.hq).map(s => ({ id: s.id, name: `${s.name} HQ`, placeName: s.hq!.placeName || `${s.name} HQ` })),
    [squads]);

  const total = seats * route.pricePerRider;
  const selectedPm = paymentMethods.find(p => p.id === selectedPmId) || defaultPm;

  async function book() {
    if (!selectedPm) { onNeedCard(); return; }
    setBusy(true);
    try {
      await createBooking({
        uid: userId,
        displayName,
        routeId: route.id,
        routeName: route.name,
        isCharter: false,
        vanId: null,
        vanLabel: null,
        seats,
        totalPrice: total,
        pickupName,
        dropoffName: route.dropoffName,
        scheduledDate: date,
        departureTime: route.departureTime,
        status: 'confirmed',
        paymentLast4: selectedPm.last4,
      });
      setDone(true);
      setTimeout(onBooked, 1800);
    } catch (e: any) {
      alert(e?.message || 'Booking failed.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <div style={{ fontSize: 56 }}>✅</div>
        <h2 style={{ fontWeight: 900, margin: '12px 0 4px' }}>You're booked!</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          {seats} seat{seats > 1 ? 's' : ''} on <strong>{route.name}</strong><br />
          {date} · {route.departureTime}
        </p>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#0ea5e9', padding: 0, marginBottom: 12 }}>
        ← Back to routes
      </button>

      {/* Route summary */}
      <div className="card" style={{ background: 'linear-gradient(135deg,#0ea5e922,#8b5cf622)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{route.emoji}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{route.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {route.pickupName} → {route.dropoffName}<br />
              Departs {route.departureTime} · {route.durationLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Date */}
      <label style={{ display: 'block', marginTop: 14, fontWeight: 700, fontSize: 13 }}>📅 Travel Date</label>
      <input type="date" className="input" value={date} min={today()}
        onChange={e => setDate(e.target.value)} />

      {/* Pickup */}
      <label style={{ display: 'block', marginTop: 10, fontWeight: 700, fontSize: 13 }}>📍 Pickup Terminal</label>
      <select className="select" value={pickupName} onChange={e => setPickupName(e.target.value)}>
        <option value={route.pickupName}>{route.pickupName}</option>
        {squadHqOptions.map(o => (
          <option key={o.id} value={o.placeName}>{o.name} — {o.placeName}</option>
        ))}
      </select>
      {squadHqOptions.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
          Set a Squad HQ to use it as your pickup hub.
        </div>
      )}

      {/* Seats */}
      <label style={{ display: 'block', marginTop: 10, fontWeight: 700, fontSize: 13 }}>👥 Seats</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <button onClick={() => setSeats(s => Math.max(1, s - 1))}
          style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: '#f1f5f9', fontSize: 20, cursor: 'pointer', fontWeight: 700 }}>−</button>
        <span style={{ fontSize: 24, fontWeight: 900, minWidth: 32, textAlign: 'center' }}>{seats}</span>
        <button onClick={() => setSeats(s => Math.min(route.maxPassengers, s + 1))}
          style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: '#f1f5f9', fontSize: 20, cursor: 'pointer', fontWeight: 700 }}>＋</button>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>max {route.maxPassengers}</span>
      </div>

      {/* Price summary */}
      <div className="card" style={{ marginTop: 14, background: '#f8fafc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
          <span>${route.pricePerRider} × {seats} seat{seats > 1 ? 's' : ''}</span>
          <span>${total.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
          <span>Uber XL equivalent</span>
          <span style={{ textDecoration: 'line-through' }}>${(route.compPrice * seats).toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
        <div style={{ fontSize: 11, color: '#166534', marginTop: 4, fontWeight: 700 }}>
          You save ${((route.compPrice - route.pricePerRider) * seats).toFixed(2)} vs Uber XL 🎉
        </div>
      </div>

      {/* Payment */}
      <label style={{ display: 'block', marginTop: 14, fontWeight: 700, fontSize: 13 }}>💳 Payment</label>
      {paymentMethods.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
          No card saved.{' '}
          <button onClick={onNeedCard} style={{ background: 'none', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontWeight: 700 }}>
            Add a card →
          </button>
        </div>
      ) : (
        <select className="select" value={selectedPmId} onChange={e => setSelectedPmId(e.target.value)}>
          {paymentMethods.map(pm => (
            <option key={pm.id} value={pm.id}>
              {pm.brand.toUpperCase()} ···· {pm.last4} — {pm.label}
            </option>
          ))}
        </select>
      )}

      <button className="btn" style={{ marginTop: 16, fontSize: 16, padding: '14px 0' }}
        disabled={busy || !date || paymentMethods.length === 0}
        onClick={book}>
        {busy ? 'Booking…' : `Confirm ${seats} seat${seats > 1 ? 's' : ''} · $${total.toFixed(2)}`}
      </button>
    </div>
  );
}

// ─── Charter Form ─────────────────────────────────────────────────────────────

function CharterForm({
  squads, paymentMethods, defaultPm, userId, displayName,
  onBooked, onNeedCard
}: {
  squads: Squad[];
  paymentMethods: PaymentMethod[];
  defaultPm: PaymentMethod | null;
  userId: string;
  displayName: string;
  onBooked: () => void;
  onNeedCard: () => void;
}) {
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('10:00');
  const [passengers, setPassengers] = useState(8);
  const [notes, setNotes] = useState('');
  const [selectedPmId, setSelectedPmId] = useState(defaultPm?.id || '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const squadHqOptions = useMemo(() =>
    squads.filter(s => s.hq).map(s => ({ id: s.id, label: `${s.name} HQ`, value: s.hq!.placeName || `${s.name} HQ` })),
    [squads]);

  const selectedPm = paymentMethods.find(p => p.id === selectedPmId) || defaultPm;

  async function book() {
    if (!pickup.trim() || !destination.trim()) {
      alert('Please fill in pickup and destination.');
      return;
    }
    if (!selectedPm) { onNeedCard(); return; }
    setBusy(true);
    try {
      await createBooking({
        uid: userId,
        displayName,
        routeId: 'charter',
        routeName: 'Private Charter',
        isCharter: true,
        vanId: null,
        vanLabel: null,
        seats: passengers,
        totalPrice: CHARTER_FLAT_RATE,
        pickupName: pickup.trim(),
        dropoffName: destination.trim(),
        scheduledDate: date,
        departureTime: time,
        status: 'confirmed',
        paymentLast4: selectedPm.last4,
        charterDestination: destination.trim(),
        charterNotes: notes.trim() || undefined,
      });
      setDone(true);
      setTimeout(onBooked, 1800);
    } catch (e: any) {
      alert(e?.message || 'Booking failed.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <div style={{ fontSize: 56 }}>🚐✅</div>
        <h2 style={{ fontWeight: 900, margin: '12px 0 4px' }}>Charter Confirmed!</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Your van will be assigned and you'll see it in My Rides.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Charter pricing card */}
      <div className="card" style={{ background: 'linear-gradient(135deg,#8b5cf622,#ec489922)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 22 }}>${CHARTER_FLAT_RATE} flat rate</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{CHARTER_NOTE}</div>
          </div>
          <span style={{ fontSize: 36 }}>🚐</span>
        </div>
      </div>

      {/* Pickup */}
      <label style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>📍 Pickup Location</label>
      {squadHqOptions.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {squadHqOptions.map(o => (
            <button key={o.id} type="button"
              onClick={() => setPickup(o.value)}
              style={{
                padding: '4px 10px', borderRadius: 999, fontSize: 12, border: 'none', cursor: 'pointer',
                background: pickup === o.value ? '#111' : '#f1f5f9',
                color: pickup === o.value ? '#fff' : '#334155', fontWeight: 600
              }}>📍 {o.label}</button>
          ))}
        </div>
      )}
      <input className="input" placeholder="e.g. 1234 Main St, Buffalo NY" value={pickup}
        onChange={e => setPickup(e.target.value)} style={{ marginTop: 6 }} />

      {/* Destination */}
      <label style={{ display: 'block', marginTop: 10, fontWeight: 700, fontSize: 13 }}>🏁 Destination</label>
      <input className="input" placeholder="e.g. Bills Stadium, Orchard Park" value={destination}
        onChange={e => setDestination(e.target.value)} />

      {/* Date & time */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
        <div>
          <label style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>📅 Date</label>
          <input type="date" className="input" value={date} min={today()} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>⏰ Departure</label>
          <input type="time" className="input" value={time} onChange={e => setTime(e.target.value)} />
        </div>
      </div>

      {/* Passengers */}
      <label style={{ display: 'block', marginTop: 10, fontWeight: 700, fontSize: 13 }}>👥 Passengers</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <button onClick={() => setPassengers(s => Math.max(1, s - 1))}
          style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: '#f1f5f9', fontSize: 20, cursor: 'pointer', fontWeight: 700 }}>−</button>
        <span style={{ fontSize: 24, fontWeight: 900, minWidth: 32, textAlign: 'center' }}>{passengers}</span>
        <button onClick={() => setPassengers(s => Math.min(15, s + 1))}
          style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: '#f1f5f9', fontSize: 20, cursor: 'pointer', fontWeight: 700 }}>＋</button>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>max 15</span>
      </div>

      {/* Notes */}
      <label style={{ display: 'block', marginTop: 10, fontWeight: 700, fontSize: 13 }}>📝 Notes (optional)</label>
      <textarea className="input" rows={3} style={{ resize: 'none' }}
        placeholder="Event type, special requirements, accessibility needs…"
        value={notes} onChange={e => setNotes(e.target.value)} />

      {/* Payment */}
      <label style={{ display: 'block', marginTop: 10, fontWeight: 700, fontSize: 13 }}>💳 Payment</label>
      {paymentMethods.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
          No card saved.{' '}
          <button onClick={onNeedCard} style={{ background: 'none', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontWeight: 700 }}>
            Add a card →
          </button>
        </div>
      ) : (
        <select className="select" value={selectedPmId} onChange={e => setSelectedPmId(e.target.value)}>
          {paymentMethods.map(pm => (
            <option key={pm.id} value={pm.id}>
              {pm.brand.toUpperCase()} ···· {pm.last4} — {pm.label}
            </option>
          ))}
        </select>
      )}

      <button className="btn" style={{ marginTop: 16, fontSize: 16, padding: '14px 0', background: '#8b5cf6' }}
        disabled={busy || !destination.trim() || !pickup.trim() || paymentMethods.length === 0}
        onClick={book}>
        {busy ? 'Booking…' : `Confirm Charter · $${CHARTER_FLAT_RATE}`}
      </button>
    </div>
  );
}

// ─── My Rides Tab ─────────────────────────────────────────────────────────────

function RidesTab({ bookings }: { bookings: Booking[] }) {
  const [cancelling, setCancelling] = useState<string | null>(null);

  async function doCancel(id: string) {
    if (!confirm('Cancel this booking?')) return;
    setCancelling(id);
    try { await cancelBooking(id); } finally { setCancelling(null); }
  }

  if (bookings.length === 0) {
    return (
      <div className="empty">
        No rides yet. Book your first Squadron ride above!
      </div>
    );
  }

  return (
    <>
      {bookings.map(b => (
        <div key={b.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              {b.isCharter ? '🚐 Private Charter' : b.routeName}
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
              background: statusColor(b.status) + '22',
              color: statusColor(b.status),
            }}>
              {b.status.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {b.scheduledDate} · {b.departureTime} · {b.seats} seat{b.seats > 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {b.pickupName} → {b.dropoffName}
          </div>
          {b.vanLabel && (
            <div style={{ fontSize: 12, color: '#0ea5e9', marginTop: 2, fontWeight: 700 }}>
              🚐 {b.vanLabel}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontWeight: 900 }}>${b.totalPrice.toFixed(2)}</span>
            {b.paymentLast4 && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>···· {b.paymentLast4}</span>
            )}
            {(b.status === 'confirmed' || b.status === 'pending') && (
              <button
                onClick={() => doCancel(b.id)}
                disabled={cancelling === b.id}
                className="btn ghost"
                style={{ width: 'auto', fontSize: 12, padding: '4px 12px' }}>
                {cancelling === b.id ? 'Cancelling…' : 'Cancel'}
              </button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Fleet Tab ────────────────────────────────────────────────────────────────

function FleetTab({ fleet }: { fleet: SimVan[] }) {
  const onRoute = fleet.filter(v => v.status === 'on_route').length;
  const available = fleet.filter(v => v.status === 'available').length;
  const maintenance = fleet.filter(v => v.status === 'maintenance').length;

  return (
    <>
      {/* Summary chips */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Active', count: onRoute, color: '#0ea5e9' },
          { label: 'Available', count: available, color: '#22c55e' },
          { label: 'Maintenance', count: maintenance, color: '#94a3b8' },
        ].map(s => (
          <div key={s.label} style={{
            borderRadius: 12, padding: '10px 8px', textAlign: 'center',
            background: s.color + '18', border: `1px solid ${s.color}44`
          }}>
            <div style={{ fontWeight: 900, fontSize: 22, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>
        Live fleet · positions update every 10 s · visible on the Map tab
      </p>

      {fleet.map(van => (
        <div key={van.id} className="card" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: vanStatusColor(van.status) + '22',
            display: 'grid', placeItems: 'center', fontSize: 20, flex: '0 0 44px'
          }}>🚐</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{van.label}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {van.routeName || (van.status === 'maintenance' ? 'In maintenance' : 'Available for booking')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {van.lat.toFixed(4)}, {van.lng.toFixed(4)} · {van.seatsAvailable} seats open
            </div>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
            background: vanStatusColor(van.status) + '22',
            color: vanStatusColor(van.status), textTransform: 'uppercase', whiteSpace: 'nowrap'
          }}>
            {van.status.replace('_', ' ')}
          </span>
        </div>
      ))}
    </>
  );
}

// ─── Add Card Modal ───────────────────────────────────────────────────────────

function AddCardModal({ onClose, onSave, isFirst }: {
  onClose: () => void;
  onSave: (pm: Omit<PaymentMethod, 'id' | 'addedAt'>) => Promise<void>;
  isFirst: boolean;
}) {
  const [label, setLabel] = useState('');
  const [last4, setLast4] = useState('');
  const [brand, setBrand] = useState('visa');
  const [expiryMonth, setExpiryMonth] = useState(12);
  const [expiryYear, setExpiryYear] = useState(new Date().getFullYear() + 2);
  const [isDefault, setIsDefault] = useState(isFirst);
  const [busy, setBusy] = useState(false);

  const canSave = label.trim() && last4.length === 4;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      await onSave({
        label: label.trim(),
        last4,
        brand,
        expiryMonth,
        expiryYear,
        isDefault,
      });
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>💳 Add Payment Method</h2>
          <button onClick={onClose} style={{ background: '#eee', border: 'none', borderRadius: 999, width: 32, height: 32, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 14px' }}>
          Card details are stored securely. Payment processing will be handled at launch.
        </p>

        <label style={{ fontWeight: 700, fontSize: 13 }}>Card nickname</label>
        <input className="input" placeholder="e.g. My Visa" value={label} onChange={e => setLabel(e.target.value)} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <div>
            <label style={{ fontWeight: 700, fontSize: 13 }}>Last 4 digits</label>
            <input className="input" placeholder="4242" maxLength={4} value={last4}
              onChange={e => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          </div>
          <div>
            <label style={{ fontWeight: 700, fontSize: 13 }}>Brand</label>
            <select className="select" value={brand} onChange={e => setBrand(e.target.value)}>
              <option value="visa">Visa</option>
              <option value="mastercard">Mastercard</option>
              <option value="amex">Amex</option>
              <option value="discover">Discover</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <div>
            <label style={{ fontWeight: 700, fontSize: 13 }}>Exp Month</label>
            <select className="select" value={expiryMonth} onChange={e => setExpiryMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 700, fontSize: 13 }}>Exp Year</label>
            <select className="select" value={expiryYear} onChange={e => setExpiryYear(Number(e.target.value))}>
              {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: 13 }}>
          <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
          Set as default payment method
        </label>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn" style={{ flex: 2 }} disabled={!canSave || busy} onClick={save}>
            {busy ? 'Saving…' : 'Save Card'}
          </button>
        </div>
      </div>
    </div>
  );
}
