// Missile-strike email notifications.
//
// We piggyback on the free Firebase "Trigger Email" extension
// (firestore-send-email). It watches a `mail` collection — any doc shaped
// `{ to, message: { subject, html, attachments? } }` is sent via SMTP that
// the extension is configured with (Gmail / SendGrid / Mailgun / etc.) and
// then its `delivery` field is updated with the result.
//
// Setup is a one-time admin task in the Firebase Console:
//   Extensions → Trigger Email from Firestore → Install
//   - SMTP connection URI:  smtps://USER:PASS@smtp.gmail.com:465
//     (use an App Password on a noreply@ workspace gmail)
//   - From: "Squad REN <noreply@squad-ren.com>"
//   - Default reply-to: privacy@squad-ren.com
//   - Collection path: mail
// Once installed, every doc this module writes is auto-delivered.

import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// ——— Feature flag ———
// Email delivery is intentionally dormant until the "Trigger Email" Firebase
// extension is properly provisioned (Cloud Build IAM, SMTP creds, region).
// Flip this to true — or set VITE_ENABLE_STRIKE_EMAILS=true in .env.local —
// once the extension is live. While dormant we keep the full build pipeline
// (HTML, attachments, recipient lookups) intact and exercise it via console
// logs / localStorage so the in-app strike experience (message + image
// payload on the missile doc, retaliate panel, InfoWindow) is unaffected.
const STRIKE_EMAILS_ENABLED =
  (import.meta.env.VITE_ENABLE_STRIKE_EMAILS as string | undefined) === 'true';

export type StrikeEmailInput = {
  toEmails: string[];
  fromName: string;
  fromEmail?: string | null;
  attackerSquadName: string;
  targetSquadName?: string;
  targetPlace?: string;
  message?: string;
  imageDataUrl?: string;        // optional, base64 already small (≤700KB)
  retaliateUrl?: string;
};

