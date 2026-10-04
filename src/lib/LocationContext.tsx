// Device location is mandatory for both drivers and shippers: pickups are
// matched to where the shipper actually is, and drivers publish their live
// position to the network. This provider owns the single watchPosition.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LatLng } from './geo';

export type LocState = 'checking' | 'prompt' | 'granted' | 'denied' | 'unsupported';

type Ctx = {
  state: LocState;
  pos: (LatLng & { accuracy?: number; at: number }) | null;
  error: string | null;
  request: () => void;
};

const LocationContext = createContext<Ctx>({ state: 'checking', pos: null, error: null, request: () => {} });

export function LocationProvider({ children, active }: { children: ReactNode; active: boolean }) {
  const [state, setState] = useState<LocState>('checking');
  const [pos, setPos] = useState<Ctx['pos']>(null);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  const startWatch = useCallback(() => {
    if (watchId.current !== null) return;
    watchId.current = navigator.geolocation.watchPosition(
      p => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() }); setState('granted'); setError(null); },
      e => { if (e.code === e.PERMISSION_DENIED) { setState('denied'); stop(); } else setError(e.message); },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 }
    );
  }, []);
  const stop = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  };

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) { setState('unsupported'); return; }
    setError(null);
    navigator.geolocation.getCurrentPosition(
      p => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() }); setState('granted'); startWatch(); },
      e => {
        if (e.code === e.PERMISSION_DENIED) setState('denied');
        else { setError(e.message || 'Could not get your location'); setState('prompt'); }
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }
    );
  }, [startWatch]);

  useEffect(() => {
    if (!active) return;
    if (!('geolocation' in navigator)) { setState('unsupported'); return; }
    let cancelled = false;
    let status: PermissionStatus | null = null;
    const onChange = () => {
      if (!status) return;
      if (status.state === 'granted') request();
      else setState(status.state === 'denied' ? 'denied' : 'prompt');
    };
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(s => {
        if (cancelled) return;
        status = s;
        if (s.state === 'granted') request();
        else setState(s.state === 'denied' ? 'denied' : 'prompt');
        s.addEventListener('change', onChange);
      }).catch(() => setState('prompt'));
    } else {
      setState('prompt');
    }
    return () => { cancelled = true; status?.removeEventListener('change', onChange); stop(); };
  }, [active, request]);

  return <LocationContext.Provider value={{ state, pos, error, request }}>{children}</LocationContext.Provider>;
}

export const useDeviceLocation = () => useContext(LocationContext);
