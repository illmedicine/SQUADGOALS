import { useEffect, useState } from 'react';
import {
  watchStorefrontEvents, readSeenIds, markSeen, type StorefrontEvent
} from '../lib/storefronts';

/**
 * Global popup feed for storefront lifecycle events.
 *
 * Subscribes to the `storefrontEvents` stream and pops one toast per *unseen*
 * event from the last 5 minutes. Tapping the toast (or its dismiss button)
 * marks the id as seen so it never returns on this device.
 *
 * Mounted once at the App shell so every signed-in user gets the broadcast.
 */

const RECENT_WINDOW_MS = 5 * 60 * 1000;
const MAX_VISIBLE = 3;

type Toast = StorefrontEvent & { _shownAt: number };

export default function StorefrontAnnouncements() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const seen = readSeenIds();
    return watchStorefrontEvents(events => {
      const now = Date.now();
      const fresh = events.filter(ev =>
        !seen.has(ev.id) &&
        (now - (ev.atMs || 0)) < RECENT_WINDOW_MS
      );
      if (fresh.length === 0) return;
      // Mark them seen immediately so a re-fire of the subscription doesn't
      // re-pop the same toasts.
      const ids = fresh.map(f => f.id);
      ids.forEach(i => seen.add(i));
      markSeen(ids);
      setToasts(prev => {
        const existing = new Set(prev.map(p => p.id));
        const additions = fresh
          .filter(f => !existing.has(f.id))
          .map<Toast>(f => ({ ...f, _shownAt: now }));
        return [...additions, ...prev].slice(0, MAX_VISIBLE);
      });
    });
  }, []);

  // Auto-dismiss after 9s.
  useEffect(() => {
    if (toasts.length === 0) return;
    const id = window.setTimeout(() => {
      setToasts(prev => prev.filter(t => Date.now() - t._shownAt < 9000));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [toasts]);

  function dismiss(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id));
    markSeen([id]);
  }

  if (toasts.length === 0) return null;
  return (
    <div className="storefront-toast-wrap" role="region" aria-label="Storefront announcements">
      {toasts.map(t => (
        <div
          key={t.id}
          className={'storefront-toast ' + (t.kind === 'promo' ? 'promo' : 'opened')}
          style={t.kind === 'promo' && t.badgeColor ? { borderColor: t.badgeColor } : undefined}
        >
          <div className="storefront-toast-icon">
            {t.kind === 'promo' ? '✨' : '🎉'}
          </div>
          <div className="storefront-toast-body">
            <div className="storefront-toast-head">
              {t.kind === 'promo'
                ? <strong style={{ color: t.badgeColor || '#fde047' }}>EXCLUSIVE PERK UNLOCKED</strong>
                : <strong>NEW STOREFRONT JUST OPENED</strong>}
            </div>
            <div className="storefront-toast-name">
              {t.storefrontName}
              {(t.city || t.state) && (
                <span className="storefront-toast-loc">
                  · 📍 {[t.city, t.state].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
            <div className="storefront-toast-meta">
              {t.kind === 'promo' && t.promoLabel ? t.promoLabel
                : `by ${t.ownerName}${t.category ? ' · ' + t.category : ''}`}
            </div>
          </div>
          <button className="storefront-toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">✕</button>
        </div>
      ))}
    </div>
  );
}
