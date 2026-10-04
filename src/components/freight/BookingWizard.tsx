// Shipper booking flow: what → where → review → done. The fit check runs live
// against the driver's remaining space so the shipper never requests a load
// that can't go on the truck.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Driver } from '../../lib/freight/types';
import { legFor, liveState, upcomingJourneys, type Journey, type Match } from '../../lib/freight/network';
import { ITEM_PRESETS, PRESET_BY_KIND, checkFit, trailerOf, quote, fmtFt, fmtLbs, fmtMoney, type CargoSpace, type ItemKind, type ShipItem } from '../../lib/freight/cargo';
import { CITY_BY_ID, nearestCity, cityLabel, type City } from '../../lib/freight/cities';
import { fmtWhen, metersToMiles } from '../../lib/freight/route';
import { haversine, type LatLng } from '../../lib/geo';
import { createBooking } from '../../lib/freight/store';
import { useAuth } from '../../lib/AuthContext';
import CargoVisualizer from './CargoVisualizer';
import TruckImage from './TruckImage';
import { DriverAvatar } from './ui';
import { truckTitle } from '../../lib/freight/trucks';

type Props = {
  driver: Driver;
  cargo: CargoSpace;
  match?: Match | null;
  search?: { from: City; to: City } | null;
  myPos: LatLng | null;
  now: number;
  onClose: () => void;
};

type Step = 'item' | 'route' | 'review' | 'done';

const toUnit = (ft: number, unit: 'ft' | 'in') => unit === 'ft' ? +ft.toFixed(2) : Math.round(ft * 12);
const fromUnit = (v: number, unit: 'ft' | 'in') => unit === 'ft' ? v : v / 12;

