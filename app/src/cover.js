// Draws the Vice Coast cover: photo panels in the chosen layout, each graded
// like a Vice City sunset or a neon night, then bold poster lettering, a badge
// ribbon, a star heat-meter, grain and a vignette. Everything draws on a plain
// 2D canvas, so the same code paints the live preview and the exported PNGs.
// A `doc` is { layout, grade, intensity, title, subtitle, tagline, badge,
// stars, grain, vignette, panels: [{ img, zoom, ox, oy }] } where ox/oy are
// pan fractions of the panel. The Poster Ink grade lays a gentle quantised,
// dot-screened print layer over the clean photo at `intensity`, so even a
// plain snapshot reads as key art while the faces in it stay photographic.
import { layoutPanels, captionBand, layoutById } from './layouts.js';
import { gradeById } from './grades.js';

const BACKDROP = '#150820';
const STRIP = '#180a24';
const SKYLINE_INK = '#2c1544';
const PANEL_EDGE = '#ffffff';
const TITLE_INK = '#ffffff';
const SUBTITLE_INK = '#ffe9a8';
const RIBBON_INK = '#ff2e88';
const STAR_GOLD = '#ffd166';
const STAR_EMPTY = 'rgba(255, 255, 255, 0.35)';

/** Loads the two poster fonts so canvas lettering uses them, not a fallback. */
export async function ensureFonts() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load('100px Anton'),
    document.fonts.load('60px Anton'),
    document.fonts.load('100px Pacifico'),
    document.fonts.load('48px Pacifico'),
  ]);
  await document.fonts.ready;
}

/** Renders `doc` onto `canvas` at the canvas's own pixel size. */
export function renderCover(canvas, doc, opts = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const layout = layoutById(doc.layout);
  const grade = gradeById(doc.grade);
  // The cover is two zones: photos above, a solid title strip below. The
  // strip owns all the lettering and the star meter, so no text can ever
  // run off the foot of the cover and no caption ever sits on a face.
  const band = captionBand(w, h);
  const panels = layoutPanels(layout, w, band.y);

  ctx.save();
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, w, h);

  panels.forEach((rect, i) => {
    drawPanel(ctx, rect, doc.panels[i] ?? null, grade, doc.intensity ?? 0.6);
  });

  drawCaptionStrip(ctx, band, doc, w);
  drawBadge(ctx, w, h, doc.badge);
  if (doc.vignette) drawVignette(ctx, w, h);
  if (doc.grain) drawGrain(ctx, w, h);
  ctx.restore();

  if (opts.editor && Number.isInteger(opts.selected)) {
    const rect = panels[opts.selected];
    if (rect) drawSelection(ctx, rect);
  }
}

