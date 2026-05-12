# Squad REN

Find your friends in any crowd. Share precise location with your squads, earn
proximity badges for staying close, and see a live map of where your crew
hangs out.

Squad REN is a single codebase that ships two ways:

1. **Web prototype / PWA** — deployed to GitHub Pages for fast iteration on
   any device.
2. **Native Android app** — the same web code wrapped with Capacitor; produces
   an `.aab` for the Play Store.

## Features (prototype)

- 🔐 Google Sign-In via Firebase Auth (with Demo Mode fallback)
- 🗺️ Google Maps with live squad positions and visited-places overlay
- 👥 Public / private squads with join codes
- 📍 Real-time presence using the browser Geolocation API
- 🏆 Proximity badge engine (First Link → Prestige III)
- 🙂 Customizable Toca-style cartoon avatar (SVG)
- ☕ Visited-Places check-ins (Snap-Map-style activity feed)
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
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    match /squads/{id} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null &&
        request.auth.uid in resource.data.members;
    }
    match /presence/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    match /visitedPlaces/{id} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }
  }
}
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