const demo = !db;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function buildEmail(p: StrikeEmailInput) {
  const subject = p.targetSquadName
    ? `🚀 INCOMING STRIKE on ${p.targetSquadName} — from ${p.attackerSquadName}`
    : `🚀 INCOMING STRIKE — from ${p.attackerSquadName}`;

  // Inline image is delivered as a CID attachment so Gmail will render it
  // (Gmail strips data: URIs from <img src> in HTML email for security).
  let attachments: Array<Record<string, any>> | undefined;
  let imgHtml = '';
  if (p.imageDataUrl && p.imageDataUrl.startsWith('data:')) {
    const m = p.imageDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
    if (m) {
      attachments = [{
        filename: 'strike.jpg',
        content: m[2],
        encoding: 'base64',
        cid: 'strike-image'
      }];
      imgHtml = `<div style="margin-top:14px"><img src="cid:strike-image" alt="strike" style="max-width:100%;border-radius:12px"/></div>`;
    }
  }

  const safeMsg = p.message ? escapeHtml(p.message) : '';
  const place = p.targetPlace ? escapeHtml(p.targetPlace) : '';
  const retaliate = p.retaliateUrl
    ? `<p style="margin-top:18px"><a href="${p.retaliateUrl}" style="background:#ef4444;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;font-weight:700">🚀 Retaliate now</a></p>`
    : '';

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
    <div style="background:linear-gradient(135deg,#ef4444,#7c3aed);color:#fff;padding:18px 20px;border-radius:14px">
      <div style="font-size:11px;opacity:0.9;letter-spacing:0.08em">SQUAD REN · VIRTUAL WARFARE</div>
      <div style="font-size:22px;font-weight:900;margin-top:4px">🚀 Incoming strike</div>
      <div style="margin-top:6px;font-size:14px;opacity:0.95">
        <strong>${escapeHtml(p.attackerSquadName)}</strong>
        ${p.fromName ? ` (launched by ${escapeHtml(p.fromName)})` : ''}
        just fired a missile at
        ${p.targetSquadName ? `<strong>${escapeHtml(p.targetSquadName)}</strong>` : (place || 'your area')}.
      </div>
    </div>
    ${safeMsg ? `<div style="margin-top:14px;padding:14px;border-radius:12px;background:#f1f5f9;font-size:14px;white-space:pre-wrap">${safeMsg}</div>` : ''}
    ${imgHtml}
    ${retaliate}
    <p style="margin-top:20px;font-size:12px;color:#64748b">
      You received this because your gmail account is registered with a Squad REN squad that was struck.
      Manage notifications in your <a href="https://squad-ren.com/profile">Profile</a>.
      <br/><a href="https://squad-ren.com/privacy">Privacy policy</a>.
    </p>
  </div>`;

  const text = `Squad REN — Incoming strike from ${p.attackerSquadName}${p.fromName ? ` (${p.fromName})` : ''}.\n` +
    (p.targetSquadName ? `Target: ${p.targetSquadName}\n` : '') +
    (p.message ? `\nMessage: ${p.message}\n` : '') +
    (p.retaliateUrl ? `\nRetaliate: ${p.retaliateUrl}\n` : '');

  return { subject, html, text, attachments };
}

export async function sendStrikeEmails(p: StrikeEmailInput): Promise<void> {
  const recipients = Array.from(new Set(
    (p.toEmails || [])
      .map(e => (e || '').trim().toLowerCase())
      .filter(e => /@/.test(e))
  ));
  if (recipients.length === 0) return;
  const { subject, html, text, attachments } = buildEmail(p);
  if (!STRIKE_EMAILS_ENABLED) {
    // Dormant mode — the Firebase Trigger Email extension is not provisioned
    // yet. We deliberately do NOT write to the `mail` collection so half-
    // installed extensions can't accumulate undelivered docs. The in-app
    // strike pipeline (message + image stored on the missile doc, incoming-
    // strikes panel, retaliate button) continues to work normally because
    // those payloads live on the missile, not in the email.
    const list = JSON.parse(localStorage.getItem('squadren.mail') || '[]');
    list.unshift({ to: recipients, subject, html, text, at: Date.now(), dormant: true });
    localStorage.setItem('squadren.mail', JSON.stringify(list.slice(0, 20)));
    console.info('[mail] strike-email delivery is dormant; would have notified', recipients.length, 'recipient(s).');
    return;
  }
  if (demo) {
    // In demo mode there is no Firestore. Log so devs can see what *would*
    // have shipped, and stash recent strike emails in localStorage for QA.
    const list = JSON.parse(localStorage.getItem('squadren.mail') || '[]');
    list.unshift({ to: recipients, subject, html, text, at: Date.now() });
    localStorage.setItem('squadren.mail', JSON.stringify(list.slice(0, 20)));
    console.log('[mail/demo] would send to', recipients, subject);
    return;
  }
  // One mail doc per delivery list keeps the extension's retry / delivery
  // status easy to reason about; the extension supports a `to` array.
  await addDoc(collection(db!, 'mail'), {
    to: recipients,
    replyTo: p.fromEmail || undefined,
    message: { subject, html, text, ...(attachments ? { attachments } : {}) }
  }).catch(err => console.warn('mail write failed', err));
}

// Look up the email addresses for every uid in a squad. Returns only the
// gmail-style addresses (anything with an @) that we have on file. Anyone
// who signed up without an email (rare) is silently skipped.
export async function emailsForUids(uids: string[]): Promise<string[]> {
  if (!STRIKE_EMAILS_ENABLED) return [];
  if (demo || uids.length === 0) return [];
  const out: string[] = [];
  await Promise.all(uids.map(async uid => {
    try {
      const snap = await getDoc(doc(db!, 'users', uid));
      const e = (snap.data() as any)?.email;
      if (typeof e === 'string' && /@/.test(e)) out.push(e);
    } catch { /* ignore missing user docs */ }
  }));
  return out;
}

// Compress a File / Blob to a JPEG data URL under maxBytes. Keeps the email
// payload small enough for Firestore (1MB doc cap) and Gmail.
export async function compressImage(file: File, maxDim = 900, maxBytes = 700_000): Promise<string> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error('Could not read image — try a JPG or PNG.');
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, w, h);
  let q = 0.82;
  let url = canvas.toDataURL('image/jpeg', q);
  // Walk quality down until under the cap (rare for 900px shots).
  while (url.length > maxBytes && q > 0.4) {
    q -= 0.1;
    url = canvas.toDataURL('image/jpeg', q);
  }
  return url;
}
