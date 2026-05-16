import {
  createContext, useContext, useEffect, useMemo, useState, ReactNode
} from 'react';
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, User, browserPopupRedirectResolver
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { recordSignIn } from './lifetimeStats';
import { auth, db, googleProvider, firebaseConfigured } from './firebase';

export type AppUser = {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  avatar?: AvatarConfig;
  storefront?: Storefront;
};

// Personal "storefront" — every user can promote what they offer (a small
// business, freelance service, side hustle, creator gig, or just the place
// they hang out). Surfaces on the profile page and is queryable later for
// squad-targeted promos / discovery. All fields optional; an empty object
// just means the user hasn't filled it in yet.
export type Storefront = {
  kind?: 'business' | 'creator' | 'service' | 'venue' | 'personal' | 'none';
  name?: string;                       // brand / shop name
  tagline?: string;                    // one-liner
  category?: string;                   // Coffee, Fitness, Tattoo, Music, etc.
  bio?: string;                        // longer description
  website?: string;
  instagram?: string;
  serviceArea?: string;                // "Brooklyn + lower Manhattan"
  offers?: string;                     // promo / discount line aimed at squads
  // Up to ~6 quick "products / services" pills for at-a-glance browsing.
  items?: Array<{ name: string; price?: string; note?: string }>;
  // Whether other squadders can see this storefront. Off by default until
  // the user explicitly opts in.
  visibility?: 'private' | 'squad' | 'public';
  updatedAt?: number;
};

export type AvatarConfig = {
  skin: string;
  hair: string;
  shirt: string;
  accessory: string;
  // New optional fields — older saved avatars stay valid.
  body?: 'masc' | 'fem' | 'neutral';
  hairStyle?: 'short' | 'long' | 'bun' | 'curly' | 'mohawk' | 'bald' | 'ponytail' | 'buzz';
  eyes?: string;
  pants?: string;
  shoes?: string;
  background?: string;
};

const defaultAvatar: AvatarConfig = {
  skin: '#f1c27d',
  hair: '#3b2417',
  shirt: '#7c3aed',
  accessory: 'none',
  body: 'neutral',
  hairStyle: 'short',
  eyes: '#1a1a1a',
  pants: '#1e293b',
  shoes: '#0f172a',
  background: '#fef3c7'
};
export { defaultAvatar };

// Best-effort current geolocation for the sign-in counter. Resolves quickly
// (or with nothing) so it never blocks auth.
function currentGeo(): Promise<{ lat?: number; lng?: number }> {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve({});
    let done = false;
    const finish = (v: { lat?: number; lng?: number }) => { if (!done) { done = true; resolve(v); } };
    navigator.geolocation.getCurrentPosition(
      p => finish({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => finish({}),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 60_000 }
    );
    setTimeout(() => finish({}), 4500);
  });
}

type Ctx = {
  user: AppUser | null;
  rawUser: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signInDemo: (name: string) => void;
  logout: () => Promise<void>;
  updateAvatar: (a: AvatarConfig) => Promise<void>;
  updateStorefront: (s: Storefront) => Promise<void>;
};

