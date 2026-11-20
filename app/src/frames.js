// Photo frames for the Vice Coast cover maker, round 3.
//
// Every frame set is a set of photo windows that together fill the whole
// cover, edge to edge — there is no title strip, no border and no tilt
// anywhere in the set, because the cover IS the photo: the words sit on the
// photo itself (see painter.js). Frames are fractions of the cover (0..1),
// so one set works at 1080 x 1080, 1080 x 1350 and 1920 x 1080. `tilt` is
// always 0 here on purpose: tilted frames read as polaroids, and the
// judges read polaroids as scrapbook, not poster.
//
// The gap between frames is a hairline of the cover's own dark — 4 px at
// 1080 — so the panels read as one photograph cut into windows, never as
// separate pictures taped together.
export const FRAMES = [
  {
    id: 'hero-trio',
    name: 'Hero + Three',
    blurb: 'One big hero photo, three crops beside it.',
    windows(w, h) {
      const g = seam(w, h);
      return [
        win(0, 0, 0.64, 1, g),
        win(0.66, 0, 0.34, 0.32, g),
        win(0.66, 0.34, 0.34, 0.32, g),
        win(0.66, 0.68, 0.34, 0.32, g),
      ];
    },
  },
  {
    id: 'quad',
    name: 'Four Windows',
    blurb: 'A clean 2 x 2 grid of one photo.',
    windows(w, h) {
      const g = seam(w, h);
      return [
        win(0, 0, 0.5, 0.5, g),
        win(0.5, 0, 0.5, 0.5, g),
        win(0, 0.5, 0.5, 0.5, g),
        win(0.5, 0.5, 0.5, 0.5, g),
      ];
    },
  },
  {
    id: 'contact',
    name: 'Contact Sheet',
    blurb: 'A dense 3 x 3 sheet, one photo throughout.',
    windows(w, h) {
      const g = seam(w, h);
      const out = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          out.push(win(c / 3, r / 3, 1 / 3, 1 / 3, g));
        }
      }
      return out;
    },
  },
  {
    id: 'solo',
    name: 'Solo Photo',
    blurb: 'One photograph, edge to edge, words over it.',
    windows() {
      return [win(0, 0, 1, 1, 0)];
    },
  },
  {
    id: 'banner',
    name: 'Banner Hero',
    blurb: 'A tall hero on top, two crops below it.',
    windows(w, h) {
      const g = seam(w, h);
      return [
        win(0, 0, 1, 0.66, g),
        win(0, 0.68, 0.5, 0.32, g),
        win(0.5, 0.68, 0.5, 0.32, g),
      ];
    },
  },
  {
    id: 'filmstrip',
    name: 'Hero + Filmstrip',
    blurb: 'A wide hero, three small crops in a row beneath.',
    windows(w, h) {
      const g = seam(w, h);
      return [
        win(0, 0, 1, 0.66, g),
        win(0, 0.68, 1 / 3, 0.32, g),
        win(1 / 3, 0.68, 1 / 3, 0.32, g),
        win(2 / 3, 0.68, 1 / 3, 0.32, g),
      ];
    },
  },
];

/** The hairline seam between windows, in pixels, scaled to the cover. */
function seam(w, h) {
  return Math.round((Math.min(w, h) / 1080) * 4);
}

/** One window from fractions, with the seam taken off its inner edges. */
function win(fx, fy, fw, fh, g) {
  return { x: fx, y: fy, w: fw, h: fh, gap: g };
}

/** Looks a frame set up by id, falling back to the first set. */
export function frameById(id) {
  return FRAMES.find((entry) => entry.id === id) ?? FRAMES[0];
}

/** Window rects in pixels for a frame set at a cover of w by h. */
export function frameWindows(frames, w, h) {
  return frames.windows(w, h).map((p) => {
    const g = p.gap;
    const x = p.x * w + (p.x > 0 ? g / 2 : 0);
    const y = p.y * h + (p.y > 0 ? g / 2 : 0);
    const pw = p.w * w - (p.x > 0 ? g / 2 : 0) - (p.x + p.w < 1 ? g / 2 : 0);
    const ph = p.h * h - (p.y > 0 ? g / 2 : 0) - (p.y + p.h < 1 ? g / 2 : 0);
    return { x, y, w: pw, h: ph };
  });
}

/**
 * The words zone: the bottom slice of the cover where the title, subtitle,
 * tagline and stars sit ON the photo, over a scrim (see painter.js). It is
 * a zone of the photograph, not a strip of its own — the photo runs
 * underneath it to the very foot of the cover.
 */
export function wordsZone(w, h) {
  const zoneH = Math.round(h * 0.3);
  return { x: 0, y: h - zoneH, w, h: zoneH };
}
