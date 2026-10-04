# SquadREN — Shared-Space Freight

SquadREN is a nationwide freight network where **independent 18-wheeler
drivers sell the open space on their trailers** and **shippers book that space
on trucks already heading their way** — like uShip or Shiply, but built around
live driver itineraries.

## Two experiences, one app

**Shippers**
- Live map of every truck on the network and its itinerary.
- Lane search (e.g. *NYC → Denver*): lists every driver whose route passes
  near both points, with pickup and delivery ETAs.
- Driver profiles show the actual rig (make / model / year / color), trailer,
  rating, itinerary and a top-down diagram of the open cargo space.
- Booking wizard: pick an item (car, motorcycle, pallets, sofa…) or enter
  custom dimensions + weight; the app checks instantly whether it fits and
  shows it loaded in the trailer, then quotes a price.
- My Shipments: live tracking with status timeline.

**Drivers**
- Onboarding wizard: choose tractor make, model, model year and paint from
  dropdowns (Peterbilt, Kenworth, Freightliner, Volvo, Mack, International,
  Western Star, Tesla, Nikola, Hino, Sterling — 80+ models) with a rendered
  side-profile of the truck; optional real truck photo upload.
- Trailer type + open square footage + available payload, with a visual of
  what fits (e.g. "×2 cars", "×13 pallets").
- Trip builder with auto-routing along interstate corridors and HOS-aware ETAs.
- Dashboard: online/offline toggle, incoming requests with fit check,
  accept / decline, mark picked up / delivered, earnings.

Both roles sign in with Google and **must enable device location**.

The network is seeded with **50 demo owner-operators** on major interstate
corridors (`src/lib/freight/seed.ts`). Their positions are simulated from the
wall clock (11 h driving / 10 h rest cycles, out-and-back runs), so the map is
always alive and every popular lane has upcoming capacity. Bookings with
seeded drivers auto-confirm and progress with the clock.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in keys (optional — Demo Mode works without)
npm run dev
```

Open the URL Vite prints. Without env vars the app boots in **Demo Mode**
(local-only storage) so you can try every screen immediately.

## Required keys

1. **Google Maps JS API key** — `VITE_GOOGLE_MAPS_API_KEY`
   - Enable *Maps JavaScript API* in Google Cloud Console.
   - Restrict by HTTP referrer to your GH Pages URL + `http://localhost:*`.
2. **Firebase Web app config** — the six `VITE_FIREBASE_*` keys.
   - In Firebase Console enable **Authentication → Google** and create a
     **Firestore** database in production mode.

Example `.env.local`:

```
VITE_GOOGLE_MAPS_API_KEY=AIza...
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=squad-ren.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=squad-ren
VITE_FIREBASE_STORAGE_BUCKET=squad-ren.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
```

## Deploy to GitHub Pages

1. Push to `main`. The included workflow (`.github/workflows/deploy.yml`)
   builds and publishes to Pages automatically.
2. In **Settings → Pages**, set source to **GitHub Actions** and set the
   custom domain to `squad-ren.com`. Enable **Enforce HTTPS** once the cert
   provisions.
3. Add your `VITE_*` keys under **Settings → Secrets and variables → Actions**.
4. The site is served from `https://squad-ren.com`. A `public/CNAME` file
   keeps the custom domain pinned through every deploy.

> The Vite `base` is set to `/` for the apex domain. If you ever need to
> serve from a subpath again, edit `vite.config.ts`.

## Wrap as Android app (AAB)

Once the web prototype is stable:

```bash
npm install
npm run build
npx cap add android
npm run android:sync
npm run android:open   # opens Android Studio
```

In Android Studio:

- Add the runtime permissions to `android/app/src/main/AndroidManifest.xml`:
  - `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `INTERNET`.
- Add your **Google Maps API key** to the Android manifest (`meta-data` tag)
  if you later switch to native Google Maps. The current build uses the JS
  Maps API inside the WebView, so the same `VITE_GOOGLE_MAPS_API_KEY` is
  reused at build time.
- Configure signing under **Build → Generate Signed Bundle / APK → AAB**.

### Firestore rules

`firestore.rules` covers the `users`, `drivers` and `bookings` collections
and is referenced from `firebase.json`. Deploy changes with
`firebase deploy --only firestore:rules`. Without Firebase configured the app
falls back to browser-local storage.

Without `VITE_GOOGLE_MAPS_API_KEY` the app uses a built-in SVG map of the US.

## Project layout

```
src/
  components/freight/  TruckImage, CargoVisualizer, NetworkMap, DriverSheet,
                       BookingWizard, shared UI (header, location gate)
  lib/freight/         cities, trucks, cargo (fit + pricing), route (HOS time
                       model), network (live state + lane matching), routing,
                       seed (50 drivers), store (Firestore/local persistence)
  lib/                 firebase, AuthContext (roles), LocationContext, geo
  pages/               Landing, RolePicker, FindTruck, Shipments,
                       DriverDashboard, DriverSetup, Network, Privacy
public/                PWA icons + favicon
.github/workflows/ GitHub Pages deploy
capacitor.config.ts
```

## Security notes

- Never commit `.env.local` or any API keys.
- Restrict the Google Maps key by referrer + Android package name.
- Restrict the Firebase API key in the Google Cloud Console.
- Review `firestore.rules` before production.
