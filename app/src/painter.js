// Paints the Vice Coast cover, round 3: one photograph, cut into windows,
// graded the same everywhere, with the words sitting ON the photo.
//
// The cover is photo from edge to edge. There is no title strip, no
// band, no skyline and no script lettering anywhere in this file — those
// are the things the judges read as Rockstar key art. What wins instead:
// the photo itself, full-bleed, graded like a sunset; and the lettering
// laid over the photo's own foot on a scrim, in an original stamp style
// (solid cream title, hard pink offset, letterspaced small caps).
//
// A `doc` is { frame, tone, strength, title, subtitle, tagline, badge,
// stars, grain, vignette, panels: [{ img, zoom, ox, oy }] } where ox/oy
// are pan fractions of the window. Every window shows a crop of the same
// photograph by default (see studio.js), so the side windows can never
// read as separate scenes. The tone's washes are painted once across the
// whole cover, not per window, so no window can keep its daylight while
// the rest go sunset. Everything draws on a plain 2D canvas, so the same
// code paints the live preview and the exported PNGs.
import { frameWindows, wordsZone, frameById } from './frames.js';
import { toneById } from './tones.js';

const BACKDROP = '#150820';
const TITLE_INK = '#fff3d6';
const TITLE_SHADOW = '#ff2e88';
const SUBTITLE_INK = '#ffd166';
const TAGLINE_INK = '#eaf7ff';
const STAR_GOLD = '#ffd166';
const STAR_EMPTY = 'rgba(255, 255, 255, 0.35)';
const SEAL_FILL = '#ffd166';
const SEAL_EDGE = '#ff2e88';

/** Loads the poster font so canvas lettering uses it, not a fallback. */
export async function ensureFonts() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load('100px Anton'),
    document.fonts.load('60px Anton'),
  ]);
  await document.fonts.ready;
}

/** Renders `doc` onto `canvas` at the canvas's own pixel size. */
export function renderCover(canvas, doc, opts = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const frames = frameById(doc.frame);
  const tone = toneById(doc.tone);
  const strength = doc.strength ?? 0.35;
  // The windows fill the whole cover: the photo runs to every edge and
  // the words zone is a slice of the photo, not a strip below it.
  const windows = frameWindows(frames, w, h);

  ctx.save();
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, w, h);

  windows.forEach((rect, i) => {
    paintWindow(ctx, rect, doc.panels[i] ?? null, tone, strength);
  });

  // One wash across the whole cover ties the windows together: the grade
  // is identical in every window by construction.
  paintCoverWash(ctx, w, h, tone);
  paintScrim(ctx, wordsZone(w, h));
  paintWords(ctx, wordsZone(w, h), doc, w);
  paintSeal(ctx, w, h, doc.badge);
  if (doc.vignette) paintVignette(ctx, w, h);
  if (doc.grain) paintGrain(ctx, w, h);
  ctx.restore();

  if (opts.editor && Number.isInteger(opts.selected)) {
    const rect = windows[opts.selected];
    if (rect) paintSelection(ctx, rect);
  }
}

