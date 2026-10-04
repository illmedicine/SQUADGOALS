import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { firebaseConfigured } from '../lib/firebase';
import type { Role } from '../lib/freight/types';
import { SEED_DRIVERS } from '../lib/freight/seed';
import { findMatches, liveState } from '../lib/freight/network';
import { findCity, cityLabel, CITIES } from '../lib/freight/cities';
import { fmtWhen } from '../lib/freight/route';
import { useNow } from '../lib/freight/store';
import NetworkMap from '../components/freight/NetworkMap';
import TruckImage from '../components/freight/TruckImage';
import CargoVisualizer from '../components/freight/CargoVisualizer';
import { DriverAvatar, GoogleG, toMapTruck } from '../components/freight/ui';
import { truckTitle, type TruckSpec } from '../lib/freight/trucks';

const SHOWCASE: (TruckSpec & { trailer: string })[] = [
  { makeId: 'peterbilt', model: '389', year: 2024, colorId: 'red', trailer: 'dryvan53' },
  { makeId: 'freightliner', model: 'Cascadia', year: 2025, colorId: 'white', trailer: 'reefer53' },
  { makeId: 'kenworth', model: 'W900L', year: 2023, colorId: 'black', trailer: 'flatbed48' },
  { makeId: 'volvo', model: 'VNL 860', year: 2025, colorId: 'blue', trailer: 'dryvan53' },
  { makeId: 'mack', model: 'Anthem', year: 2024, colorId: 'yellow', trailer: 'conestoga53' },
  { makeId: 'tesla', model: 'Semi', year: 2025, colorId: 'silver', trailer: 'dryvan53' },
];

