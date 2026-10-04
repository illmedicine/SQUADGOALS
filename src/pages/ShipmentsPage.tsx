import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useBookings, useNetworkDrivers, useNow, setBookingStatus, effectiveStatus } from '../lib/freight/store';
import { liveState, journeyAt } from '../lib/freight/network';
import { fmtFt, fmtLbs, fmtMoney, PRESET_BY_KIND } from '../lib/freight/cargo';
import { fmtWhen, fmtDuration, routeGeom } from '../lib/freight/route';
import { truckTitle } from '../lib/freight/trucks';
import type { Booking, BookingStatus } from '../lib/freight/types';
import NetworkMap, { type MapTruck } from '../components/freight/NetworkMap';
import TruckImage from '../components/freight/TruckImage';
import { DriverAvatar, routeColor, Stars } from '../components/freight/ui';

const FLOW: { s: BookingStatus; label: string; icon: string }[] = [
  { s: 'requested', label: 'Requested', icon: '📝' },
  { s: 'accepted', label: 'Driver confirmed', icon: '🤝' },
  { s: 'picked_up', label: 'Picked up · in transit', icon: '🚛' },
  { s: 'delivered', label: 'Delivered', icon: '🏁' },
];
export const STATUS_TEXT: Record<BookingStatus, string> = {
  requested: 'Waiting for driver', accepted: 'Confirmed', picked_up: 'In transit', delivered: 'Delivered', declined: 'Declined', cancelled: 'Cancelled',
};

