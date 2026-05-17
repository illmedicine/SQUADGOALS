import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, type Storefront, type StorefrontItem, type StorefrontPerks } from '../lib/AuthContext';
import {
  lookupPromoCode,
  publishStorefront,
  announceStorefrontOpened,
  announcePromoRedeemed
} from '../lib/storefronts';

/**
 * Storefront manager — the full marketplace surface for a vendor.
 *
 *  - Cover photo, logo, brand fields, hours, contact info.
 *  - Inventory list with name, description, price, stock and photo upload
 *    (resized client-side to a small data URL so it can live inside the
 *    user doc without blowing the 1 MB Firestore limit).
 *  - Promo code redemption — recognised codes (e.g. NAILSON10) unlock a
 *    StorefrontPerks bundle: prestige badge, animated avatar aura and a
 *    glowing storefront border.
 *  - "Publish" pushes the storefront to the public feed and fires global
 *    announcement events so everyone using Squad REN sees a popup.
 *
 * Persistence goes through `updateStorefront` on AuthContext so it shares
 * the same Firestore / localStorage strategy as everything else.
 */

const KINDS: { value: NonNullable<Storefront['kind']>; label: string }[] = [
  { value: 'business', label: '🏪 Small business' },
  { value: 'service',  label: '🛠️ Service / freelance' },
  { value: 'creator',  label: '🎨 Creator' },
  { value: 'venue',    label: '🏟️ Venue' },
  { value: 'personal', label: '🙂 Personal page' }
];

// Resize an image File to <= 720px on the long side and return a JPEG data URL.
// Keeps payload sane for Firestore + localStorage.
async function fileToResizedDataUrl(file: File, maxSize = 720, quality = 0.85): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(file);
  });
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * ratio));
      const h = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas unsupported'));
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = dataUrl;
  });
}

function newItem(): StorefrontItem {
  return { id: 'it_' + Math.random().toString(36).slice(2, 10), name: '' };
}

// Normalise items from the legacy schema to StorefrontItem.
function normalizeItem(raw: any): StorefrontItem {
  if (!raw) return newItem();
  const price = typeof raw.price === 'number' ? raw.price : undefined;
  const priceText = typeof raw.price === 'string' ? raw.price : raw.priceText;
  return {
    id: raw.id || 'it_' + Math.random().toString(36).slice(2, 10),
    name: raw.name || '',
    description: raw.description || raw.note || '',
    price,
    priceText,
    stock: typeof raw.stock === 'number' ? raw.stock : undefined,
    imageDataUrl: raw.imageDataUrl,
    category: raw.category,
    sku: raw.sku
  };
}

