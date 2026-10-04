// Driver onboarding + editor: rig (make / model / year / paint), trailer and
// open space, the journey, and profile. New drivers walk through it as a
// wizard; returning drivers get the same screens as tabs.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useDeviceLocation } from '../lib/LocationContext';
import { saveDriver, useDriver } from '../lib/freight/store';
import { TRUCK_MAKES, MAKE_BY_ID, PAINT_COLORS, PAINT_BY_ID, yearsFor, findModel, truckTitle, type TruckSpec } from '../lib/freight/trucks';
import { TRAILERS, TRAILER_BY_ID, fmtFt, type CargoSpace } from '../lib/freight/cargo';
import { CITIES, CITY_BY_ID, cityLabel, findCity, nearestCity } from '../lib/freight/cities';
import { routeGeom, durationMs, fmtDuration, fmtWhen } from '../lib/freight/route';
import { stopEtas } from '../lib/freight/network';
import { haversine } from '../lib/geo';
import { suggestRoute } from '../lib/freight/routing';
import type { Driver } from '../lib/freight/types';
import TruckImage from '../components/freight/TruckImage';
import CargoVisualizer from '../components/freight/CargoVisualizer';
import NetworkMap from '../components/freight/NetworkMap';
import { routeColor } from '../components/freight/ui';

type Step = 'truck' | 'cargo' | 'trip' | 'profile';
const STEPS: { id: Step; label: string; icon: string }[] = [
  { id: 'truck', label: 'Your rig', icon: '🚛' },
  { id: 'cargo', label: 'Trailer & space', icon: '📐' },
  { id: 'trip', label: 'Your trip', icon: '🗺️' },
  { id: 'profile', label: 'Profile', icon: '🪪' },
];

const suggestVia = (from: string, to: string) => suggestRoute(from, to).slice(1, -1);