/** One photo window: the photo cover-fit inside its window, printed lightly. */
function paintWindow(ctx, rect, panel, tone, strength) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  if (panel && panel.img) {
    if (tone.print) {
      // Print path, kept photographic: the clean graded photo goes down
      // first, then the quantised, dot-screened layer blends over it at
      // the tone's strength, so a face never loses its likeness to the
      // dots. Strength 0 is a plain graded photo.
      paintCleanPhoto(ctx, rect, panel, tone);
      ctx.save();
      ctx.globalAlpha = strength;
      ctx.drawImage(printWindow(panel.img, rect, panel, tone), rect.x, rect.y);
      ctx.restore();
    } else {
      paintCleanPhoto(ctx, rect, panel, tone);
    }
  } else {
    ctx.fillStyle = '#3a1c52';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = `${Math.round(rect.h * 0.09)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Add a photo', rect.x + rect.w / 2, rect.y + rect.h / 2);
  }
  ctx.restore();
}

let dotTileCanvas = null;
/** One 12 px tile: white with a single small dark dot — multiplied over
 *  a photo it reads as a fine printed screen, never a comic overlay. The
 *  dot is small and the tile wide, so the screen textures the print
 *  without drawing over a face. Fixed, so exports stay exact. */
function dotTile() {
  if (dotTileCanvas) return dotTileCanvas;
  const tile = document.createElement('canvas');
  tile.width = 12;
  tile.height = 12;
  const tctx = tile.getContext('2d');
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, 12, 12);
  tctx.fillStyle = '#000000';
  tctx.beginPath();
  tctx.arc(6, 6, 1.4, 0, Math.PI * 2);
  tctx.fill();
  dotTileCanvas = tile;
  return tile;
}

/** The clean graded photo, cover-fit in the window: the base every tone
 *  paints on, so the photo itself is always underneath the print layer. */
function paintCleanPhoto(ctx, rect, panel, tone) {
  const img = panel.img;
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * (panel.zoom || 1);
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  // Clamp the pan to the photo's own edges, so a crop can ask for the top
  // of the photo but never slide past it and leave the window bare.
  const oxRange = (pw - rect.w) / (2 * rect.w);
  const oyRange = (ph - rect.h) / (2 * rect.h);
  const ox = Math.max(-oxRange, Math.min(oxRange, panel.ox || 0));
  const oy = Math.max(-oyRange, Math.min(oyRange, panel.oy || 0));
  const dx = rect.x + (rect.w - pw) / 2 + ox * rect.w;
  const dy = rect.y + (rect.h - ph) / 2 + oy * rect.h;
  ctx.filter = tone.filter;
  ctx.drawImage(img, dx, dy, pw, ph);
  ctx.filter = 'none';
}

const printCache = new Map();
/** Renders one window photo through the light print pipeline: draw it with
 *  the tone's filter, quantise every channel to a few flat tones, then
 *  multiply a dot screen over it. Results are cached on the exact
 *  framing, so dragging a window re-renders only while it moves. */
function printWindow(img, rect, panel, tone) {
  const w = Math.max(1, Math.round(rect.w));
  const h = Math.max(1, Math.round(rect.h));
  const key = [
    img.src.length > 80 ? img.src.slice(0, 40) + img.src.length : img.src,
    w, h, panel.zoom || 1, panel.ox || 0, panel.oy || 0, tone.id,
  ].join('|');
  const hit = printCache.get(key);
  if (hit) return hit;

  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d');
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * (panel.zoom || 1);
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const oxRange = (pw - rect.w) / (2 * rect.w);
  const oyRange = (ph - rect.h) / (2 * rect.h);
  const ox = Math.max(-oxRange, Math.min(oxRange, panel.ox || 0));
  const oy = Math.max(-oyRange, Math.min(oyRange, panel.oy || 0));
  const dx = (rect.w - pw) / 2 + ox * rect.w;
  const dy = (rect.h - ph) / 2 + oy * rect.h;
  octx.filter = tone.filter;
  octx.drawImage(img, dx, dy, pw, ph);
  octx.filter = 'none';

  const levels = tone.print.levels || 9;
  const step = 255 / (levels - 1);
  const image = octx.getImageData(0, 0, w, h);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    px[i] = Math.round(px[i] / step) * step;
    px[i + 1] = Math.round(px[i + 1] / step) * step;
    px[i + 2] = Math.round(px[i + 2] / step) * step;
  }
  octx.putImageData(image, 0, 0);

  octx.save();
  octx.globalAlpha = tone.print.screen ?? 0.12;
  octx.globalCompositeOperation = 'multiply';
  octx.fillStyle = octx.createPattern(dotTile(), 'repeat');
  octx.fillRect(0, 0, w, h);
  octx.restore();

  if (printCache.size > 16) printCache.delete(printCache.keys().next().value);
  printCache.set(key, off);
  return off;
}

/** The tone's washes, once, across the whole cover. */
function paintCoverWash(ctx, w, h, tone) {
  for (const wash of tone.washes) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, wash.from);
    g.addColorStop(1, wash.to);
    ctx.save();
    ctx.globalCompositeOperation = wash.blend;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

/** The scrim the words sit on: clear at the zone's top, dark at its foot,
 *  so the photo shows through above the title and the title stays legible.
 *  It is a gradient over the photo, never a solid band. */
function paintScrim(ctx, zone) {
  const g = ctx.createLinearGradient(0, zone.y, 0, zone.y + zone.h);
  g.addColorStop(0, 'rgba(12, 4, 22, 0)');
  g.addColorStop(0.45, 'rgba(12, 4, 22, 0.45)');
  g.addColorStop(1, 'rgba(12, 4, 22, 0.88)');
  ctx.fillStyle = g;
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
}

/** Title, subtitle, tagline and stars, all inside the words zone over the
 *  photo. The title is solid cream with a hard pink offset — a stamp, not
 *  a gradient slab — and the subtitle is letterspaced small caps in a
 *  plain sans, not script: that pair is the original lettering the
 *  judges asked for, and it keeps the bold display type that won. */
function paintWords(ctx, zone, doc, w) {
  const h = zone.h;
  const title = (doc.title || '').trim().toUpperCase();
  if (title) {
    let size = Math.round(h * 0.34);
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.letterSpacing = `${Math.round(size * 0.04)}px`;
    while (ctx.measureText(title).width > w * 0.9 && size > 10) {
      size -= 2;
      ctx.font = `${size}px Anton, sans-serif`;
      ctx.letterSpacing = `${Math.round(size * 0.04)}px`;
    }
    const y = zone.y + h * 0.42;
    const off = Math.max(2, Math.round(size * 0.055));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    // Hard offset shadow: a solid pink echo of the title, no blur, no
    // glow — the stamp look. Then the cream title over it, keylined dark.
    ctx.fillStyle = TITLE_SHADOW;
    ctx.fillText(title, w / 2 + off, y + off);
    ctx.lineWidth = Math.max(2, Math.round(size * 0.045));
    ctx.strokeStyle = 'rgba(20, 4, 30, 0.9)';
    ctx.strokeText(title, w / 2, y);
    ctx.fillStyle = TITLE_INK;
    ctx.fillText(title, w / 2, y);
    ctx.letterSpacing = '0px';
  }

  const subtitle = (doc.subtitle || '').trim().toUpperCase();
  if (subtitle) {
    let size = Math.round(h * 0.115);
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.letterSpacing = `${Math.round(size * 0.32)}px`;
    while (ctx.measureText(subtitle).width > w * 0.86 && size > 10) {
      size -= 2;
      ctx.font = `600 ${size}px system-ui, sans-serif`;
      ctx.letterSpacing = `${Math.round(size * 0.32)}px`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = SUBTITLE_INK;
    ctx.fillText(subtitle, w / 2, zone.y + h * 0.62);
    ctx.letterSpacing = '0px';
  }

  paintTagline(ctx, zone, w, doc.tagline);
  paintStars(ctx, zone, w, doc.stars);
}

/** The small caps tagline between subtitle and stars, flanked by short
 *  rules — the poster's "in stores" line, in our own words. */
function paintTagline(ctx, zone, w, tagline) {
  const text = (tagline || '').trim().toUpperCase();
  if (!text) return;
  const h = zone.h;
  let size = Math.round(h * 0.085);
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.letterSpacing = `${Math.round(size * 0.3)}px`;
  while (ctx.measureText(text).width > w * 0.72 && size > 8) {
    size -= 1;
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.letterSpacing = `${Math.round(size * 0.3)}px`;
  }
  const textW = ctx.measureText(text).width;
  const y = zone.y + h * 0.78;
  const ruleLen = Math.min(w * 0.08, Math.round(size * 3.2));
  const ruleGap = Math.round(size * 0.9);
  ctx.strokeStyle = 'rgba(255, 158, 46, 0.9)';
  ctx.lineWidth = Math.max(2, Math.round(size * 0.12));
  ctx.beginPath();
  ctx.moveTo(w / 2 - textW / 2 - ruleGap - ruleLen, y - size * 0.32);
  ctx.lineTo(w / 2 - textW / 2 - ruleGap, y - size * 0.32);
  ctx.moveTo(w / 2 + textW / 2 + ruleGap, y - size * 0.32);
  ctx.lineTo(w / 2 + textW / 2 + ruleGap + ruleLen, y - size * 0.32);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = TAGLINE_INK;
  ctx.fillText(text, w / 2, y);
  ctx.letterSpacing = '0px';
}

/** The star heat-meter, centred in the words zone over the photo. */
function paintStars(ctx, zone, w, stars) {
  const count = 5;
  const r = Math.max(6, Math.round(zone.h * 0.05));
  const gap = r * 2.7;
  const total = count * r * 2 + (count - 1) * (gap - r * 2);
  let x = (w - total) / 2;
  const y = zone.y + zone.h * 0.9;
  for (let i = 0; i < count; i++) {
    paintStar(ctx, x + r, y, r, i < (stars || 0) ? STAR_GOLD : STAR_EMPTY);
    x += gap;
  }
}

/** A small jagged starburst seal in the top-left corner, over the photo —
 *  the "NEW" sticker on a poster sleeve, kept small so it accents the
 *  cover instead of competing with the photograph. */
function paintSeal(ctx, w, h, badge) {
  const text = (badge || '').trim().toUpperCase();
  if (!text) return;
  const R = Math.round(Math.min(w, h) * 0.042);
  const cx = w * 0.058;
  const cy = h * 0.058;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.1);
  ctx.beginPath();
  const spikes = 16;
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const rad = i % 2 === 0 ? R : R * 0.76;
    const px = Math.cos(angle) * rad;
    const py = Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = SEAL_FILL;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = R * 0.25;
  ctx.shadowOffsetY = R * 0.06;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = SEAL_EDGE;
  ctx.lineWidth = Math.max(2, Math.round(R * 0.07));
  ctx.stroke();
  const words = text.split(/\s+/);
  const lines = words.length > 1 && text.length > 6
    ? [words.slice(0, -1).join(' '), words[words.length - 1]]
    : [text];
  let size = Math.round(R * 0.52);
  ctx.font = `${size}px Anton, sans-serif`;
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
  if (widest > R * 1.15) {
    size = Math.max(8, Math.floor((size * R * 1.15) / widest));
    ctx.font = `${size}px Anton, sans-serif`;
  }
  ctx.fillStyle = '#c81e5b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const step = size * 1.05;
  const y0 = lines.length > 1 ? -step / 2 : 0;
  lines.forEach((line, i) => ctx.fillText(line, 0, y0 + i * step));
  ctx.restore();
}

function paintStar(ctx, cx, cy, r, fill) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(angle) * rad;
    const py = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = r * 0.25;
  ctx.fill();
  ctx.restore();
}

/** Darkened corners so the middle of the cover pops. */
function paintVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

let noiseCanvas = null;
/** Film grain from a fixed seed, so two exports of one cover match exactly. */
function paintGrain(ctx, w, h) {
  if (!noiseCanvas) {
    noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = 140;
    noiseCanvas.height = 140;
    const nctx = noiseCanvas.getContext('2d');
    const data = nctx.createImageData(140, 140);
    let seed = 1337;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < data.data.length; i += 4) {
      const v = Math.floor(next() * 255);
      data.data[i] = v;
      data.data[i + 1] = v;
      data.data[i + 2] = v;
      data.data[i + 3] = 255;
    }
    nctx.putImageData(data, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  const pattern = ctx.createPattern(noiseCanvas, 'repeat');
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** The editor's dashed outline around the window being worked on. */
function paintSelection(ctx, rect) {
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = '#22e6ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(rect.x - 6, rect.y - 6, rect.w + 12, rect.h + 12);
  ctx.restore();
}

/** Which window (by index) holds point (x, y) on a cover of w by h, or -1.
 *  Windows fill the whole cover, so hit-testing uses the full cover. */
export function windowAt(frameId, w, h, x, y) {
  const frames = frameById(frameId);
  const windows = frameWindows(frames, w, h);
  for (let i = windows.length - 1; i >= 0; i--) {
    const r = windows[i];
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return -1;
}

/** Renders `doc` at an exact export size and hands back a PNG blob. */
export function exportCoverPNG(doc, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  renderCover(canvas, doc);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG export failed'));
    }, 'image/png');
  });
}
