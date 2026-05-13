import {
  createContext, useContext, useEffect, useMemo, useState, ReactNode
} from 'react';
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, User, browserPopupRedirectResolver
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, firebaseConfigured } from './firebase';

export type AppUser = {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  avatar?: AvatarConfig;
};

export type AvatarConfig = {
  skin: string;
  hair: string;
  shirt: string;
  accessory: string;
};

const defaultAvatar: AvatarConfig = {
  skin: '#f1c27d',
  hair: '#3b2417',
  shirt: '#7c3aed',
  accessory: 'none'
};

type Ctx = {
  user: AppUser | null;
  rawUser: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signInDemo: (name: string) => void;
  logout: () => Promise<void>;
  updateAvatar: (a: AvatarConfig) => Promise<void>;
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
    // Pick up any pending redirect sign-in result first.
    getRedirectResult(auth).catch(err => setError(err?.message || null));
    const unsub = onAuthStateChanged(auth, async (u) => {
      setRawUser(u);
      if (!u) { setUser(null); setLoading(false); return; }
      try {
        const profile = await ensureProfile(u);
        setUser(profile);
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
    // GitHub Pages sets a Cross-Origin-Opener-Policy that breaks popup window
    // tracking, so use the redirect flow on the deployed site and any non-
    // localhost origin. Popup is kept for `localhost` because it's faster
    // during local development.
    const isLocal = /^localhost$|^127\./i.test(window.location.hostname);
    try {
      if (isLocal) {
        await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
      } else {
        await signInWithRedirect(auth, googleProvider);
      }
    } catch (e: any) {
      try { await signInWithRedirect(auth, googleProvider); }
      catch (err: any) { setError(err.message || 'Sign-in failed'); }
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

  const value = useMemo<Ctx>(() => ({
    user, rawUser, loading, error, signIn, signInDemo, logout, updateAvatar
  }), [user, rawUser, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export { defaultAvatar };
