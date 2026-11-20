// Screenshot scenes for the Vice Coast cover maker, round 3.
//
// `?shot=cover` renders one cover full-screen; `?shot=editor` renders the
// editor page. Both take the same knobs the rounds before took —
// size, layout, grade, strength, title, subtitle, tagline, badge, stars,
// photo and photo2..photo5, crop1..crop9 — so the four shipped shots can
// be reproduced exactly from a URL. The one thing that changed in round
// 3: when only `photo` is given, EVERY window shows that one photo. A
// cover is a set of crops of one photograph, so the screenshots prove it:
// the side windows are crops of the hero photo, never separate scenes.
// Pass photo2..photo5 only when the shot genuinely wants different
// photos per window (no shipped shot does).
import { frameById } from './frames.js';

export const EXPORT_SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  landscape: { w: 1920, h: 1080, label: 'Wide 1920 x 1080' },
};

// Nine distinct framings a window can take of one photo. Window 0 always
// shows the whole photo; the rest step through the list in threes, so
// neighbouring windows never repeat a crop — even in a tall window of a
// square photo, where a low zoom leaves no room to pan. The table is
// ordered so the step-3 sequence alternates zoom bands (tight, wide,
// mid, ...), so the first three side windows of any layout are a tight
// crop, a wide crop and a mid crop of the same photograph — never three
// framings that look alike.
const CROPS = [
  { zoom: 1.0, ox: 0, oy: 0 },
  { zoom: 1.55, ox: 0.18, oy: -0.12 },
  { zoom: 1.9, ox: -0.1, oy: 0.05 },
  { zoom: 1.85, ox: 0.05, oy: -0.15 },
  { zoom: 1.7, ox: -0.22, oy: -0.05 },
  { zoom: 1.3, ox: 0, oy: 0.2 },
  { zoom: 1.35, ox: 0.22, oy: 0.12 },
  { zoom: 1.45, ox: -0.2, oy: 0.1 },
  { zoom: 1.6, ox: 0.12, oy: 0.18 },
];

/** Framing for window `index` of `count` windows. */
export function cropFor(index, count) {
  if (index === 0) return CROPS[0];
  // Step 3 through the eight non-hero framings: 3 and 8 are coprime, so a
  // nine-window contact sheet sees all eight framings before any repeats.
  return CROPS[(((index - 1) * 3 + 1) % 8) + 1];
}

/**
 * Builds the doc for a `?shot=` URL. `samples` is the sample list
 * ({ id, url }) and `makePanel` turns a photo element plus a framing into
 * a panel. Returns { doc, shot, size } where size is the export size.
 */
export function buildShotDoc(base, search, samples, makePanel) {
  const params = new URLSearchParams(search);
  const shot = params.get('shot') || 'cover';
  const doc = { ...base };

  const sizeId = params.get('size') || base.size;
  const size = EXPORT_SIZES[sizeId] ?? EXPORT_SIZES.landscape;
  doc.size = sizeId in EXPORT_SIZES ? sizeId : 'landscape';

  if (params.get('layout')) doc.frame = params.get('layout');
  if (params.get('grade')) doc.tone = params.get('grade');
  if (params.get('strength') != null) {
    const s = parseFloat(params.get('strength'));
    if (Number.isFinite(s)) doc.strength = Math.max(0, Math.min(1, s));
  }
  if (params.get('title') != null) doc.title = params.get('title');
  if (params.get('subtitle') != null) doc.subtitle = params.get('subtitle');
  if (params.get('tagline') != null) doc.tagline = params.get('tagline');
  if (params.get('badge') != null) doc.badge = params.get('badge');
  if (params.get('stars') != null) {
    const n = parseInt(params.get('stars'), 10);
    if (Number.isFinite(n)) doc.stars = Math.max(0, Math.min(5, n));
  }

  // Photo pool: photo, photo2..photo5. Only `photo` on its own means one
  // photo in every window; a list means window i takes pool[i % pool.length].
  const pool = [];
  for (let k = 1; k <= 5; k++) {
    const name = params.get(k === 1 ? 'photo' : `photo${k}`);
    if (!name) continue;
    const found = samples.find((s) => s.id === name);
    if (found) pool.push(found);
  }
  if (pool.length === 0) pool.push(samples[0]);

  const count = frameById(doc.frame).windows(1, 1).length;
  doc.panels = [];
  for (let i = 0; i < count; i++) {
    const entry = pool.length === 1 ? pool[0] : pool[i % pool.length];
    const pin = params.get(`crop${i + 1}`);
    let framing = cropFor(i, count);
    if (pin != null) {
      const idx = parseInt(pin, 10);
      if (Number.isFinite(idx) && idx >= 0 && idx < CROPS.length) {
        framing = CROPS[idx];
      }
    }
    doc.panels.push(makePanel(entry, framing));
  }
  return { doc, shot, size };
}
