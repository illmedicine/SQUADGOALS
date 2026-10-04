// Shipper home: live map of the network + lane search ("NYC → Denver") that
// lists every driver whose route passes both points, with pickup ETAs.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useDeviceLocation } from '../lib/LocationContext';
import { useBookings, useNetworkDrivers, useNow } from '../lib/freight/store';
import { findMatches, liveState, remainingCargo, STATUS_COLOR, STATUS_LABEL, type Match } from '../lib/freight/network';
import { CITIES, cityLabel, findCity, nearestCity, type City } from '../lib/freight/cities';
import { fmtWhen, metersToMiles } from '../lib/freight/route';
import { haversine } from '../lib/geo';
import { truckTitle } from '../lib/freight/trucks';
import { trailerOf } from '../lib/freight/cargo';
import NetworkMap, { type MapPin } from '../components/freight/NetworkMap';
import TruckImage from '../components/freight/TruckImage';
import DriverSheet from '../components/freight/DriverSheet';
import BookingWizard from '../components/freight/BookingWizard';
import { DriverAvatar, Stars, toMapTruck } from '../components/freight/ui';
import type { Driver } from '../lib/freight/types';

export default function FindTruckPage() {
  const { user } = useAuth();
  const { pos } = useDeviceLocation();
  const now = useNow(2000);
  const drivers = useNetworkDrivers();
  const [params, setParams] = useSearchParams();
  const myCity = pos ? nearestCity(pos) : null;

  const [fromText, setFromText] = useState(() => params.get('from') ?? (myCity ? cityLabel(myCity) : ''));
  const [toText, setToText] = useState(() => params.get('to') ?? '');
  const [date, setDate] = useState('');
  const [wide, setWide] = useState(false);
  const [search, setSearch] = useState<{ from: City; to: City } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const myBookings = useBookings({ customerId: user?.uid });

  useEffect(() => {
    if (!fromText && myCity) setFromText(cityLabel(myCity));
  }, [myCity?.id]);

  // Run a search from URL params on first load (e.g. shared links).
  useEffect(() => {
    if (params.get('from') && params.get('to')) runSearch();
  }, []);

  function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const f = findCity(fromText), t = findCity(toText);
    if (!f || !t) { setSearchError(!f ? `We couldn’t find “${fromText}”. Try a nearby major city.` : `We couldn’t find “${toText}”. Try a nearby major city.`); return; }
    if (f.id === t.id) { setSearchError('Pickup and drop-off are the same city.'); return; }
    setSearchError(null);
    setSearch({ from: f, to: t });
    setSelectedId(null);
    setParams({ from: cityLabel(f), to: cityLabel(t) }, { replace: true });
  }

  const minuteKey = Math.floor(now / 60000);
  const matches: Match[] = useMemo(() => {
    if (!search) return [];
    const earliest = date ? new Date(date + 'T00:00').getTime() : undefined;
    return findMatches(drivers, search.from, search.to, { now, radiusMi: wide ? 160 : 75, earliest });
  }, [search?.from.id, search?.to.id, drivers, wide, date, minuteKey]);
  const matchById = useMemo(() => new Map(matches.map(m => [m.driver.id, m])), [matches]);

  const nearby = useMemo(() => {
    if (search || !pos) return [];
    return drivers
      .map(d => ({ d, dist: metersToMiles(haversine(pos, liveState(d, now).pos)) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 12);
  }, [search, pos?.lat, pos?.lng, drivers, minuteKey]);

  const trucks = useMemo(() => drivers.map(d => toMapTruck(d, now, { dim: !!search && !matchById.has(d.id) })), [drivers, now, search, matchById]);
  const selected = drivers.find(d => d.id === selectedId) ?? null;
  const selectedMatch = selected ? matchById.get(selected.id) ?? null : null;

  const pins: MapPin[] = [];
  if (pos) pins.push({ pos, kind: 'me' });
  if (search) { pins.push({ pos: search.from, kind: 'pickup', label: search.from.name }); pins.push({ pos: search.to, kind: 'dropoff', label: search.to.name }); }
  const fitTo = useMemo(() => search ? [search.from, search.to] : null, [search?.from.id, search?.to.id]);

  const swap = () => { setFromText(toText); setToText(fromText); };
  const cargoFor = (d: Driver) => remainingCargo(d, myBookings, now);

  return (
    <div className="find-page">
      <div className="find-panel">
        <form className="search-card" onSubmit={runSearch}>
          <h1>Where’s it going?</h1>
          <div className="search-fields">
            <label className="sf"><span className="pin a">A</span>
              <input list="cities" value={fromText} onChange={e => setFromText(e.target.value)} placeholder="Pickup city — e.g. NYC" aria-label="Pickup city" />
            </label>
            <button type="button" className="swap" onClick={swap} aria-label="Swap pickup and drop-off">⇅</button>
            <label className="sf"><span className="pin b">B</span>
              <input list="cities" value={toText} onChange={e => setToText(e.target.value)} placeholder="Drop-off city — e.g. Denver" aria-label="Drop-off city" />
            </label>
          </div>
          <datalist id="cities">{CITIES.map(c => <option key={c.id} value={cityLabel(c)} />)}</datalist>
          <div className="search-opts">
            <label>Ready from <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            <label className="check"><input type="checkbox" checked={wide} onChange={e => setWide(e.target.checked)} /> Include drivers up to 160 mi off route</label>
          </div>
          <button className="btn primary" type="submit">Find trucks</button>
          {searchError && <p className="error">{searchError}</p>}
          <div className="quick-lanes">
            {[['nyc', 'denver'], ['los-angeles', 'chicago'], ['miami', 'boston'], ['seattle', 'dallas'], ['atlanta', 'phoenix']].map(([a, b]) => {
              const A = CITIES.find(c => c.id === a)!, B = CITIES.find(c => c.id === b)!;
              return <button type="button" key={a + b} onClick={() => { setFromText(cityLabel(A)); setToText(cityLabel(B)); setSearch({ from: A, to: B }); setSelectedId(null); setSearchError(null); setParams({ from: cityLabel(A), to: cityLabel(B) }, { replace: true }); }}>{A.name} → {B.name}</button>;
            })}
          </div>
        </form>

        <div className="results">
          {search ? (
            <>
              <div className="results-head">
                <b>{matches.length} truck{matches.length === 1 ? '' : 's'}</b> heading {search.from.name} → {search.to.name}
                {search && <button className="link-btn" onClick={() => { setSearch(null); setParams({}, { replace: true }); }}>Clear</button>}
              </div>
              {matches.length === 0 && (
                <div className="empty">
                  <p>No SquadREN drivers pass both cities in the next few days.</p>
                  {!wide && <button className="btn ghost sm" onClick={() => setWide(true)}>Widen to 160 mi off route</button>}
                </div>
              )}
              {matches.map(m => <ResultCard key={m.driver.id} driver={m.driver} match={m} now={now} sqft={cargoFor(m.driver).sqft} active={m.driver.id === selectedId} onClick={() => setSelectedId(m.driver.id)} />)}
            </>
          ) : (
            <>
              <div className="results-head"><b>Trucks near you</b>{myCity && <span className="muted"> · around {myCity.name}</span>}</div>
              {nearby.map(({ d, dist }) => <ResultCard key={d.id} driver={d} now={now} sqft={cargoFor(d).sqft} dist={dist} active={d.id === selectedId} onClick={() => setSelectedId(d.id)} />)}
            </>
          )}
        </div>
      </div>

      <div className="find-map">
        <NetworkMap trucks={trucks} selectedId={selectedId} onSelect={setSelectedId} pins={pins} showRoutes="all" fitTo={fitTo} />
        <div className="map-legend">
          <span><i style={{ background: STATUS_COLOR.driving }} />Live truck</span>
          <span><i className="line" />Itinerary</span>
          <span className="muted">{drivers.length} trucks on network</span>
        </div>
      </div>

      {selected && (
        <DriverSheet driver={selected} match={selectedMatch} cargo={cargoFor(selected)} now={now} onClose={() => setSelectedId(null)} onBook={() => setBooking(true)} />
      )}
      {selected && booking && (
        <BookingWizard driver={selected} cargo={cargoFor(selected)} match={selectedMatch} search={search} myPos={pos} now={now} onClose={() => setBooking(false)} />
      )}
    </div>
  );
}

function ResultCard({ driver, match, now, sqft, dist, active, onClick }: { driver: Driver; match?: Match; now: number; sqft: number; dist?: number; active: boolean; onClick: () => void }) {
  const live = liveState(driver, now);
  const trailer = trailerOf(driver.cargo);
  const pct = Math.min(1, sqft / (trailer.length * trailer.width));
  return (
    <button className={`result ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="result-truck"><TruckImage spec={driver.truck} /></div>
      <div className="result-main">
        <div className="result-top">
          <DriverAvatar driver={driver} size={28} />
          <b>{driver.name}</b>
          <Stars rating={driver.rating} />
        </div>
        <div className="result-sub">{truckTitle(driver.truck)} · {trailer.name}</div>
        {match ? (
          <div className="result-eta">
            <span><i className="pin a sm">A</i>{fmtWhen(match.pickupEta)}</span>
            <span><i className="pin b sm">B</i>{fmtWhen(match.dropoffEta)}</span>
          </div>
        ) : (
          <div className="result-eta">
            <span style={{ color: STATUS_COLOR[live.status] }}>● {live.status === 'driving' && live.nextStop ? `→ ${live.nextStop.name}` : STATUS_LABEL[live.status]}</span>
            {dist !== undefined && <span className="muted">{Math.round(dist)} mi away</span>}
          </div>
        )}
        <div className="space-bar" title={`${Math.round(sqft)} sq ft open`}>
          <i style={{ width: `${pct * 100}%` }} /><span>{Math.round(sqft)} sq ft open</span>
        </div>
      </div>
    </button>
  );
}
