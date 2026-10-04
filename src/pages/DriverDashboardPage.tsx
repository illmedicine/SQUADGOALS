import { useEffect, useMemo, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useDeviceLocation } from '../lib/LocationContext';
import { firebaseConfigured } from '../lib/firebase';
import { useBookings, useDriver, useNow, saveDriver, publishLive, setBookingStatus, createBooking } from '../lib/freight/store';
import { liveState, stopEtas, legFor, remainingCargo } from '../lib/freight/network';
import { checkFit, fmtFt, fmtLbs, fmtMoney, PRESET_BY_KIND, quote, trailerOf } from '../lib/freight/cargo';
import { fmtWhen, fmtDuration } from '../lib/freight/route';
import { truckTitle, PAINT_BY_ID } from '../lib/freight/trucks';
import type { Booking, Driver } from '../lib/freight/types';
import TruckImage from '../components/freight/TruckImage';
import CargoVisualizer from '../components/freight/CargoVisualizer';
import NetworkMap from '../components/freight/NetworkMap';
import { routeColor, StatusDot, Stars } from '../components/freight/ui';

export default function DriverDashboardPage() {
  const { user } = useAuth();
  const driver = useDriver(user?.uid);
  if (!user) return null;
  if (!driver) return <Navigate to="/driver/setup" replace />;
  return <Dashboard driver={driver} />;
}

