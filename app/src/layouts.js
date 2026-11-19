// Layouts for the Vice Coast cover maker: every layout is a set of photo panels
// plus the band where the poster lettering sits. Panels are given in fractions
// of the cover (0..1) so the same layout works at 1080 x 1080, 1080 x 1350 and
// 1920 x 1080; cover.js scales them to pixels. `rot` is a tilt in degrees
// around the panel centre. The caption band always sits along the foot of the
// cover, over a scrim, so the title stays legible on any photo.
export const LAYOUTS = [
  {
    id: 'hero-three',
    name: 'Hero + Three',
    blurb: 'One big hero shot, three stacked beside it.',
    panels(w, h) {
      const g = gap(w, h);
      return [
        panel(0, 0, 0.64, 1, g, 0),
        panel(0.66, 0, 0.34, 0.32, g, 0),
        panel(0.66, 0.34, 0.34, 0.32, g, 0),
        panel(0.66, 0.68, 0.34, 0.32, g, 0),
      ];
    },
  },
  {
    id: 'grid-4',
    name: 'Four Panel',
    blurb: 'A clean 2 x 2 grid of moments.',
    panels(w, h) {
      const g = gap(w, h);
      return [
        panel(0, 0, 0.49, 0.49, g, 0),
        panel(0.51, 0, 0.49, 0.49, g, 0),
        panel(0, 0.51, 0.49, 0.49, g, 0),
        panel(0.51, 0.51, 0.49, 0.49, g, 0),
      ];
    },
  },
  {
    id: 'grid-9',
    name: 'Nine Panel',
    blurb: 'A dense 3 x 3 contact sheet.',
    panels(w, h) {
      const g = gap(w, h);
      const out = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          out.push(panel(c * 0.34, r * 0.34, 0.32, 0.32, g, 0));
        }
      }
      return out;
    },
  },
  {
    id: 'full-bleed',
    name: 'Full Bleed',
    blurb: 'One photo edge to edge, title in its own strip below.',
    panels() {
      return [panel(0, 0, 1, 1, 0, 0)];
    },
  },
  {
    id: 'tilted',
    name: 'Tilted Snapshots',
    blurb: 'Polaroid-style tilted frames, one big and two small.',
    panels(w, h) {
      const g = gap(w, h);
      return [
        panel(0.02, 0.05, 0.6, 0.84, g, -3),
        panel(0.66, 0.07, 0.32, 0.38, g, 2),
        panel(0.66, 0.53, 0.32, 0.38, g, -2),
      ];
    },
  },
  {
    id: 'story',
    name: 'Story Stack',
    blurb: 'A tall hero on top, two frames below it.',
    panels(w, h) {
      const g = gap(w, h);
      return [
        panel(0, 0, 1, 0.6, g, 0),
        panel(0, 0.62, 0.49, 0.38, g, 0),
        panel(0.51, 0.62, 0.49, 0.38, g, 0),
      ];
    },
  },
];

/** The white gap between panels, in pixels, scaled to the cover size. */
function gap(w, h) {
  return Math.round((Math.min(w, h) / 1080) * 12);
}

/** One panel rect from fractions, shrunk by the gap on its inner edges. */
function panel(fx, fy, fw, fh, g, rot) {
  return {
    x: fx,
    y: fy,
    w: fw,
    h: fh,
    gap: g,
    rot,
  };
}

/** Looks a layout up by id, falling back to the first layout. */
export function layoutById(id) {
  return LAYOUTS.find((entry) => entry.id === id) ?? LAYOUTS[0];
}

/** Panel rects in pixels for a layout at a cover of w by h. */
export function layoutPanels(layout, w, h) {
  return layout.panels(w, h).map((p) => {
    const g = p.gap;
    const x = p.x * w + (p.x > 0 ? g / 2 : 0);
    const y = p.y * h + (p.y > 0 ? g / 2 : 0);
    const pw = p.w * w - (p.x > 0 ? g / 2 : 0) - (p.x + p.w < 1 ? g / 2 : 0);
    const ph = p.h * h - (p.y > 0 ? g / 2 : 0) - (p.y + p.h < 1 ? g / 2 : 0);
    return { x, y, w: pw, h: ph, rot: p.rot };
  });
}

// The solid title strip along the foot of the cover: it owns every word and
// the star meter, so lettering can never run off the bottom edge and no
// caption ever sits on a face. Photos live above it, never under it.
export function captionBand(w, h) {
  const bandH = Math.round(h * (h >= w ? 0.21 : 0.26));
  return { x: 0, y: h - bandH, w, h: bandH };
}
