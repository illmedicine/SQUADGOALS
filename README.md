# Squad REN

**Reputable Engagement Network.** Squad REN is a play on *squadron* — a tight
crew moving together — and the REN acronym is the mission: build real
communities, and a real local economy, around the places people actually go.

**Short version:** Squad REN is the **live-presence social map**. It's what
*Bump* would be if it grew up — Bump-style "see who's nearby and 👋 say hi"
discovery, plus **squads** to actually roll with and a **local marketplace**
baked into every profile.

Squad REN is a social-map platform with three audiences in one app:

- **Squadders** see who's live around them right now, wave hello with a tap,
  become regulars at the spots they love, plan trips, drop reviews, and earn
  prestige for showing up.
- **Local businesses & venues** target active squads in their area with
  exclusive deals, early invites, and pop-up promotions — because the most
  valuable customer is the one who keeps showing up.
- **Creators, freelancers, and side-hustlers** get a personal Squad REN
  storefront on their profile to promote their products, services, and
  squad-only offers to the people physically around them.

Think *Bump* meets *Snapchat Map* meets *Yelp* meets a local-business
marketplace — with squads, trip planning, real-world prestige, and live
presence on top.

## Why Squad REN vs. Bump

Bump nailed the gesture: a single map of strangers nearby, no friend graph,
no DMs, just "is anyone around?". Squad REN keeps that gesture (👋 Wave) and
adds the three things Bump intentionally leaves out:

1. **Squads** — a group identity so you can roll with your crew, not just
   solo-discover strangers.
2. **Storefronts** — every profile is a mini marketplace, so when you wave at
   someone you instantly see what they do, sell, or host.
3. **Prestige** — showing up at real places compounds into a tier that
   unlocks perks at local venues. Reputation is built on physical presence,
   not followers.

Squad REN ships two ways from one codebase:

1. **Web prototype / PWA** — deployed to GitHub Pages for fast iteration on
   any device.
2. **Native Android app** — the same web code wrapped with Capacitor; produces
   an `.aab` for the Play Store.

## The pillars

- 📍 **See who's live around you.** A real-time map of every Squad REN user
  nearby. Tap any avatar to fly to them, see their storefront, and 👋 wave.
  No friend request, no DMs — just hello.
- ☕ **Become a regular.** Check in at the places you frequent — coffee shops,
  bars, gyms, gas stations. Other regulars see you on the map and a community
  forms around the spot.
- 🛍️ **Your personal storefront.** Every profile doubles as a mini storefront.
  Promote your shop, service, freelance gig, or creator hustle with products,
  prices, and squad-only offers — discoverable by the squadders around you.
- 🎁 **Local-business promos for squads.** Venues and businesses can target
  active squads with exclusive deals, invites, and pop-ups for the regulars
  who actually walk in the door.
- 🧭 **Plan trips, track them live.** Build a multi-stop trip in advance,
  then physically check into each stop from your phone to earn achievements.
  Squad-mates watch your path draw across the map in real time.
- ⭐ **Real reviews from real people.** Drop a public pin anywhere. Squad-mates
  and strangers leave ratings and comments — powered by people who keep
  coming back, not paid placements.
- 👥 **Squads built around you.** Create a squad, pin its HQ on the map, pick
  a tier-gated crest, and tag your interests. Discover other public squads
  near you or sharing your vibe — request to join, leader approves.

## Feature inventory

- 🔐 Google Sign-In via Firebase Auth (with Demo Mode fallback)
- 🗺️ Google Maps with live squad positions, public people, public pins, and
  500 seeded demo squads to make the world feel alive
- 🛍️ Per-user storefront on the profile page (kind, bio, items, prices,
  squad-only offer, visibility toggle)
- 👥 Public / private squads with crests, HQ pins, interest tags, and
  leader-approved join requests
- 📍 Real-time presence using the browser Geolocation API
- 🛤️ Daily path history (last 7 days, opt-in, per-day visibility)

- 🔐 Google Sign-In via Firebase Auth (with Demo Mode fallback)
- 🗺️ Google Maps with live squad positions, public people, public pins, and
  500 seeded demo squads to make the world feel alive
- 🛍️ Per-user storefront on the profile page (kind, bio, items, prices,
  squad-only offer, visibility toggle)
- 👥 Public / private squads with crests, HQ pins, interest tags, and
  leader-approved join requests
- 📍 Real-time presence using the browser Geolocation API
- 🛤️ Daily path history (last 7 days, opt-in, per-day visibility)
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