function Dashboard({ driver }: { driver: Driver }) {
  const now = useNow(2000);
  const { pos } = useDeviceLocation();
  const bookings = useBookings({ driverId: driver.id });
  const live = liveState(driver, now);
  const lastPublish = useRef(0);

  // Publish GPS to the network while online (throttled to once a minute).
  useEffect(() => {
    if (!driver.online || !pos) return;
    if (Date.now() - lastPublish.current < 60_000) return;
    lastPublish.current = Date.now();
    publishLive(driver, pos);
  }, [driver.online, pos?.lat, pos?.lng]);

  const requests = bookings.filter(b => b.status === 'requested');
  const active = bookings.filter(b => b.status === 'accepted' || b.status === 'picked_up');
  const done = bookings.filter(b => b.status === 'delivered');
  const earnings = done.reduce((s, b) => s + b.price.driverPayout, 0);
  const pipeline = active.reduce((s, b) => s + b.price.driverPayout, 0);
  const remaining = remainingCargo({ ...driver, booked: undefined }, bookings, now);
  const bookedSqft = driver.cargo.sqft - remaining.sqft;

  // Keep the public "booked" total on the driver profile in sync so shippers
  // see accurate remaining space.
  useEffect(() => {
    const sqft = Math.round(bookedSqft), lbs = Math.round(driver.cargo.maxWeight - remaining.maxWeight);
    if (driver.booked?.sqft !== sqft || driver.booked?.lbs !== lbs) saveDriver({ ...driver, booked: { sqft, lbs } });
  }, [bookedSqft, remaining.maxWeight]);

  const journey = live.journey;
  const stops = journey ? stopEtas(journey) : [];
  const myPos = pos ?? live.pos;
  const fitTo = useMemo(() => journey ? journey.geom.stops : [myPos], [journey?.departAt, driver.itinerary?.stops.join()]);

  const toggleOnline = () => saveDriver({ ...driver, online: !driver.online, live: pos ? { lat: pos.lat, lng: pos.lng, at: Date.now() } : driver.live });

  return (
    <div className="dash">
      <section className="dash-hero" style={{ ['--paint' as any]: PAINT_BY_ID[driver.truck.colorId]?.hex }}>
        <div className="dash-hero-art"><TruckImage spec={driver.truck} /></div>
        <div className="dash-hero-info">
          <div className="hello">Welcome back, {driver.name.split(' ')[0]}</div>
          <h1>{truckTitle(driver.truck)}</h1>
          <div className="dash-meta"><Stars rating={driver.rating} /> · {trailerOf(driver.cargo).name} · {driver.mcNumber ?? 'MC pending'}</div>
          <div className="dash-actions">
            <button className={`online-toggle ${driver.online ? 'on' : ''}`} onClick={toggleOnline} aria-pressed={driver.online}>
              <i />{driver.online ? 'Online — visible to shippers' : 'Offline — hidden'}
            </button>
            <Link to="/driver/setup" className="btn ghost sm">Edit rig & trip</Link>
          </div>
        </div>
      </section>

      <div className="stat-row">
        <div className="stat"><small>New requests</small><b>{requests.length}</b></div>
        <div className="stat"><small>Active loads</small><b>{active.length}</b><em>{fmtMoney(pipeline)} pending</em></div>
        <div className="stat"><small>Earned</small><b>{fmtMoney(earnings)}</b><em>{done.length} delivered</em></div>
        <div className="stat"><small>Space left</small><b>{Math.round(remaining.sqft)} <span>sq ft</span></b><em>{fmtLbs(remaining.maxWeight)}</em></div>
      </div>

      <div className="dash-grid">
        <section className="panel span2">
          <div className="panel-head">
            <h2>Requests</h2>
            {!firebaseConfigured && <SimulateRequest driver={driver} now={now} />}
          </div>
          {requests.length === 0 ? (
            <p className="muted">No new requests. Shippers along your route can see your {Math.round(remaining.sqft)} sq ft of open space{driver.online ? '' : ' — go online to receive requests'}.</p>
          ) : requests.map(b => <RequestCard key={b.id} b={b} driver={driver} remaining={remaining} />)}

          {active.length > 0 && <h3 className="sub">Active loads</h3>}
          {active.map(b => (
            <div key={b.id} className="load-card">
              <span className="load-icon">{PRESET_BY_KIND[b.item.kind]?.icon ?? '📦'}</span>
              <div className="load-main">
                <b>{b.item.qty} × {b.item.name}</b>
                <small>{b.customerName} · {b.pickup.address} → {b.dropoff.address}</small>
                <small>{b.status === 'accepted' ? `Pickup ${fmtWhen(b.pickupEta)}` : `Deliver by ${fmtWhen(b.dropoffEta)}`} · {fmtMoney(b.price.driverPayout)} payout</small>
              </div>
              {b.status === 'accepted'
                ? <button className="btn primary sm" onClick={() => setBookingStatus(b, 'picked_up')}>Mark picked up</button>
                : <button className="btn primary sm" onClick={() => setBookingStatus(b, 'delivered')}>Mark delivered</button>}
            </div>
          ))}
          {done.length > 0 && (
            <details className="history">
              <summary>{done.length} delivered · {fmtMoney(earnings)}</summary>
              {done.map(b => <div key={b.id} className="hist-row">{b.item.name} · {b.pickup.address} → {b.dropoff.address} <b>{fmtMoney(b.price.driverPayout)}</b></div>)}
            </details>
          )}
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Current trip</h2><StatusDot live={live} /></div>
          <div className="mini-map">
            <NetworkMap
              trucks={[{ id: driver.id, pos: myPos, heading: live.heading, color: routeColor(driver.id), label: 'You', route: journey?.geom.points }]}
              selectedId={driver.id}
              showRoutes="all"
              pins={bookings.filter(b => b.status === 'accepted' || b.status === 'picked_up').flatMap(b => [{ pos: b.pickup, kind: 'pickup' as const }, { pos: b.dropoff, kind: 'dropoff' as const }])}
              fitTo={fitTo}
            />
          </div>
          {journey ? (
            <>
              <div className="trip-progress"><i style={{ width: `${live.progress * 100}%` }} /></div>
              <p className="muted small">
                {live.status === 'scheduled' ? `Departs ${fmtWhen(journey.departAt)}` : live.nextStop ? `Next: ${live.nextStop.name} · ${live.nextStopEta ? fmtWhen(live.nextStopEta) : ''}` : `Arrived ${fmtWhen(journey.arriveAt)}`}
                {' · '}{Math.round(journey.geom.totalMiles).toLocaleString()} mi total · {fmtDuration(journey.arriveAt - journey.departAt)}
              </p>
              <ol className="timeline compact">
                {stops.map((s, i) => (
                  <li key={i} className={s.mile <= live.mile && live.status !== 'scheduled' ? 'passed' : ''}>
                    <span className="tl-dot" /><span className="tl-city">{s.city.name}, {s.city.state}</span><span className="tl-eta">{fmtWhen(s.eta)}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : <p className="muted">No trip posted. <Link to="/driver/setup">Post your next trip →</Link></p>}
        </section>

        <section className="panel span3">
          <div className="panel-head"><h2>Your open space</h2><Link to="/driver/setup" className="link-btn">Change</Link></div>
          <CargoVisualizer cargo={remaining} bookedSqft={bookedSqft} />
        </section>
      </div>
    </div>
  );
}

function RequestCard({ b, driver, remaining }: { b: Booking; driver: Driver; remaining: ReturnType<typeof remainingCargo> }) {
  const fit = checkFit(remaining, b.item);
  return (
    <div className="request-card">
      <div className="rq-top">
        <span className="load-icon">{PRESET_BY_KIND[b.item.kind]?.icon ?? '📦'}</span>
        <div className="load-main">
          <b>{b.item.qty} × {b.item.name}</b>
          <small>{fmtFt(b.item.length)} × {fmtFt(b.item.width)} × {fmtFt(b.item.height)} · {fmtLbs(b.item.weight * b.item.qty)} · from {b.customerName}</small>
        </div>
        <div className="payout"><small>Payout</small><b>{fmtMoney(b.price.driverPayout)}</b></div>
      </div>
      <div className="rq-route">
        <span><i className="pin a sm">A</i>{b.pickup.address} · {fmtWhen(b.pickupEta)}</span>
        <span><i className="pin b sm">B</i>{b.dropoff.address} · {fmtWhen(b.dropoffEta)}</span>
      </div>
      <CargoVisualizer cargo={remaining} item={b.item} gallery={false} compact />
      <div className="rq-actions">
        <button className="btn ghost sm" onClick={() => setBookingStatus(b, 'declined')}>Decline</button>
        <button className="btn primary sm" disabled={!fit.fits} onClick={() => setBookingStatus(b, 'accepted')}>{fit.fits ? 'Accept load' : 'No room'}</button>
      </div>
      {driver.online ? null : <small className="muted">You’re offline — accepting will still confirm this load.</small>}
    </div>
  );
}

// Demo-only helper (no Firebase): lets a solo tester see the driver side of a
// booking without a second account.
function SimulateRequest({ driver, now }: { driver: Driver; now: number }) {
  const live = liveState(driver, now);
  const j = live.journey;
  if (!j) return null;
  const stops = j.geom.stops.filter((_, i) => j.geom.stopMiles[i] > live.mile);
  if (stops.length < 2) return null;
  const run = async () => {
    const kinds = ['sedan', 'pallet', 'motorcycle', 'sofa', 'piano'] as const;
    const p = PRESET_BY_KIND[kinds[Math.floor(Math.random() * kinds.length)]];
    const item = { ...p, qty: p.kind === 'pallet' ? 3 : 1 };
    const a = stops[0], bCity = stops[stops.length - 1];
    const leg = legFor(j, a, bCity, live.mile);
    if (!leg) return;
    const q = quote(leg.tripMiles, item, checkFit(driver.cargo, item));
    await createBooking({
      driverId: driver.id, driverName: driver.name, customerId: 'demo-shipper', customerName: 'Jordan (demo shipper)', customerPhoto: null,
      item, pickup: { cityId: a.id, address: `${a.name}, ${a.state}`, lat: a.lat, lng: a.lng },
      dropoff: { cityId: bCity.id, address: `${bCity.name}, ${bCity.state}`, lat: bCity.lat, lng: bCity.lng },
      pickupMile: leg.pickupMile, dropoffMile: leg.dropoffMile, pickupEta: leg.pickupEta, dropoffEta: leg.dropoffEta,
      journeyDepartAt: j.departAt, price: { total: q.total, driverPayout: q.driverPayout, miles: q.miles },
      footprintSqft: Math.round(item.length * item.width * item.qty),
    });
  };
  return <button className="link-btn" onClick={run} title="Demo mode only">+ Simulate a shipper request</button>;
}

