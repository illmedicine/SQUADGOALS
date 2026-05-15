# Squad REN

**Reputable Engagement Network.** Squad REN is a play on *squadron* — a tight
crew moving together — and the REN acronym is the mission: grow real
communities around the places people actually go to.

Become a regular at your coffee shop, your gym, your favorite bar, your
gas station. Check in publicly so the other regulars know you're around.
Plan trips with stops, check into each one to earn achievements, and let
your squad watch your journey cross the map in real time.

Under the hood it's also what you get when you mash up Google Timeline,
Yelp, and Snapchat Map — with squads, trips, and live presence on top.

Squad REN ships two ways from one codebase:

1. **Web prototype / PWA** — deployed to GitHub Pages for fast iteration on
   any device.
2. **Native Android app** — the same web code wrapped with Capacitor; produces
   an `.aab` for the Play Store.

## The pillars

- ☕ **Become a regular.** Check in at the places you frequent — coffee shops,
  bars, gyms, gas stations. Other regulars see you on the map and a community
  forms around the spot.
- 🧭 **Plan trips, track them live.** Build a multi-stop trip in advance,
  then physically check into each stop from your phone to earn achievements.
  Squad-mates watch your path draw across the map in real time.
- ⭐ **Real reviews from real people.** Drop a public pin anywhere. Squad-matesty
  forms around the spot.
- 🧭 **Plan trips, track them live.** Build a multi-stop trip in advance,
  then physically check into each stop from your phone to earn achievements.
  Squad-mates watch your path draw across the map in real time.
- ⭐ **Real reviews from real people.** Drop a public pin anywhere. Squad-mates
  public sharing to appear on the world map alongside everyone else who
  opted in. Snap-Map vibes, your rules.
- 👥 **Squads built around you.** Create a squad, pin its HQ on the map, pick
  a tier-gated crest, and tag your interests. Discover other public squads
  near you or sharing your vibe — request to join, leader approves.

## Feature inventory

- 🔐 Google Sign-In via Firebase Auth (with Demo Mode fallback)
- 🗺️ Google Maps with live squad positions, public people, public pins, and
  500 seeded demo squads to make the world feel alive
- 👥 Public / private squads with crests, HQ pins, interest tags, and
  leader-approved join requests
- 📍 Real-time presence using the browser Geolocation API
- 📅 Google Timeline import (Records.json, Semantic Location History, or new
  Timeline.json) — bulk pin everywhere you've been
- 🏆 7-tier prestige system (Rookie → Mythic) that unlocks 24 squad crests
  and avatar accessories as you and your squad earn XP
- 🙂 Customizable Toca-style cartoon avatar — doubles as your map marker
- 📱 PWA + offline shell, ready for Capacitor → Android AAB

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

### Suggested Firestore rules (starter)

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
2. In **Settings → Pages**, set source to **GitHub Actions**.
3. Add your `VITE_*` keys under **Settings → Secrets and variables → Actions**.
4. The site will be served at `https://<user>.github.io/SQUADGOALS/`.

> The Vite `base` is set to `/SQUADGOALS/`. Update `REPO` in `vite.config.ts`
> if you rename the repository.

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

## Project layout

```
src/
  components/      Avatar, NavBar
  lib/             firebase, auth, data, geo, badges, useLocation
  pages/           Login, Map, Squads, Avatar, Badges, Profile, VisitedPlaces
public/            PWA icons + favicon
.github/workflows/ GitHub Pages deploy
capacitor.config.ts
```

## Security notes

- Never commit `.env.local` or any API keys.
- Restrict the Google Maps key by referrer + Android package name.
- Restrict the Firebase API key in the Google Cloud Console.
- The starter Firestore rules above require auth on every read/write — adapt
  them before going to production (e.g., enforce squad membership for
  presence reads).
