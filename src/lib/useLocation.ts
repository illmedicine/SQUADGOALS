import { useEffect, useRef, useState } from 'react';
import type { LatLng } from './geo';

type Opts = { enabled: boolean; intervalMs?: number };

// Cross-platform location hook. Uses browser Geolocation API; on Capacitor
// Android the same API is bridged automatically when plugin is installed.
export function useLocation({ enabled, intervalMs = 5000 }: Opts) {
  const [pos, setPos] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported on this device.');
      return;
    }
    const onPos = (p: GeolocationPosition) => {
      setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
      setError(null);
    };
    const onErr = (e: GeolocationPositionError) => setError(e.message);

    navigator.geolocation.getCurrentPosition(onPos, onErr, { enableHighAccuracy: true });
    watchId.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: intervalMs,
      timeout: intervalMs * 2
    });
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [enabled, intervalMs]);

  return { pos, error };
}