export default function LandingPage() {
  const { signIn, signInDemo, error } = useAuth();
  const now = useNow(3000);
  const [demoName, setDemoName] = useState('');
  const [from, setFrom] = useState('New York, NY');
  const [to, setTo] = useState('Denver, CO');
  const [showcase, setShowcase] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setShowcase(i => (i + 1) % SHOWCASE.length), 3800);
    return () => clearInterval(t);
  }, []);

  const trucks = useMemo(() => SEED_DRIVERS.map(d => toMapTruck(d, now)), [now]);
  const driving = useMemo(() => SEED_DRIVERS.filter(d => liveState(d, now).status === 'driving').length, [now]);
  const fromCity = findCity(from), toCity = findCity(to);
  const matches = useMemo(() => fromCity && toCity ? findMatches(SEED_DRIVERS, fromCity, toCity, { now }) : [], [fromCity?.id, toCity?.id, Math.floor(now / 60000)]);

  const go = (role: Role) => {
    if (firebaseConfigured) signIn(role);
    else signInDemo(demoName, role);
  };
  const sc = SHOWCASE[showcase];

  return (
    <div className="landing">
      <header className="land-nav">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <span>Squad<b>REN</b></span>
        </div>
        <nav>
          <a href="#ship">Ship</a>
          <a href="#drive">Drive</a>
          <a href="#how">How it works</a>
          <button className="btn ghost sm" onClick={() => go('shipper')}>Sign in</button>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-map" aria-hidden>
          <NetworkMap trucks={trucks} offline showRoutes="all" />
        </div>
        <div className="hero-copy">
          <span className="live-pill"><i /> {SEED_DRIVERS.length} trucks on the network · {driving} rolling right now</span>
          <h1>Ship it on a truck that’s <span className="grad">already going there.</span></h1>
          <p>
            SquadREN is the nationwide network of independent 18-wheeler drivers selling the open space on
            their trailers. See every truck live, search your lane, and book the exact square footage you need.
          </p>

          <form className="lane-search" onSubmit={e => { e.preventDefault(); document.getElementById('lane-results')?.scrollIntoView({ behavior: 'smooth' }); }}>
            <label><span>From</span><input list="land-cities" value={from} onChange={e => setFrom(e.target.value)} placeholder="City (e.g. NYC)" /></label>
            <span className="lane-arrow">→</span>
            <label><span>To</span><input list="land-cities" value={to} onChange={e => setTo(e.target.value)} placeholder="City (e.g. Denver)" /></label>
            <button className="btn primary" type="submit">Search</button>
            <datalist id="land-cities">{CITIES.map(c => <option key={c.id} value={cityLabel(c)} />)}</datalist>
          </form>

          <div id="lane-results" className="lane-teaser">
            {!fromCity || !toCity ? (
              <p className="muted">Type two cities — try “NYC” to “Denver”.</p>
            ) : matches.length === 0 ? (
              <p className="muted">No trucks on {fromCity.name} → {toCity.name} this week yet. Sign in to post a request and get notified.</p>
            ) : (
              <>
                <p><b>{matches.length} driver{matches.length > 1 ? 's' : ''}</b> passing {fromCity.name} → {toCity.name} soon:</p>
                <ul>
                  {matches.slice(0, 3).map(m => (
                    <li key={m.driver.id}>
                      <DriverAvatar driver={m.driver} size={32} />
                      <span className="lt-name">{m.driver.name}</span>
                      <span className="lt-when">Pickup {fmtWhen(m.pickupEta)}</span>
                      <span className="lt-space">{m.driver.cargo.sqft} sq ft open</span>
                    </li>
                  ))}
                </ul>
                <button className="btn primary sm" onClick={() => go('shipper')}>Sign in to book a spot →</button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="doors">
        <article id="ship" className="door shipper">
          <div className="door-tag">For shippers</div>
          <h2>Need something moved?</h2>
          <ul>
            <li>🗺️ Watch every SquadREN truck and its route in real time</li>
            <li>🔎 Search a lane like <b>NYC → Denver</b> and see who’s passing through, and when</li>
            <li>📐 Enter size & weight — we tell you instantly if it fits the driver’s space</li>
            <li>📍 Track your pickup and delivery live</li>
          </ul>
          <button className="btn google" onClick={() => go('shipper')}>
            {firebaseConfigured ? <><GoogleG /> Ship with Google</> : '📦 Enter as a shipper (demo)'}
          </button>
        </article>
        <article id="drive" className="door driver">
          <div className="door-tag">For drivers</div>
          <h2>Got empty space on your trailer?</h2>
          <ul>
            <li>💵 Turn deadhead and partial loads into paid miles</li>
            <li>🚛 Show off your rig — pick your make, model, year and paint</li>
            <li>📏 List your open square footage — shippers see exactly what fits</li>
            <li>✅ Accept only the loads that are on your route</li>
          </ul>
          <button className="btn google dark" onClick={() => go('driver')}>
            {firebaseConfigured ? <><GoogleG /> Drive with Google</> : '🚛 Enter as a driver (demo)'}
          </button>
        </article>
      </section>
      {!firebaseConfigured && (
        <div className="demo-name">
          <label>Demo name <input value={demoName} onChange={e => setDemoName(e.target.value)} placeholder="Your name (optional)" /></label>
          <small>Firebase isn’t configured in this build, so accounts are stored in this browser only.</small>
        </div>
      )}
      {error && <p className="error center-text">{error}</p>}
      <p className="loc-note">📍 Location access is required for both drivers and shippers so pickups and live tracking are accurate.</p>

      <section className="showcase">
        <div className="showcase-copy">
          <h2>Your rig, front and center.</h2>
          <p>Drivers pick their tractor from every major builder — Peterbilt, Kenworth, Freightliner, Volvo, Mack, International, Western Star, Tesla and more — then choose a model year and paint. Shippers see the exact truck that’s coming for their freight.</p>
          <div className="showcase-tag">{truckTitle(sc)}</div>
          <div className="dots">{SHOWCASE.map((_, i) => <button key={i} className={i === showcase ? 'on' : ''} onClick={() => setShowcase(i)} aria-label={`Show truck ${i + 1}`} />)}</div>
        </div>
        <div className="showcase-art">
          <TruckImage key={showcase} spec={sc} trailerId={sc.trailer} showTrailer className="fade-in" />
        </div>
      </section>

      <section className="fits-demo">
        <div>
          <h2>Square footage you can <em>see</em>.</h2>
          <p>A driver lists 220 sq ft open on a 53′ dry van. Here’s what that means — tap an item to load it.</p>
        </div>
        <CargoVisualizer cargo={{ trailerId: 'dryvan53', sqft: 220, maxWeight: 16000 }} />
      </section>

      <section id="how" className="how">
        <div>
          <h3>Shipping in 3 steps</h3>
          <ol>
            <li><b>Search your lane.</b> See every driver whose route passes your pickup and drop-off.</li>
            <li><b>Check the fit.</b> Enter dimensions & weight — the trailer diagram shows it loaded.</li>
            <li><b>Book & track.</b> The driver confirms, picks up, and you follow the truck live.</li>
          </ol>
        </div>
        <div>
          <h3>Driving in 3 steps</h3>
          <ol>
            <li><b>Set up your rig.</b> Make, model, year, color and trailer type.</li>
            <li><b>Post your trip.</b> Route, departure time and the space you have open.</li>
            <li><b>Accept loads.</b> Requests come in along your route — you choose what to haul.</li>
          </ol>
        </div>
      </section>

      <footer className="land-foot">
        <span>© {new Date().getFullYear()} SquadREN by illy robotic instruments</span>
        <Link to="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}