const toLocalInput = (t: number) => {
  const d = new Date(t);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function DriverSetupPage() {
  const { user } = useAuth();
  const existing = useDriver(user?.uid);
  // Remount once a remote profile arrives so the form starts from saved values.
  return <DriverSetup key={existing ? 'existing' : 'new'} existing={existing} />;
}

function DriverSetup({ existing }: { existing: Driver | null }) {
  const { user } = useAuth();
  const { pos } = useDeviceLocation();
  const nav = useNavigate();
  const isNew = !existing;
  const home = pos ? nearestCity(pos) : CITY_BY_ID['chicago'];

  const [step, setStep] = useState<Step>('truck');
  const [truck, setTruck] = useState<TruckSpec>(() => existing?.truck ?? { makeId: 'peterbilt', model: '579', year: 2024, colorId: 'red' });
  const [cargo, setCargo] = useState<CargoSpace>(() => existing?.cargo ?? { trailerId: 'dryvan53', sqft: 200, maxWeight: 15000 });
  const [stops, setStops] = useState<string[]>(() => existing?.itinerary?.stops ?? [home.id, ...suggestVia(home.id, home.id === 'denver' ? 'chicago' : 'denver'), home.id === 'denver' ? 'chicago' : 'denver']);
  const [departAt, setDepartAt] = useState<number>(() => existing?.itinerary && !existing.itinerary.repeatEveryMs && existing.itinerary.departAt > Date.now() - 86_400_000 * 7 ? existing.itinerary.departAt : Date.now() + 2 * 3_600_000);
  const [bio, setBio] = useState(existing?.bio ?? '');
  const [years, setYears] = useState(existing?.yearsDriving ?? 5);
  const [mc, setMc] = useState(existing?.mcNumber ?? '');
  const [usePhoto, setUsePhoto] = useState(!!existing?.truck.photoDataUrl);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const make = MAKE_BY_ID[truck.makeId];
  const model = findModel(truck) ?? make.models[0];
  const trailer = TRAILER_BY_ID[cargo.trailerId];
  const maxSqft = Math.round(trailer.length * trailer.width);

  const setMake = (id: string) => {
    const m = MAKE_BY_ID[id].models[0];
    setTruck(t => ({ ...t, makeId: id, model: m.name, year: Math.min(m.years[1], Math.max(m.years[0], t.year)) }));
  };
  const setModel = (name: string) => {
    const m = make.models.find(x => x.name === name)!;
    setTruck(t => ({ ...t, model: name, year: Math.min(m.years[1], Math.max(m.years[0], t.year)) }));
  };

  const onPhoto = (file: File | undefined) => {
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1400 / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      setTruck(t => ({ ...t, photoDataUrl: c.toDataURL('image/jpeg', 0.82) }));
      setUsePhoto(true);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const geom = useMemo(() => stops.length >= 2 ? routeGeom(stops) : null, [stops.join('>')]);
  const preview: Driver | null = user ? {
    id: user.uid,
    name: user.displayName,
    photoURL: user.photoURL,
    avatarColor: '#f97316',
    homeBase: stops[0] ?? home.id,
    rating: existing?.rating ?? 5,
    tripsCompleted: existing?.tripsCompleted ?? 0,
    yearsDriving: years,
    bio,
    mcNumber: mc || undefined,
    truck: usePhoto ? truck : { ...truck, photoDataUrl: truck.photoDataUrl },
    cargo,
    itinerary: stops.length >= 2 ? { stops, departAt } : null,
    online: existing?.online ?? true,
    booked: existing?.booked,
  } : null;
  const journey = geom ? { departAt, arriveAt: departAt + durationMs(geom.totalMiles), geom } : null;

  async function save(goLive = false) {
    if (!preview) return;
    setSaving(true);
    const toSave: Driver = { ...preview, truck: usePhoto ? truck : { ...truck, photoDataUrl: undefined } };
    if (!usePhoto) delete toSave.truck.photoDataUrl;
    await saveDriver(toSave);
    setSaving(false);
    if (goLive || isNew) nav('/');
    else { setSavedMsg('Saved ✓'); setTimeout(() => setSavedMsg(null), 2000); }
  }

  const idx = STEPS.findIndex(s => s.id === step);
  const tripValid = stops.length >= 2 && stops[0] !== stops[stops.length - 1];

  return (
    <div className="setup">
      <div className="setup-head">
        <h1>{isNew ? 'Set up your rig' : 'My rig & trip'}</h1>
        <div className="stepper big">
          {STEPS.map((s, i) => (
            <button key={s.id} type="button" className={`step ${s.id === step ? 'on' : ''} ${i < idx && isNew ? 'done' : ''}`} onClick={() => (!isNew || i <= idx) && setStep(s.id)}>
              <span>{isNew && i < idx ? '✓' : s.icon}</span>{s.label}
            </button>
          ))}
        </div>
      </div>

      {step === 'truck' && (
        <div className="setup-grid">
          <div className="truck-stage">
            <TruckImage spec={usePhoto ? truck : { ...truck, photoDataUrl: undefined }} className="stage-truck" />
            <div className="stage-caption">
              <b>{truckTitle(truck)}</b>
              <span><i className="swatch" style={{ background: PAINT_BY_ID[truck.colorId]?.hex }} /> {PAINT_BY_ID[truck.colorId]?.name}</span>
            </div>
          </div>
          <div className="form-col">
            <label>Make
              <select value={truck.makeId} onChange={e => setMake(e.target.value)}>
                {TRUCK_MAKES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <div className="make-strip">
              {TRUCK_MAKES.map(m => (
                <button key={m.id} type="button" className={m.id === truck.makeId ? 'on' : ''} onClick={() => setMake(m.id)} style={{ ['--accent' as any]: m.accent }}>{m.name}</button>
              ))}
            </div>
            <div className="row2">
              <label>Model
                <select value={model.name} onChange={e => setModel(e.target.value)}>
                  {make.models.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              </label>
              <label>Year
                <select value={truck.year} onChange={e => setTruck(t => ({ ...t, year: +e.target.value }))}>
                  {yearsFor(model).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
            </div>
            <label>Color
              <select value={truck.colorId} onChange={e => setTruck(t => ({ ...t, colorId: e.target.value }))}>
                {PAINT_COLORS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div className="swatches">
              {PAINT_COLORS.map(c => (
                <button key={c.id} type="button" title={c.name} aria-label={c.name} className={c.id === truck.colorId ? 'on' : ''} style={{ background: c.hex }} onClick={() => setTruck(t => ({ ...t, colorId: c.id }))} />
              ))}
            </div>
            <div className="photo-box">
              <label className="upload">
                📷 {truck.photoDataUrl ? 'Replace photo of my truck' : 'Upload a photo of my actual truck (optional)'}
                <input type="file" accept="image/*" onChange={e => onPhoto(e.target.files?.[0])} hidden />
              </label>
              {truck.photoDataUrl && (
                <label className="check"><input type="checkbox" checked={usePhoto} onChange={e => setUsePhoto(e.target.checked)} /> Show my photo instead of the illustration</label>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 'cargo' && (
        <div className="setup-stack">
          <div className="trailer-tiles">
            {TRAILERS.map(t => (
              <button key={t.id} type="button" className={t.id === cargo.trailerId ? 'on' : ''}
                onClick={() => setCargo(c => ({ ...c, trailerId: t.id, sqft: Math.min(c.sqft, Math.round(t.length * t.width)), maxWeight: Math.min(c.maxWeight, t.maxWeight) }))}>
                <span>{t.icon}</span><b>{t.name}</b><small>{fmtFt(t.length)} × {fmtFt(t.width)} × {fmtFt(t.height)}</small>
              </button>
            ))}
          </div>
          <div className="space-controls">
            <label>
              <span>Open floor space <b>{cargo.sqft} sq ft</b> <em>({fmtFt(cargo.sqft / trailer.width)} of deck)</em></span>
              <input type="range" min={0} max={maxSqft} step={1} value={cargo.sqft} onChange={e => setCargo(c => ({ ...c, sqft: +e.target.value }))} />
            </label>
            <label className="num">sq ft<input type="number" min={0} max={maxSqft} value={cargo.sqft} onChange={e => setCargo(c => ({ ...c, sqft: Math.max(0, Math.min(maxSqft, +e.target.value || 0)) }))} /></label>
            <label>
              <span>Payload available <b>{cargo.maxWeight.toLocaleString()} lbs</b></span>
              <input type="range" min={0} max={trailer.maxWeight} step={250} value={cargo.maxWeight} onChange={e => setCargo(c => ({ ...c, maxWeight: +e.target.value }))} />
            </label>
            <div className="quick-space">
              {[0.25, 0.5, 0.75, 1].map(f => <button key={f} type="button" onClick={() => setCargo(c => ({ ...c, sqft: Math.round(maxSqft * f) }))}>{f === 1 ? 'Empty trailer' : `${f * 100}% open`}</button>)}
            </div>
          </div>
          <div className="panel">
            <h3>What shippers will see</h3>
            <CargoVisualizer cargo={cargo} />
          </div>
        </div>
      )}

      {step === 'trip' && (
        <div className="setup-grid trip">
          <div className="form-col">
            <TripEditor stops={stops} setStops={setStops} homeId={home.id} />
            <label>Departure
              <input type="datetime-local" value={toLocalInput(departAt)} onChange={e => setDepartAt(new Date(e.target.value).getTime())} />
            </label>
            {journey && (
              <div className="trip-summary">
                <b>{Math.round(journey.geom.totalMiles).toLocaleString()} mi</b> · about {fmtDuration(journey.arriveAt - departAt)} with HOS rest breaks · arrive {fmtWhen(journey.arriveAt)}
              </div>
            )}
            {journey && (
              <ol className="timeline compact">
                {stopEtas(journey).map((s, i) => (
                  <li key={i}><span className="tl-dot" /><span className="tl-city">{s.city.name}, {s.city.state}</span><span className="tl-eta">{fmtWhen(s.eta)}</span></li>
                ))}
              </ol>
            )}
          </div>
          <div className="trip-map">
            <NetworkMap
              trucks={preview && geom ? [{ id: preview.id, pos: geom.points[0], heading: 90, color: routeColor(preview.id), label: 'You', route: geom.points }] : []}
              selectedId={preview?.id}
              showRoutes="all"
              pins={geom ? [{ pos: geom.stops[0], kind: 'pickup' }, { pos: geom.stops[geom.stops.length - 1], kind: 'dropoff' }] : []}
              fitTo={geom ? geom.stops : null}
            />
          </div>
        </div>
      )}

      {step === 'profile' && (
        <div className="setup-grid">
          <div className="form-col">
            <label>Display name<input value={user?.displayName ?? ''} disabled /><small>From your Google account</small></label>
            <label>About you & your hauling<textarea rows={4} value={bio} onChange={e => setBio(e.target.value)} placeholder="e.g. 15 years OTR, blanket-wrap furniture, motorcycles welcome…" maxLength={280} /></label>
            <div className="row2">
              <label>Years driving<input type="number" min={0} max={60} value={years} onChange={e => setYears(Math.max(0, +e.target.value || 0))} /></label>
              <label>MC / DOT number<input value={mc} onChange={e => setMc(e.target.value)} placeholder="MC-123456" /></label>
            </div>
          </div>
          <div className="truck-stage small">
            <TruckImage spec={usePhoto ? truck : { ...truck, photoDataUrl: undefined }} trailerId={cargo.trailerId} showTrailer={!usePhoto} />
            <div className="stage-caption"><b>{user?.displayName}</b><span>{truckTitle(truck)}</span></div>
          </div>
        </div>
      )}

      <div className="setup-foot">
        {isNew ? (
          <>
            {idx > 0 ? <button className="btn ghost" onClick={() => setStep(STEPS[idx - 1].id)}>← Back</button> : <span />}
            {idx < STEPS.length - 1
              ? <button className="btn primary" disabled={step === 'trip' && !tripValid} onClick={() => setStep(STEPS[idx + 1].id)}>Next: {STEPS[idx + 1].label} →</button>
              : <button className="btn primary" disabled={saving || !tripValid} onClick={() => save(true)}>{saving ? 'Saving…' : '🚀 Go live on the network'}</button>}
          </>
        ) : (
          <>
            <span className="muted">{savedMsg}</span>
            <button className="btn primary" disabled={saving || !tripValid} onClick={() => save()}>{saving ? 'Saving…' : 'Save changes'}</button>
          </>
        )}
      </div>
    </div>
  );
}

function TripEditor({ stops, setStops, homeId }: { stops: string[]; setStops: (s: string[]) => void; homeId: string }) {
  const [add, setAdd] = useState('');
  const origin = stops[0] ?? homeId;
  const dest = stops[stops.length - 1] ?? '';
  const via = stops.slice(1, -1);
  const setEnds = (o: string, d: string) => setStops(o && d ? [o, ...suggestVia(o, d), d] : [o || homeId]);

  return (
    <div className="trip-editor">
      <div className="row2">
        <label>From
          <select value={origin} onChange={e => setEnds(e.target.value, dest)}>
            {CITIES.map(c => <option key={c.id} value={c.id}>{cityLabel(c)}</option>)}
          </select>
        </label>
        <label>To
          <select value={dest} onChange={e => setEnds(origin, e.target.value)}>
            {CITIES.map(c => <option key={c.id} value={c.id}>{cityLabel(c)}</option>)}
          </select>
        </label>
      </div>
      <div className="via">
        <small>Passing through (shippers near these cities can book you)</small>
        <div className="chips">
          {via.map((id, i) => (
            <span key={id + i} className="chip">
              {CITY_BY_ID[id]?.name}
              <button type="button" aria-label={`Remove ${CITY_BY_ID[id]?.name}`} onClick={() => setStops([origin, ...via.filter((_, j) => j !== i), dest])}>×</button>
            </span>
          ))}
          {via.length === 0 && <span className="muted">Direct</span>}
        </div>
        <form className="add-via" onSubmit={e => {
          e.preventDefault();
          const c = findCity(add);
          if (!c || stops.includes(c.id)) return;
          // Insert where it adds the least distance.
          let best = 1, bestCost = Infinity;
          for (let i = 1; i < stops.length; i++) {
            const a = CITY_BY_ID[stops[i - 1]], b = CITY_BY_ID[stops[i]];
            const cost = haversine(a, c) + haversine(c, b) - haversine(a, b);
            if (cost < bestCost) { bestCost = cost; best = i; }
          }
          setStops([...stops.slice(0, best), c.id, ...stops.slice(best)]);
          setAdd('');
        }}>
          <input list="via-cities" value={add} onChange={e => setAdd(e.target.value)} placeholder="Add a stop…" />
          <datalist id="via-cities">{CITIES.map(c => <option key={c.id} value={cityLabel(c)} />)}</datalist>
          <button className="btn ghost sm" type="submit">Add</button>
          <button className="btn ghost sm" type="button" onClick={() => setEnds(origin, dest)}>Auto-route</button>
        </form>
      </div>
    </div>
  );
}