export default function ShipmentsPage() {
  const { user } = useAuth();
  const now = useNow(2000);
  const bookings = useBookings({ customerId: user?.uid });
  const drivers = useNetworkDrivers();
  const [params, setParams] = useSearchParams();
  const selId = params.get('b') ?? bookings[0]?.id ?? null;
  const sel = bookings.find(b => b.id === selId) ?? null;

  if (bookings.length === 0) {
    return (
      <div className="page narrow">
        <div className="empty big">
          <div className="empty-icon">📦</div>
          <h1>No shipments yet</h1>
          <p>Search a lane, pick a truck that’s already heading your way, and book the space you need.</p>
          <Link className="btn primary" to="/">Find a truck</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ship-page">
      <div className="ship-list">
        <h1>My shipments</h1>
        {bookings.map(b => {
          const st = effectiveStatus(b, now);
          return (
            <button key={b.id} className={`ship-row ${b.id === selId ? 'active' : ''}`} onClick={() => setParams({ b: b.id })}>
              <span className="ship-icon">{PRESET_BY_KIND[b.item.kind]?.icon ?? '📦'}</span>
              <span className="ship-main">
                <b>{b.item.qty > 1 ? `${b.item.qty} × ` : ''}{b.item.name}</b>
                <small>{b.pickup.address.split(',')[0]} → {b.dropoff.address.split(',')[0]}</small>
              </span>
              <span className={`badge st-${st}`}>{STATUS_TEXT[st]}</span>
            </button>
          );
        })}
      </div>
      {sel && <ShipmentDetail b={sel} now={now} driver={drivers.find(d => d.id === sel.driverId) ?? null} />}
    </div>
  );
}

function ShipmentDetail({ b, now, driver }: { b: Booking; now: number; driver: ReturnType<typeof useNetworkDrivers>[number] | null }) {
  const st = effectiveStatus(b, now);
  const live = driver ? liveState(driver, now) : null;
  // Follow the journey this booking was made on (seeded runs repeat).
  const journeyMile = useMemo(() => {
    if (!driver?.itinerary) return null;
    const period = driver.itinerary.repeatEveryMs;
    const k = period ? Math.round((b.journeyDepartAt - driver.itinerary.departAt) / period) : 0;
    return journeyAt(driver, k);
  }, [driver?.id, b.journeyDepartAt]);
  const onThisJourney = live?.journey && journeyMile && live.journey.departAt === journeyMile.departAt;
  const truckMile = onThisJourney ? live!.mile : (now < b.journeyDepartAt ? 0 : null);
  const geom = journeyMile?.geom ?? (driver?.itinerary ? routeGeom(driver.itinerary.stops) : null);

  const trucks: MapTruck[] = driver && live ? [{
    id: driver.id, pos: live.pos, heading: live.heading, color: routeColor(driver.id), label: driver.name,
    route: geom?.points.filter(p => p.mile >= b.pickupMile - 1 && p.mile <= b.dropoffMile + 1),
  }] : [];
  const fitTo = useMemo(() => [b.pickup, b.dropoff, ...(live ? [live.pos] : [])], [b.id, !!live]);

  let headline = '';
  if (st === 'requested') headline = `Waiting for ${b.driverName.split(' ')[0]} to confirm`;
  else if (st === 'accepted') {
    const milesAway = truckMile !== null ? Math.max(0, b.pickupMile - truckMile) : null;
    headline = `Pickup ${fmtWhen(b.pickupEta)}` + (milesAway !== null && milesAway > 0 ? ` · truck is ${Math.round(milesAway).toLocaleString()} mi away` : '');
  } else if (st === 'picked_up') headline = `In transit · arrives ${fmtWhen(b.dropoffEta)} (${fmtDuration(Math.max(0, b.dropoffEta - now))})`;
  else if (st === 'delivered') headline = `Delivered ${fmtWhen(b.dropoffEta)}`;
  else headline = STATUS_TEXT[st];

  const progress = st === 'picked_up' && truckMile !== null ? Math.min(1, Math.max(0, (truckMile - b.pickupMile) / (b.dropoffMile - b.pickupMile))) : st === 'delivered' ? 1 : 0;
  const flowIdx = FLOW.findIndex(f => f.s === st);

  return (
    <div className="ship-detail">
      <div className="ship-map">
        <NetworkMap trucks={trucks} selectedId={driver?.id} pins={[{ pos: b.pickup, kind: 'pickup' }, { pos: b.dropoff, kind: 'dropoff' }]} showRoutes="selected" fitTo={fitTo} />
      </div>
      <div className="ship-info">
        <div className={`ship-headline st-${st}`}>{headline}</div>
        {(st === 'picked_up' || st === 'delivered') && (
          <div className="progress"><i style={{ width: `${progress * 100}%` }} /><span>🚛</span></div>
        )}
        {st === 'declined' || st === 'cancelled' ? (
          <p className="muted">This booking is closed. <Link to="/">Find another truck →</Link></p>
        ) : (
          <ol className="flow">
            {FLOW.map((f, i) => {
              const h = b.history.find(x => x.status === f.s);
              return (
                <li key={f.s} className={i <= flowIdx ? 'done' : ''}>
                  <span className="flow-icon">{f.icon}</span>
                  <span>{f.label}</span>
                  <small>{h ? fmtWhen(h.at) : i <= flowIdx ? 'Done' : f.s === 'picked_up' ? `ETA ${fmtWhen(b.pickupEta)}` : f.s === 'delivered' ? `ETA ${fmtWhen(b.dropoffEta)}` : ''}</small>
                </li>
              );
            })}
          </ol>
        )}

        {driver && (
          <div className="driver-mini">
            <div className="dm-truck"><TruckImage spec={driver.truck} /></div>
            <div>
              <div className="dm-name"><DriverAvatar driver={driver} size={28} /> <b>{driver.name}</b> <Stars rating={driver.rating} /></div>
              <small>{truckTitle(driver.truck)}</small>
            </div>
          </div>
        )}

        <dl className="ship-facts">
          <dt>Item</dt><dd>{b.item.qty} × {b.item.name} · {fmtFt(b.item.length)} × {fmtFt(b.item.width)} × {fmtFt(b.item.height)} · {fmtLbs(b.item.weight * b.item.qty)}</dd>
          <dt><span className="pin a sm">A</span> Pickup</dt><dd>{b.pickup.address}<small>{fmtWhen(b.pickupEta)}</small></dd>
          <dt><span className="pin b sm">B</span> Drop-off</dt><dd>{b.dropoff.address}<small>{fmtWhen(b.dropoffEta)}</small></dd>
          <dt>Price</dt><dd>{fmtMoney(b.price.total)} <small>{b.price.miles.toLocaleString()} mi</small></dd>
        </dl>
        {(st === 'requested' || st === 'accepted') && (
          <button className="btn ghost danger" onClick={() => { if (confirm('Cancel this shipment request?')) setBookingStatus(b, 'cancelled'); }}>Cancel shipment</button>
        )}
      </div>
    </div>
  );
}