export default function StorefrontPage() {
  const { user, updateStorefront } = useAuth();
  const navigate = useNavigate();

  const initial = user?.storefront;
  const [s, setS] = useState<Storefront>(() => ({
    kind: 'business',
    visibility: 'private',
    items: [],
    ...(initial || {})
  }));
  const [items, setItems] = useState<StorefrontItem[]>(() =>
    ((initial?.items as any[]) || []).map(normalizeItem)
  );
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Track whether the current snapshot has ever been published, so we know
  // whether to fire the "new storefront opened!" announcement on save.
  const firstOpenedAtRef = useRef<number | undefined>(initial?.firstOpenedAt);

  useEffect(() => { firstOpenedAtRef.current = initial?.firstOpenedAt; }, [initial?.firstOpenedAt]);

  if (!user) return null;
  const me = user; // narrow for use inside async callbacks

  function patch(p: Partial<Storefront>) { setS(prev => ({ ...prev, ...p })); }
  function patchItem(id: string, p: Partial<StorefrontItem>) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...p } : it));
  }
  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it.id !== id));
  }
  function addItem() {
    setItems(prev => [...prev, newItem()]);
  }

  async function onPickImage(kind: 'cover' | 'logo' | string, file: File) {
    try {
      const max = kind === 'cover' ? 960 : kind === 'logo' ? 360 : 720;
      const dataUrl = await fileToResizedDataUrl(file, max);
      if (kind === 'cover') patch({ coverImageDataUrl: dataUrl });
      else if (kind === 'logo') patch({ logoImageDataUrl: dataUrl });
      else patchItem(kind, { imageDataUrl: dataUrl });
    } catch (e: any) {
      alert('Could not load that image: ' + (e?.message || 'unknown error'));
    }
  }

  async function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    const already = (s.promoCodesRedeemed || []).includes(code);
    if (already) {
      setPromoMsg({ ok: false, text: `${code} is already applied to this storefront.` });
      return;
    }
    const match = lookupPromoCode(code);
    if (!match) {
      setPromoMsg({ ok: false, text: `That code isn\u2019t recognised. Double-check the campaign email.` });
      return;
    }
    // Merge perks into existing perks (later codes override earlier values).
    const perks: StorefrontPerks = {
      ...(s.perks || {}),
      ...match.perks,
      earnedAt: Date.now(),
      source: match.code
    };
    const next: Storefront = {
      ...s,
      perks,
      promoCodesRedeemed: [...(s.promoCodesRedeemed || []), code],
      lastPromoAt: Date.now()
    };
    setS(next);
    setPromoMsg({ ok: true, text: match.label });
    setPromoInput('');
    // Persist immediately and broadcast.
    setBusy(true);
    try {
      await updateStorefront({ ...next, items });
      await announcePromoRedeemed(me, next, match);
      if (next.visibility === 'public') {
        await publishStorefront(me, { ...next, items });
      }
    } finally {
      setBusy(false);
    }
  }

  async function save(opts: { publish?: boolean } = {}) {
    setBusy(true);
    try {
      // If user is publishing for the first time, stamp firstOpenedAt and
      // fire the "new storefront!" announcement so every device pops a toast.
      const nextVisibility = opts.publish ? 'public' : (s.visibility || 'private');
      const isFirstPublic = nextVisibility === 'public' && !firstOpenedAtRef.current;
      const stamped: Storefront = {
        ...s,
        items,
        visibility: nextVisibility,
        firstOpenedAt: isFirstPublic ? Date.now() : firstOpenedAtRef.current,
        updatedAt: Date.now()
      };
      await updateStorefront(stamped);
      if (nextVisibility === 'public') {
        await publishStorefront(me, stamped);
        if (isFirstPublic) {
          firstOpenedAtRef.current = stamped.firstOpenedAt;
          await announceStorefrontOpened(me, stamped);
        }
      }
      setS(stamped);
      setSavedAt(Date.now());
    } catch (e: any) {
      alert('Save failed: ' + (e?.message || 'unknown'));
    } finally {
      setBusy(false);
    }
  }

  const perks = s.perks;
  const hasGlow = !!perks?.storefrontGlow;
  const inventoryCount = items.length;
  const totalValue = useMemo(
    () => items.reduce((acc, it) => acc + (typeof it.price === 'number' ? it.price * Math.max(1, it.stock || 1) : 0), 0),
    [items]
  );

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 26 }}>🛍️</span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0 }}>My Storefront</h1>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Run your marketplace inside Squad REN — inventory, pricing, photos, promos.
          </div>
        </div>
        <button className="btn ghost" style={{ width: 'auto' }} onClick={() => navigate('/profile')}>
          ← Profile
        </button>
      </div>

      {/* Cover / brand header */}
      <div className={'card storefront-cover' + (hasGlow ? ' storefront-glow' : '')}>
        <div className="storefront-cover-img" style={{ backgroundImage: s.coverImageDataUrl ? `url(${s.coverImageDataUrl})` : undefined }}>
          {!s.coverImageDataUrl && (
            <div className="storefront-cover-placeholder">Tap to add cover image</div>
          )}
          <button className="storefront-cover-edit" type="button" onClick={() => coverInputRef.current?.click()}>
            📷 {s.coverImageDataUrl ? 'Change cover' : 'Upload cover'}
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onPickImage('cover', f); e.target.value = ''; }}
          />
        </div>
        <div className="storefront-header">
          <div className="storefront-logo" style={{ backgroundImage: s.logoImageDataUrl ? `url(${s.logoImageDataUrl})` : undefined }}>
            {!s.logoImageDataUrl && <span style={{ fontSize: 28 }}>🛍️</span>}
            <button className="storefront-logo-edit" type="button" onClick={() => logoInputRef.current?.click()}>✏️</button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) onPickImage('logo', f); e.target.value = ''; }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="input storefront-name-input"
              placeholder="Storefront name"
              maxLength={60}
              value={s.name || ''}
              onChange={e => patch({ name: e.target.value })}
            />
            <input
              className="input storefront-tagline-input"
              placeholder="Tagline — one line about what you sell"
              maxLength={140}
              value={s.tagline || ''}
              onChange={e => patch({ tagline: e.target.value })}
            />
            {perks?.prestigeBadge && (
              <div className="storefront-badge" style={{
                borderColor: perks.badgeColor || '#fde047',
                color: perks.badgeColor || '#fde047'
              }}>
                {perks.prestigeBadge}
                <span className="sparkle" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Brand details */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Brand</h2>
        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label>Type</label>
            <select className="select" value={s.kind || 'business'} onChange={e => patch({ kind: e.target.value as Storefront['kind'] })}>
              {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Category</label>
            <input className="input" value={s.category || ''} onChange={e => patch({ category: e.target.value })}
              placeholder="Coffee · Fitness · Tattoo…" maxLength={40} />
          </div>
        </div>

        <label>About</label>
        <textarea className="input" rows={3} value={s.bio || ''} onChange={e => patch({ bio: e.target.value })}
          placeholder="Tell shoppers what makes you different." maxLength={600} />

        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label>City</label>
            <input className="input" value={s.city || ''} onChange={e => patch({ city: e.target.value })}
              placeholder="Brooklyn" maxLength={60} />
          </div>
          <div style={{ flex: 1 }}>
            <label>State / Region</label>
            <input className="input" value={s.state || ''} onChange={e => patch({ state: e.target.value })}
              placeholder="NY" maxLength={40} />
          </div>
          <div style={{ flex: 1 }}>
            <label>Country</label>
            <input className="input" value={s.country || ''} onChange={e => patch({ country: e.target.value })}
              placeholder="USA" maxLength={40} />
          </div>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label>Hours</label>
            <input className="input" value={s.hours || ''} onChange={e => patch({ hours: e.target.value })}
              placeholder="Mon–Sat 8am–6pm" maxLength={80} />
          </div>
          <div style={{ flex: 1 }}>
            <label>Phone</label>
            <input className="input" value={s.phone || ''} onChange={e => patch({ phone: e.target.value })}
              placeholder="(555) 555-0100" maxLength={40} />
          </div>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label>Website</label>
            <input className="input" value={s.website || ''} onChange={e => patch({ website: e.target.value })}
              placeholder="https://…" maxLength={120} />
          </div>
          <div style={{ flex: 1 }}>
            <label>Instagram</label>
            <input className="input" value={s.instagram || ''} onChange={e => patch({ instagram: e.target.value })}
              placeholder="@handle" maxLength={40} />
          </div>
          <div style={{ flex: 1 }}>
            <label>Email</label>
            <input className="input" value={s.email || ''} onChange={e => patch({ email: e.target.value })}
              placeholder="orders@…" maxLength={120} />
          </div>
        </div>

        <label>Squad-only offer</label>
        <input className="input" value={s.offers || ''} onChange={e => patch({ offers: e.target.value })}
          placeholder="e.g. 15% off for any squadder this week" maxLength={140} />
      </div>

      {/* Promo / perks card */}
      <div className={'card storefront-promo' + (perks?.storefrontGlow ? ' storefront-promo-glow' : '')}>
        <h2 style={{ marginTop: 0 }}>🎟️ Promo code</h2>
        <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: 13 }}>
          Got a code from the Indeed hiring email or a Squad REN partner campaign? Drop it
          here to unlock exclusive perks — animated avatar effects, a prestige badge, and a
          glowing storefront border that pops on the leaderboard.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            value={promoInput}
            onChange={e => setPromoInput(e.target.value.toUpperCase())}
            placeholder="e.g. NAILSON10"
            maxLength={32}
            style={{ flex: 1, letterSpacing: 1.4, fontWeight: 800 }}
          />
          <button className="btn" style={{ width: 'auto' }} onClick={applyPromo} disabled={busy || !promoInput.trim()}>
            Redeem
          </button>
        </div>
        {promoMsg && (
          <div className={'promo-result ' + (promoMsg.ok ? 'ok' : 'bad')}>
            {promoMsg.text}
          </div>
        )}
        {perks && (
          <div className="perks-grid">
            {perks.prestigeBadge && (
              <div className="perk-chip" style={{ borderColor: perks.badgeColor }}>
                <strong>Prestige badge</strong>
                <span>{perks.prestigeBadge}</span>
              </div>
            )}
            {perks.exclusiveOutfit && (
              <div className="perk-chip">
                <strong>Avatar unlock</strong>
                <span>{perks.exclusiveOutfit}</span>
              </div>
            )}
            {perks.animatedAvatar && (
              <div className="perk-chip"><strong>Animated avatar</strong><span>Active ✨</span></div>
            )}
            {perks.storefrontGlow && (
              <div className="perk-chip"><strong>Storefront glow</strong><span>Active 🌈</span></div>
            )}
            {(s.promoCodesRedeemed || []).length > 0 && (
              <div className="perk-chip">
                <strong>Codes redeemed</strong>
                <span>{(s.promoCodesRedeemed || []).join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inventory */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>📦 Inventory</h2>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {inventoryCount} item{inventoryCount === 1 ? '' : 's'} · est. inventory value {' '}
            <strong>${totalValue.toFixed(2)}</strong>
          </div>
        </div>
        <div className="inventory-list">
          {items.length === 0 && <div className="empty">No products yet. Add your first one below.</div>}
          {items.map(it => (
            <InventoryRow
              key={it.id}
              item={it}
              onChange={p => patchItem(it.id!, p)}
              onRemove={() => removeItem(it.id!)}
              onImage={f => onPickImage(it.id!, f)}
            />
          ))}
        </div>
        <button className="btn ghost" onClick={addItem} style={{ marginTop: 8 }}>+ Add product</button>
      </div>

      {/* Visibility / publish */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Visibility</h2>
        <div className="layer-toggle" style={{ marginBottom: 8 }}>
          <button type="button" className={'chip ' + ((s.visibility || 'private') === 'private' ? 'active' : '')}
            onClick={() => patch({ visibility: 'private' })}>🔒 Hidden</button>
          <button type="button" className={'chip ' + (s.visibility === 'squad' ? 'active' : '')}
            onClick={() => patch({ visibility: 'squad' })}>👥 Squad-only</button>
          <button type="button" className={'chip ' + (s.visibility === 'public' ? 'active' : '')}
            onClick={() => patch({ visibility: 'public' })}>🌎 Public</button>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <button className="btn secondary" onClick={() => save()} disabled={busy} style={{ flex: 1 }}>
            {busy ? 'Saving…' : '💾 Save draft'}
          </button>
          <button
            className="btn"
            onClick={() => save({ publish: true })}
            disabled={busy || !s.name}
            style={{ flex: 2 }}
            title={s.name ? 'Publish to public feed & notify everyone' : 'Add a storefront name first'}
          >
            🚀 Publish storefront
          </button>
        </div>
        {savedAt && (
          <div style={{ fontSize: 12, color: '#16a34a', marginTop: 8, textAlign: 'center' }}>
            Saved {new Date(savedAt).toLocaleTimeString()}
          </div>
        )}
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, textAlign: 'center' }}>
          Publishing notifies everyone on Squad REN and lists your store under the{' '}
          <Link to="/leaderboard">leaderboard</Link>.
        </p>
      </div>
    </div>
  );
}

/* ---------- Inventory row ---------- */
function InventoryRow({
  item, onChange, onRemove, onImage
}: {
  item: StorefrontItem;
  onChange: (p: Partial<StorefrontItem>) => void;
  onRemove: () => void;
  onImage: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="inventory-row">
      <div className="inventory-img" onClick={() => fileRef.current?.click()}
        style={{ backgroundImage: item.imageDataUrl ? `url(${item.imageDataUrl})` : undefined }}>
        {!item.imageDataUrl && <span>📷</span>}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onImage(f); e.target.value = ''; }}
        />
      </div>
      <div style={{ flex: 1, display: 'grid', gap: 4 }}>
        <input
          className="input"
          placeholder="Product name"
          value={item.name}
          onChange={e => onChange({ name: e.target.value })}
          maxLength={80}
        />
        <input
          className="input"
          placeholder="Short description"
          value={item.description || ''}
          onChange={e => onChange({ description: e.target.value })}
          maxLength={200}
        />
        <div className="row" style={{ gap: 6 }}>
          <input
            className="input"
            placeholder="Price ($)"
            inputMode="decimal"
            value={item.price !== undefined ? String(item.price) : ''}
            onChange={e => {
              const v = e.target.value.trim();
              if (v === '') { onChange({ price: undefined }); return; }
              const n = Number(v);
              if (!Number.isNaN(n)) onChange({ price: n });
            }}
            style={{ flex: 1 }}
            maxLength={10}
          />
          <input
            className="input"
            placeholder="Stock"
            inputMode="numeric"
            value={item.stock !== undefined ? String(item.stock) : ''}
            onChange={e => {
              const v = e.target.value.trim();
              if (v === '') { onChange({ stock: undefined }); return; }
              const n = parseInt(v, 10);
              if (!Number.isNaN(n)) onChange({ stock: n });
            }}
            style={{ width: 90 }}
            maxLength={6}
          />
          <input
            className="input"
            placeholder="SKU"
            value={item.sku || ''}
            onChange={e => onChange({ sku: e.target.value })}
            style={{ width: 110 }}
            maxLength={32}
          />
        </div>
      </div>
      <button className="chip" onClick={onRemove} title="Remove product" aria-label="Remove product">✕</button>
    </div>
  );
}