/** One photo panel: the photo cover-fit inside its (possibly tilted) frame, graded. */
function drawPanel(ctx, rect, panel, grade, intensity = 0.6) {
  ctx.save();
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate((rect.rot * Math.PI) / 180);
  ctx.translate(-rect.w / 2, -rect.h / 2);
  ctx.beginPath();
  ctx.rect(0, 0, rect.w, rect.h);
  ctx.clip();

  if (panel && panel.img) {
    if (grade.posterize) {
      // Print path, kept photographic: the clean graded photo goes down
      // first, then the quantised, dot-screened layer blends over it at
      // the grade's strength, so a face never loses its likeness to the
      // dots. Strength 0 is a plain graded photo, 1 the full print.
      drawCleanPhoto(ctx, rect, panel, grade);
      ctx.save();
      ctx.globalAlpha = intensity;
      ctx.drawImage(posterizePanel(panel.img, rect, panel, grade), 0, 0);
      ctx.restore();
    } else {
      drawCleanPhoto(ctx, rect, panel, grade);
    }
  } else {
    ctx.fillStyle = '#3a1c52';
    ctx.fillRect(0, 0, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = `${Math.round(rect.h * 0.09)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Drop a photo', rect.w / 2, rect.h / 2);
  }

  for (const wash of grade.washes) {
    const g = ctx.createLinearGradient(0, 0, 0, rect.h);
    g.addColorStop(0, wash.from);
    g.addColorStop(1, wash.to);
    ctx.globalCompositeOperation = wash.blend;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, rect.w, rect.h);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rect.rot * Math.PI) / 180);
  ctx.strokeStyle = PANEL_EDGE;
  ctx.lineWidth = Math.max(2, Math.round(Math.min(rect.w, rect.h) * 0.012));
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = ctx.lineWidth * 4;
  ctx.strokeRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
  ctx.restore();
}

let halftoneTileCanvas = null;
/** One 10 px tile: white with a single small black dot — multiplied over
 *  a photo it reads as a fine printed screen, never a comic overlay. The
 *  dot is small and the tile wide, so the screen textures the print
 *  without drawing over a face. Fixed, so exports stay exact. */
function halftoneTile() {
  if (halftoneTileCanvas) return halftoneTileCanvas;
  const tile = document.createElement('canvas');
  tile.width = 10;
  tile.height = 10;
  const tctx = tile.getContext('2d');
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, 10, 10);
  tctx.fillStyle = '#000000';
  tctx.beginPath();
  tctx.arc(5, 5, 1.5, 0, Math.PI * 2);
  tctx.fill();
  halftoneTileCanvas = tile;
  return tile;
}

/** The clean graded photo, cover-fit in the panel: the base every grade
 *  paints on, so the photo itself is always underneath the print layer. */
function drawCleanPhoto(ctx, rect, panel, grade) {
  const img = panel.img;
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * (panel.zoom || 1);
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  // Clamp the pan to the photo's own edges, so a crop can ask for the top
  // of the photo but never slide past it and leave the panel bare.
  const oxRange = (pw - rect.w) / (2 * rect.w);
  const oyRange = (ph - rect.h) / (2 * rect.h);
  const ox = Math.max(-oxRange, Math.min(oxRange, panel.ox || 0));
  const oy = Math.max(-oyRange, Math.min(oyRange, panel.oy || 0));
  const dx = (rect.w - pw) / 2 + ox * rect.w;
  const dy = (rect.h - ph) / 2 + oy * rect.h;
  ctx.filter = grade.filter;
  ctx.drawImage(img, dx, dy, pw, ph);
  ctx.filter = 'none';
}

const posterCache = new Map();
/** Renders one panel photo through the comic-print pipeline: draw it with
 *  the grade's filter, quantise every channel to a few flat tones, then
 *  multiply a halftone dot screen over it. Results are cached on the exact
 *  framing, so dragging a panel re-renders only while it moves. */
function posterizePanel(img, rect, panel, grade) {
  const w = Math.max(1, Math.round(rect.w));
  const h = Math.max(1, Math.round(rect.h));
  const key = [
    img.src.length > 80 ? img.src.slice(0, 40) + img.src.length : img.src,
    w, h, panel.zoom || 1, panel.ox || 0, panel.oy || 0, grade.id,
  ].join('|');
  const hit = posterCache.get(key);
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
  octx.filter = grade.filter;
  octx.drawImage(img, dx, dy, pw, ph);
  octx.filter = 'none';

  const levels = grade.posterize.levels || 5;
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
  octx.globalAlpha = grade.posterize.halftone ?? 0.5;
  octx.globalCompositeOperation = 'multiply';
  octx.fillStyle = octx.createPattern(halftoneTile(), 'repeat');
  octx.fillRect(0, 0, w, h);
  octx.restore();

  if (posterCache.size > 16) posterCache.delete(posterCache.keys().next().value);
  posterCache.set(key, off);
  return off;
}

/** The solid title strip: neon rule, skyline, gradient title, neon-script
 *  subtitle, tagline and stars — all stacked inside the strip with safe
 *  margins, so the lowest ink (the star row) still ends a clear gap above
 *  the bottom edge at every export size. */
function drawCaptionStrip(ctx, band, doc, w) {
  const h = band.h;
  ctx.fillStyle = STRIP;
  ctx.fillRect(0, band.y, w, h);

  const rule = ctx.createLinearGradient(0, 0, w, 0);
  rule.addColorStop(0, '#ff2e88');
  rule.addColorStop(0.5, '#ff9e2e');
  rule.addColorStop(1, '#22e6ff');
  ctx.fillStyle = rule;
  ctx.fillRect(0, band.y, w, Math.max(3, Math.round(h * 0.02)));
  drawSkyline(ctx, band, w);

  const title = (doc.title || '').trim().toUpperCase();
  if (title) {
    let size = Math.round(h * 0.34);
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.letterSpacing = `${Math.round(size * 0.05)}px`;
    while (ctx.measureText(title).width > w * 0.9 && size > 10) {
      size -= 2;
      ctx.font = `${size}px Anton, sans-serif`;
      ctx.letterSpacing = `${Math.round(size * 0.05)}px`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // Sunset gradient ink — yellow over orange into hot pink — with a dark
    // keyline, so the title reads as a poster masthead, not plain type.
    const ink = ctx.createLinearGradient(0, band.y + h * 0.08, 0, band.y + h * 0.44);
    ink.addColorStop(0, '#ffe45c');
    ink.addColorStop(0.45, '#ff9e2e');
    ink.addColorStop(1, '#ff2e88');
    ctx.lineWidth = Math.max(2, Math.round(size * 0.07));
    ctx.strokeStyle = 'rgba(24, 6, 36, 0.9)';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = Math.round(size * 0.16);
    ctx.shadowOffsetY = Math.round(size * 0.04);
    ctx.strokeText(title, w / 2, band.y + h * 0.4);
    ctx.fillStyle = ink;
    ctx.fillText(title, w / 2, band.y + h * 0.4);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.letterSpacing = '0px';
  }

  const subtitle = (doc.subtitle || '').trim();
  if (subtitle) {
    let size = Math.round(h * 0.17);
    ctx.font = `${size}px Pacifico, cursive`;
    while (ctx.measureText(subtitle).width > w * 0.86 && size > 10) {
      size -= 2;
      ctx.font = `${size}px Pacifico, cursive`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = SUBTITLE_INK;
    // Neon-script glow: a hot pink halo around the script lettering.
    ctx.shadowColor = 'rgba(255, 46, 136, 0.9)';
    ctx.shadowBlur = Math.round(size * 0.4);
    ctx.fillText(subtitle, w / 2, band.y + h * 0.6);
    ctx.shadowBlur = 0;
  }

  drawTagline(ctx, band, w, doc.tagline);
  drawStarsInStrip(ctx, band, w, doc.stars);
}

/** The small caps tagline between subtitle and stars, flanked by short neon
 *  rules — the poster's "in stores" line, in our own words. */
function drawTagline(ctx, band, w, tagline) {
  const text = (tagline || '').trim().toUpperCase();
  if (!text) return;
  const h = band.h;
  let size = Math.round(h * 0.085);
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.letterSpacing = `${Math.round(size * 0.32)}px`;
  while (ctx.measureText(text).width > w * 0.72 && size > 8) {
    size -= 1;
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.letterSpacing = `${Math.round(size * 0.32)}px`;
  }
  const textW = ctx.measureText(text).width;
  const y = band.y + h * 0.76;
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
  ctx.fillStyle = '#eaf7ff';
  ctx.fillText(text, w / 2, y);
  ctx.letterSpacing = '0px';
}

/** A fixed Vice City skyline — low sun behind flat rooftops — along the
 *  strip's top edge. Fixed heights, never random, so exports stay exact. */
const SKYLINE = [0.55, 0.9, 0.4, 1, 0.65, 0.8, 0.35, 0.95, 0.5, 0.75, 0.45, 0.85, 0.6, 0.7, 0.4, 0.9, 0.55, 0.8];
function drawSkyline(ctx, band, w) {
  const top = band.y + band.h * 0.03;
  const base = band.y + band.h * 0.17;
  const sunR = band.h * 0.055;
  const sun = ctx.createRadialGradient(
    w * 0.82, base, sunR * 0.1,
    w * 0.82, base, sunR,
  );
  sun.addColorStop(0, 'rgba(255, 176, 66, 0.85)');
  sun.addColorStop(1, 'rgba(255, 46, 136, 0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(w * 0.82, base, sunR, 0, Math.PI * 2);
  ctx.fill();
  const bw = w / SKYLINE.length;
  ctx.fillStyle = SKYLINE_INK;
  for (let i = 0; i < SKYLINE.length; i++) {
    const bh = (base - top) * SKYLINE[i];
    ctx.fillRect(i * bw + 1, base - bh, bw - 2, bh);
  }
}

/** The star heat-meter, centred on the strip below the subtitle — never
 *  over a photo, so it can never cover a face. */
function drawStarsInStrip(ctx, band, w, stars) {
  const count = 5;
  const r = Math.max(6, Math.round(band.h * 0.055));
  const gap = r * 2.7;
  const total = count * r * 2 + (count - 1) * (gap - r * 2);
  let x = (w - total) / 2;
  const y = band.y + band.h * 0.88;
  for (let i = 0; i < count; i++) {
    drawStar(ctx, x + r, y, r, i < (stars || 0) ? STAR_GOLD : STAR_EMPTY);
    x += gap;
  }
}

/** A small jagged starburst seal in the top-left corner, over sky or
 *  background — the "NEW" sticker on a poster sleeve, kept small so it
 *  accents the cover instead of competing with the photos. The words
 *  shrink to fit inside it, splitting onto two lines when they are long. */
function drawBadge(ctx, w, h, badge) {
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
  ctx.fillStyle = '#ffd166';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = R * 0.25;
  ctx.shadowOffsetY = R * 0.06;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = '#ff2e88';
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

function drawStar(ctx, cx, cy, r, fill) {
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
function drawVignette(ctx, w, h) {
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
function drawGrain(ctx, w, h) {
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

/** The editor's dashed outline around the panel being worked on. */
function drawSelection(ctx, rect) {
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.rotate((rect.rot * Math.PI) / 180);
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = '#22e6ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(-rect.w / 2 - 6, -rect.h / 2 - 6, rect.w + 12, rect.h + 12);
  ctx.restore();
}

/** Which panel (by index) holds point (x, y) on a cover of w by h, or -1.
 *  Panels live in the photo zone above the title strip, so hit-testing uses
 *  that zone's height, not the full cover. */
export function panelAt(layoutId, w, h, x, y) {
  const layout = layoutById(layoutId);
  const panels = layoutPanels(layout, w, captionBand(w, h).y);
  for (let i = panels.length - 1; i >= 0; i--) {
    const r = panels[i];
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const angle = (-r.rot * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
    if (Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.h / 2) return i;
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
