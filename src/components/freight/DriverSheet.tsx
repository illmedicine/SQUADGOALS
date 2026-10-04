// Driver profile drawer — what a shipper sees before booking: the actual rig,
// live status, the full itinerary with ETAs, and a visual of the open space.
import type { Driver } from '../../lib/freight/types';
import type { Match } from '../../lib/freight/network';
import { liveState, stopEtas } from '../../lib/freight/network';
import { truckTitle, PAINT_BY_ID } from '../../lib/freight/trucks';
import { trailerOf, type CargoSpace } from '../../lib/freight/cargo';
import { fmtWhen } from '../../lib/freight/route';
import TruckImage from './TruckImage';
import CargoVisualizer from './CargoVisualizer';
import { DriverAvatar, Stars, StatusDot } from './ui';

type Props = {
  driver: Driver;
  match?: Match | null;
  cargo: CargoSpace;          // remaining space after other bookings
  now: number;
  onClose: () => void;
  onBook: () => void;
  canBook?: boolean;
};

export default function DriverSheet({ driver, match, cargo, now, onClose, onBook, canBook = true }: Props) {
  const live = liveState(driver, now);
  const journey = match?.journey ?? live.journey;
  const stops = journey ? stopEtas(journey) : [];
  const trailer = trailerOf(driver.cargo);

  return (
    <aside className="sheet" role="dialog" aria-label={`${driver.name} profile`}>
      <button className="sheet-close" onClick={onClose} aria-label="Close">✕</button>
      <div className="sheet-hero">
        <TruckImage spec={driver.truck} trailerId={driver.cargo.trailerId} showTrailer className="sheet-truck" />
      </div>
      <div className="sheet-body">
        <div className="sheet-id">
          <DriverAvatar driver={driver} size={56} />
          <div>
            <h2>{driver.name}</h2>
            <div className="sheet-meta">
              <Stars rating={driver.rating} /> · {driver.tripsCompleted.toLocaleString()} trips · {driver.yearsDriving} yrs driving
            </div>
            <StatusDot live={live} />
          </div>
        </div>

        <div className="spec-grid">
          <div><small>Tractor</small><b>{truckTitle(driver.truck)}</b></div>
          <div><small>Paint</small><b><i className="swatch" style={{ background: PAINT_BY_ID[driver.truck.colorId]?.hex }} />{PAINT_BY_ID[driver.truck.colorId]?.name}</b></div>
          <div><small>Trailer</small><b>{trailer.icon} {trailer.name}</b></div>
          <div><small>Authority</small><b>{driver.mcNumber ?? 'Pending'}</b></div>
        </div>
        {driver.bio && <p className="sheet-bio">“{driver.bio}”</p>}

        {match && (
          <div className="match-box">
            <div><span className="pin a">A</span> Pickup near <b>{fmtWhen(match.pickupEta)}</b>{match.pickupOffRoute > 15 && <em> · {Math.round(match.pickupOffRoute)} mi off route</em>}</div>
            <div><span className="pin b">B</span> Drop-off <b>{fmtWhen(match.dropoffEta)}</b>{match.dropoffOffRoute > 15 && <em> · {Math.round(match.dropoffOffRoute)} mi off route</em>}</div>
            <div className="muted">{Math.round(match.tripMiles).toLocaleString()} miles on this truck</div>
          </div>
        )}

        <h3>Available space</h3>
        <CargoVisualizer cargo={cargo} bookedSqft={Math.max(0, driver.cargo.sqft - cargo.sqft)} />

        <h3>Itinerary</h3>
        {stops.length === 0 ? <p className="muted">No trip posted right now.</p> : (
          <ol className="timeline">
            {stops.map((s, i) => {
              const passed = journey === live.journey && s.mile <= live.mile;
              const isPick = match && Math.abs(s.mile - match.pickupMile) < 40;
              const isDrop = match && Math.abs(s.mile - match.dropoffMile) < 40;
              return (
                <li key={i} className={`${passed ? 'passed' : ''} ${isPick ? 'pick' : ''} ${isDrop ? 'drop' : ''}`}>
                  <span className="tl-dot" />
                  <span className="tl-city">{s.city.name}, {s.city.state}</span>
                  <span className="tl-eta">{passed ? 'Passed' : fmtWhen(s.eta)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {canBook && (
        <div className="sheet-cta">
          <div><b>{Math.round(cargo.sqft)} sq ft</b> open · {cargo.maxWeight.toLocaleString()} lbs</div>
          <button className="btn primary" onClick={onBook} disabled={cargo.sqft < 4 || !journey}>Book space on this truck →</button>
        </div>
      )}
    </aside>
  );
}
