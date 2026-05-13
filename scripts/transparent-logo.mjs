// Strips the near-white background from public/logo.png and emits a fully
// transparent version in-place, plus 192/512 PWA icons and a 32x32 favicon.
// Run with:  node scripts/transparent-logo.mjs
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = resolve('public/logo.png');
const buf = readFileSync(src);

// Decode to raw RGBA so we can edit alpha pixel-by-pixel.
const { data, info } = await sharp(buf)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info; // channels === 4
const out = Buffer.from(data); // copy

// Tunables: pixels brighter than THRESH and low-saturation are considered
// background. Edge pixels get partial transparency for smooth anti-aliasing.
const HARD = 240;   // >= this on all channels → fully transparent
const SOFT = 200;   // between SOFT..HARD → fade alpha
const SAT_MAX = 18; // max(R,G,B) - min(R,G,B); low = grey/white

for (let i = 0; i < out.length; i += channels) {
  const r = out[i], g = out[i + 1], b = out[i + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max - min;
  if (sat > SAT_MAX) continue; // colored pixel, keep it
  if (max >= HARD) {
    out[i + 3] = 0;            // fully transparent
  } else if (max >= SOFT) {
    // fade: HARD→0, SOFT→255
    const t = (max - SOFT) / (HARD - SOFT);
    out[i + 3] = Math.round(out[i + 3] * (1 - t));
  }
}

const baseImg = sharp(out, { raw: { width, height, channels } });

await baseImg
  .clone()
  .png({ compressionLevel: 9 })
  .toFile(src);

await baseImg
  .clone()
  .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(resolve('public/icon-512.png'));

await baseImg
  .clone()
  .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(resolve('public/icon-192.png'));

await baseImg
  .clone()
  .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(resolve('public/favicon.png'));

console.log('Wrote transparent logo + icons:', { width, height });