export default function BookingWizard({ driver, cargo, match, search, myPos, now, onClose }: Props) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('item');
  const [item, setItem] = useState<ShipItem>(() => ({ ...PRESET_BY_KIND.sedan, qty: 1, notes: '' }));
  const [unit, setUnit] = useState<'ft' | 'in'>('ft');
  const [busy, setBusy] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  // Journey: the matched one, else the driver's current/next trip.
  const live = liveState(driver, now);
  const journey: Journey | null = match?.journey ?? upcomingJourneys(driver, now, 1)[0] ?? null;
  const afterMile = journey && live.journey && live.journey.departAt === journey.departAt ? live.mile : -1;
  const futureStops = journey ? journey.geom.stops.filter((_, i) => journey.geom.stopMiles[i] > afterMile) : [];

  const myCity = myPos ? nearestCity(myPos) : null;
  const [pickupId, setPickupId] = useState<string>(() => search?.from.id ?? (myCity && futureStops.some(s => s.id === myCity.id) ? myCity.id : futureStops[0]?.id ?? ''));
  const [dropoffId, setDropoffId] = useState<string>(() => search?.to.id ?? futureStops[futureStops.length - 1]?.id ?? '');
  const [useMyLoc, setUseMyLoc] = useState(() => !!(myPos && search && metersToMiles(haversine(myPos, search.from)) < 60));
  const [pickupAddr, setPickupAddr] = useState('');
  const [dropoffAddr, setDropoffAddr] = useState('');

  const pickupCity = CITY_BY_ID[pickupId];
  const dropoffCity = CITY_BY_ID[dropoffId];
  const pickupPoint: LatLng | null = useMyLoc && myPos ? myPos : pickupCity ?? null;
  const leg = useMemo(() => journey && pickupPoint && dropoffCity ? legFor(journey, pickupPoint, dropoffCity, afterMile) : null,
    [journey?.departAt, pickupPoint?.lat, pickupPoint?.lng, dropoffCity?.id, afterMile]);
  const legOk = !!leg && leg.tripMiles > 5 && leg.pickupOffRoute < 150 && leg.dropoffOffRoute < 150;

  const fit = checkFit(cargo, item);
  const price = leg ? quote(leg.tripMiles, item, fit) : null;

  const pickPreset = (k: ItemKind) => {
    const p = PRESET_BY_KIND[k];
    setItem(i => ({ ...p, qty: i.kind === k ? i.qty : 1, notes: i.notes }));
  };
  const setDim = (key: 'length' | 'width' | 'height', v: string) => {
    const n = parseFloat(v);
    setItem(i => ({ ...i, kind: i.kind === 'custom' || !PRESET_BY_KIND[i.kind] ? i.kind : 'custom', name: i.kind === 'custom' ? i.name : `Custom ${i.name}`, [key]: isFinite(n) ? fromUnit(n, unit) : 0 }));
  };

  async function submit() {
    if (!user || !leg || !price || !pickupPoint || !dropoffCity || !journey) return;
    setBusy(true);
    try {
      const pc = useMyLoc && myPos ? nearestCity(myPos) : pickupCity!;
      const b = await createBooking({
        driverId: driver.id,
        driverName: driver.name,
        customerId: user.uid,
        customerName: user.displayName,
        customerPhoto: user.photoURL,
        item,
        pickup: { cityId: pc.id, address: pickupAddr || (useMyLoc ? 'My current location' : cityLabel(pc)), lat: pickupPoint.lat, lng: pickupPoint.lng },
        dropoff: { cityId: dropoffCity.id, address: dropoffAddr || cityLabel(dropoffCity), lat: dropoffCity.lat, lng: dropoffCity.lng },
        pickupMile: leg.pickupMile,
        dropoffMile: leg.dropoffMile,
        pickupEta: leg.pickupEta,
        dropoffEta: leg.dropoffEta,
        journeyDepartAt: journey.departAt,
        price: { total: price.total, driverPayout: price.driverPayout, miles: price.miles },
        footprintSqft: Math.round(Math.min(cargo.sqft, Math.max(fit.footprintSqft, fit.usedLength * trailerOf(cargo).width))),
      });
      setBookingId(b.id);
      setStep('done');
    } finally {
      setBusy(false);
    }
  }

  const STEPS: { id: Step; label: string }[] = [
    { id: 'item', label: 'What' }, { id: 'route', label: 'Where' }, { id: 'review', label: 'Review' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wizard" onClick={e => e.stopPropagation()} role="dialog" aria-label="Book space">
        <header className="wiz-head">
          <DriverAvatar driver={driver} size={36} />
          <div className="wiz-title">
            <b>Book space with {driver.name.split(' ')[0]}</b>
            <small>{truckTitle(driver.truck)} · {Math.round(cargo.sqft)} sq ft open</small>
          </div>
          <button className="sheet-close static" onClick={onClose} aria-label="Close">✕</button>
        </header>
        {step !== 'done' && (
          <div className="stepper">
            {STEPS.map((s, i) => (
              <div key={s.id} className={`step ${s.id === step ? 'on' : ''} ${STEPS.findIndex(x => x.id === step) > i ? 'done' : ''}`}>
                <span>{i + 1}</span>{s.label}
              </div>
            ))}
          </div>
        )}

        <div className="wiz-body">
          {step === 'item' && (
            <>
              <h3>What are you shipping?</h3>
              <div className="preset-grid">
                {ITEM_PRESETS.map(p => (
                  <button key={p.kind} type="button" className={`preset ${item.kind === p.kind ? 'on' : ''}`} onClick={() => pickPreset(p.kind)}>
                    <span>{p.icon}</span>{p.name}
                  </button>
                ))}
                <button type="button" className={`preset ${item.kind === 'custom' ? 'on' : ''}`} onClick={() => setItem(i => ({ ...i, kind: 'custom', name: 'Custom item' }))}>
                  <span>✏️</span>Something else
                </button>
              </div>

              <div className="dims">
                <label className="wide">Description
                  <input value={item.name} onChange={e => setItem(i => ({ ...i, name: e.target.value }))} placeholder="e.g. 2019 Honda Civic, oak dresser…" />
                </label>
                <div className="unit-toggle" role="radiogroup" aria-label="Units">
                  <button type="button" className={unit === 'ft' ? 'on' : ''} onClick={() => setUnit('ft')}>feet</button>
                  <button type="button" className={unit === 'in' ? 'on' : ''} onClick={() => setUnit('in')}>inches</button>
                </div>
                <label>Length<input type="number" min={0} step={unit === 'ft' ? 0.1 : 1} value={toUnit(item.length, unit)} onChange={e => setDim('length', e.target.value)} /></label>
                <label>Width<input type="number" min={0} step={unit === 'ft' ? 0.1 : 1} value={toUnit(item.width, unit)} onChange={e => setDim('width', e.target.value)} /></label>
                <label>Height<input type="number" min={0} step={unit === 'ft' ? 0.1 : 1} value={toUnit(item.height, unit)} onChange={e => setDim('height', e.target.value)} /></label>
                <label>Weight (lbs, each)<input type="number" min={0} value={item.weight} onChange={e => setItem(i => ({ ...i, weight: Math.max(0, +e.target.value || 0) }))} /></label>
                <label>Quantity
                  <div className="qty">
                    <button type="button" onClick={() => setItem(i => ({ ...i, qty: Math.max(1, i.qty - 1) }))}>−</button>
                    <span>{item.qty}</span>
                    <button type="button" onClick={() => setItem(i => ({ ...i, qty: i.qty + 1 }))}>+</button>
                  </div>
                </label>
                <label className="check"><input type="checkbox" checked={!!item.stackable} onChange={e => setItem(i => ({ ...i, stackable: e.target.checked }))} /> Stackable</label>
              </div>

              <div className={`fit-banner ${fit.fits ? 'good' : 'bad'}`}>
                {fit.fits
                  ? <>✅ <b>It fits!</b> {item.qty} × {fmtFt(item.length)} × {fmtFt(item.width)} × {fmtFt(item.height)}, {fmtLbs(fit.totalWeight)} — uses {Math.round(fit.pctFloor * 100)}% of the open floor.</>
                  : <>❌ <b>Won’t fit on this truck.</b> {fit.reasons.join(' · ')}</>}
              </div>
              <CargoVisualizer cargo={cargo} item={item} gallery={false} />
            </>
          )}

          {step === 'route' && (
            <>
              <h3>Pickup & drop-off</h3>
              {!journey ? <p className="error">This driver has no upcoming trip.</p> : (
                <div className="route-form">
                  <div className="rf-row">
                    <span className="pin a">A</span>
                    <div className="rf-fields">
                      <label>Pickup city on this route
                        <select value={pickupId} onChange={e => { setPickupId(e.target.value); setUseMyLoc(false); }} disabled={useMyLoc}>
                          {search && !futureStops.some(s => s.id === search.from.id) && <option value={search.from.id}>{cityLabel(search.from)} (near route)</option>}
                          {futureStops.slice(0, -1).map(s => <option key={s.id} value={s.id}>{cityLabel(s)}</option>)}
                        </select>
                      </label>
                      {myPos && (
                        <label className="check"><input type="checkbox" checked={useMyLoc} onChange={e => setUseMyLoc(e.target.checked)} /> Pick up at my current location {myCity && <small>(near {cityLabel(myCity)})</small>}</label>
                      )}
                      <input value={pickupAddr} onChange={e => setPickupAddr(e.target.value)} placeholder="Street address / meeting point (optional)" />
                    </div>
                  </div>
                  <div className="rf-row">
                    <span className="pin b">B</span>
                    <div className="rf-fields">
                      <label>Drop-off city
                        <select value={dropoffId} onChange={e => setDropoffId(e.target.value)}>
                          {search && !futureStops.some(s => s.id === search.to.id) && <option value={search.to.id}>{cityLabel(search.to)} (near route)</option>}
                          {futureStops.slice(1).map(s => <option key={s.id} value={s.id}>{cityLabel(s)}</option>)}
                        </select>
                      </label>
                      <input value={dropoffAddr} onChange={e => setDropoffAddr(e.target.value)} placeholder="Street address (optional)" />
                    </div>
                  </div>
                  {leg && legOk ? (
                    <div className="eta-card">
                      <div><small>Pickup window</small><b>{fmtWhen(leg.pickupEta)}</b><em>± 2 hrs</em></div>
                      <div className="eta-arrow">→ {Math.round(leg.tripMiles).toLocaleString()} mi →</div>
                      <div><small>Est. delivery</small><b>{fmtWhen(leg.dropoffEta)}</b></div>
                    </div>
                  ) : (
                    <p className="error">That drop-off isn’t after the pickup on this driver’s route. Choose a later stop.</p>
                  )}
                  {leg && legOk && useMyLoc && leg.pickupOffRoute > 15 && (
                    <p className="muted">You’re about {Math.round(leg.pickupOffRoute)} miles off the driver’s route — they’ll meet you at the nearest truck-accessible spot, or you can drop off near {pickupCity?.name}.</p>
                  )}
                </div>
              )}
            </>
          )}

          {step === 'review' && leg && price && (
            <>
              <h3>Review & request</h3>
              <div className="review">
                <div className="review-truck"><TruckImage spec={driver.truck} trailerId={driver.cargo.trailerId} showTrailer /></div>
                <dl>
                  <dt>Item</dt><dd>{item.qty} × {item.name} <small>({fmtFt(item.length)} × {fmtFt(item.width)} × {fmtFt(item.height)}, {fmtLbs(item.weight * item.qty)})</small></dd>
                  <dt>Pickup</dt><dd>{pickupAddr || (useMyLoc ? 'My current location' : pickupCity && cityLabel(pickupCity))} · <b>{fmtWhen(leg.pickupEta)}</b></dd>
                  <dt>Drop-off</dt><dd>{dropoffAddr || (dropoffCity && cityLabel(dropoffCity))} · <b>{fmtWhen(leg.dropoffEta)}</b></dd>
                  <dt>Driver</dt><dd>{driver.name} · {truckTitle(driver.truck)}</dd>
                </dl>
                <div className="price">
                  <div><span>Line haul · {price.miles.toLocaleString()} mi · {Math.round(price.share * 100)}% of trailer</span><b>{fmtMoney(price.lineHaul)}</b></div>
                  <div><span>Pickup & loading</span><b>{fmtMoney(price.pickupFee)}</b></div>
                  <div><span>Cargo protection</span><b>{fmtMoney(price.insurance)}</b></div>
                  <div><span>SquadREN service fee</span><b>{fmtMoney(price.platform)}</b></div>
                  <div className="total"><span>Total</span><b>{fmtMoney(price.total)}</b></div>
                </div>
                <p className="muted small">You won’t be charged until the driver accepts. Payment is collected at pickup.</p>
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="done">
              <div className="done-burst">🚚</div>
              <h3>Request sent to {driver.name.split(' ')[0]}!</h3>
              <p>{driver.seeded ? 'Drivers usually confirm within minutes.' : 'You’ll see it update here as soon as the driver responds.'} Track it anytime from <b>My Shipments</b>.</p>
              <button className="btn primary" onClick={() => nav(`/shipments?b=${bookingId}`)}>Track my shipment →</button>
              <button className="btn ghost" onClick={onClose}>Keep browsing</button>
            </div>
          )}
        </div>

        {step !== 'done' && (
          <footer className="wiz-foot">
            {step !== 'item' ? <button className="btn ghost" onClick={() => setStep(step === 'review' ? 'route' : 'item')}>← Back</button> : <span />}
            {step === 'item' && <button className="btn primary" disabled={!fit.fits || item.length <= 0 || item.width <= 0 || item.height <= 0} onClick={() => setStep('route')}>Next: pickup & drop-off →</button>}
            {step === 'route' && <button className="btn primary" disabled={!legOk} onClick={() => setStep('review')}>Next: review →</button>}
            {step === 'review' && <button className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Sending…' : `Request booking · ${price ? fmtMoney(price.total) : ''}`}</button>}
          </footer>
        )}
      </div>
    </div>
  );
}