const AuthContext = createContext<Ctx>(null as unknown as Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [rawUser, setRawUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Demo mode: keep a fake user in localStorage when Firebase isn't configured.
  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      const cached = localStorage.getItem('squadren.demoUser');
      if (cached) setUser(JSON.parse(cached));
      setLoading(false);
      return;
    }
    // Pick up any pending redirect sign-in result first. Log loudly so we can
    // diagnose problems on the deployed site where DevTools is the only debug
    // surface available.
    console.log('[auth] checking for redirect result on boot…');
    getRedirectResult(auth)
      .then(res => {
        if (res?.user) {
          console.log('[auth] redirect sign-in succeeded:', res.user.email);
        } else {
          console.log('[auth] no pending redirect result');
        }
      })
      .catch(err => {
        console.error('[auth] getRedirectResult failed:', err);
        setError(`Redirect sign-in failed: ${err?.code || ''} ${err?.message || err}`);
      });
    const unsub = onAuthStateChanged(auth, async (u) => {
      setRawUser(u);
      if (!u) { setUser(null); setLoading(false); return; }
      try {
        const profile = await ensureProfile(u);
        setUser(profile);
        // Marketing counter: count this uid the first time we ever see them.
        // Geo is best-effort — we'll just count the user without a country if
        // location isn't available yet.
        const geo = await currentGeo();
        recordSignIn(u.uid, geo);
      } catch (err: any) {
        // Firestore unreachable (e.g. DB not created yet). Fall back to an
        // in-memory profile so the app still loads.
        console.warn('ensureProfile failed, using fallback:', err?.message);
        setError(err?.message || null);
        setUser({
          uid: u.uid,
          displayName: u.displayName || 'Friend',
          email: u.email,
          photoURL: u.photoURL,
          avatar: defaultAvatar
        });
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  async function ensureProfile(u: User): Promise<AppUser> {
    if (!db) return { uid: u.uid, displayName: u.displayName || 'Friend', email: u.email, photoURL: u.photoURL, avatar: defaultAvatar };
    const ref = doc(db, 'users', u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const profile: AppUser = {
        uid: u.uid,
        displayName: u.displayName || 'Friend',
        email: u.email,
        photoURL: u.photoURL,
        avatar: defaultAvatar
      };
      await setDoc(ref, { ...profile, createdAt: serverTimestamp() });
      return profile;
    }
    const data = snap.data() as AppUser;
    return { ...data, avatar: data.avatar || defaultAvatar };
  }

  async function signIn() {
    setError(null);
    if (!auth) { setError('Firebase not configured — use Demo Mode.'); return; }
    console.log('[auth] signIn() called. hostname=', window.location.hostname);
    // Try popup first everywhere. Popup works on GitHub Pages despite the COOP
    // header — the only side-effect is we can't detect manual popup close.
    // Fall back to redirect if popup is blocked or throws.
    try {
      console.log('[auth] attempting signInWithPopup…');
      const res = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
      console.log('[auth] popup sign-in succeeded:', res.user.email);
    } catch (e: any) {
      console.warn('[auth] popup failed, falling back to redirect:', e?.code, e?.message);
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') {
        setError('Sign-in cancelled.');
        return;
      }
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (err: any) {
        console.error('[auth] redirect sign-in also failed:', err);
        setError(`${err?.code || ''} ${err?.message || 'Sign-in failed'}`);
      }
    }
  }

  function signInDemo(name: string) {
    const demo: AppUser = {
      uid: 'demo-' + Math.random().toString(36).slice(2, 8),
      displayName: name || 'Demo Squadder',
      email: null,
      photoURL: null,
      avatar: defaultAvatar
    };
    localStorage.setItem('squadren.demoUser', JSON.stringify(demo));
    setUser(demo);
    currentGeo().then(geo => recordSignIn(demo.uid, geo));
  }

  async function logout() {
    localStorage.removeItem('squadren.demoUser');
    if (auth) await signOut(auth);
    setUser(null);
  }

  async function updateAvatar(a: AvatarConfig) {
    if (!user) return;
    const next = { ...user, avatar: a };
    setUser(next);
    if (db && rawUser) await setDoc(doc(db, 'users', rawUser.uid), { avatar: a }, { merge: true });
    else localStorage.setItem('squadren.demoUser', JSON.stringify(next));
  }

  // Persist storefront edits the same way as avatar — Firestore when we're
  // online, localStorage in demo mode. Stamped with `updatedAt` so the
  // discovery layer can sort by freshness later.
  async function updateStorefront(s: Storefront) {
    if (!user) return;
    const stamped: Storefront = { ...s, updatedAt: Date.now() };
    const next = { ...user, storefront: stamped };
    setUser(next);
    if (db && rawUser) {
      await setDoc(doc(db, 'users', rawUser.uid), { storefront: stamped }, { merge: true });
    } else {
      localStorage.setItem('squadren.demoUser', JSON.stringify(next));
    }
  }

  const value = useMemo<Ctx>(() => ({
    user, rawUser, loading, error, signIn, signInDemo, logout, updateAvatar, updateStorefront
  }), [user, rawUser, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
