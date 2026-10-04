import {
  createContext, useContext, useEffect, useMemo, useState, ReactNode
} from 'react';
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, User, browserPopupRedirectResolver
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, firebaseConfigured } from './firebase';
import type { Role } from './freight/types';

export type AppUser = {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  role?: Role;
};

// The landing page records which door the visitor walked through ("Ship" or
// "Drive") before the Google round-trip, so a redirect sign-in still lands
// them in the right experience.
const INTENT_KEY = 'squadren.intendedRole';
const DEMO_KEY = 'squadren.demoUser';

export function rememberIntent(role: Role) {
  try { localStorage.setItem(INTENT_KEY, role); } catch { /* ignore */ }
}
function takeIntent(): Role | undefined {
  try {
    const r = localStorage.getItem(INTENT_KEY) as Role | null;
    localStorage.removeItem(INTENT_KEY);
    return r === 'driver' || r === 'shipper' ? r : undefined;
  } catch { return undefined; }
}

type Ctx = {
  user: AppUser | null;
  rawUser: User | null;
  loading: boolean;
  error: string | null;
  signIn: (role?: Role) => Promise<void>;
  signInDemo: (name: string, role: Role) => void;
  logout: () => Promise<void>;
  setRole: (role: Role) => Promise<void>;
};

const AuthContext = createContext<Ctx>(null as unknown as Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [rawUser, setRawUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      try {
        const cached = localStorage.getItem(DEMO_KEY);
        if (cached) setUser(JSON.parse(cached));
      } catch { /* ignore */ }
      setLoading(false);
      return;
    }
    getRedirectResult(auth).catch(err => {
      console.error('[auth] getRedirectResult failed:', err);
      setError(`Redirect sign-in failed: ${err?.code || ''} ${err?.message || err}`);
    });
    const unsub = onAuthStateChanged(auth, async (u) => {
      setRawUser(u);
      if (!u) { setUser(null); setLoading(false); return; }
      try {
        setUser(await ensureProfile(u));
      } catch (err: any) {
        console.warn('ensureProfile failed, using fallback:', err?.message);
        setUser({ uid: u.uid, displayName: u.displayName || 'Friend', email: u.email, photoURL: u.photoURL, role: takeIntent() });
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  async function ensureProfile(u: User): Promise<AppUser> {
    const base: AppUser = { uid: u.uid, displayName: u.displayName || 'Friend', email: u.email, photoURL: u.photoURL };
    const intent = takeIntent();
    if (!db) return { ...base, role: intent };
    const ref = doc(db, 'users', u.uid);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data() as Partial<AppUser>) : {};
    // An existing role wins — a returning driver who taps "Ship" still lands
    // on their driver account (they can switch from the account menu).
    const role = (existing.role as Role | undefined) ?? intent;
    const profile: AppUser = { ...base, role };
    await setDoc(ref, {
      ...profile,
      role: role ?? null,
      ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
    }, { merge: true });
    return profile;
  }

  async function signIn(role?: Role) {
    setError(null);
    if (role) rememberIntent(role);
    if (!auth) { setError('Firebase not configured — use Demo Mode.'); return; }
    try {
      await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    } catch (e: any) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') {
        setError('Sign-in cancelled.');
        return;
      }
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (err: any) {
        setError(`${err?.code || ''} ${err?.message || 'Sign-in failed'}`);
      }
    }
  }

  function signInDemo(name: string, role: Role) {
    const demo: AppUser = {
      uid: 'demo-' + Math.random().toString(36).slice(2, 8),
      displayName: name.trim() || (role === 'driver' ? 'Demo Driver' : 'Demo Shipper'),
      email: null,
      photoURL: null,
      role,
    };
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(demo)); } catch { /* ignore */ }
    setUser(demo);
  }

  async function logout() {
    try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
    if (auth) await signOut(auth);
    setUser(null);
  }

  async function setRole(role: Role) {
    if (!user) return;
    const next = { ...user, role };
    setUser(next);
    if (db && rawUser) await setDoc(doc(db, 'users', rawUser.uid), { role }, { merge: true }).catch(() => {});
    else try { localStorage.setItem(DEMO_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const value = useMemo<Ctx>(() => ({
    user, rawUser, loading, error, signIn, signInDemo, logout, setRole
  }), [user, rawUser, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
