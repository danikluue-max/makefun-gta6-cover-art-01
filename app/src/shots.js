// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos
// loaded; ?shot=cover shows the cover alone at the requested post size.
// Query knobs: size=square|portrait|landscape, layout=<id>, grade=<id>,
// strength=<0-100 print strength>, photo=<sample for panels 1, 6, 11...>,
// photo2=<sample for panels 2, 7...>, photo3=<sample for panels 3, 8...>,
// photo4=<sample for panels 4, 9...>, photo5=<sample for panels 5, 10...>,
// title=<words>, subtitle=<words>, tagline=<words>, badge=<words>, stars=<0-5>.
// window.__shotReady is set by main.js once the scene is painted.

// One distinct crop per panel index, so no two panels ever show the same
// slice of a photo: the three samples rotate, and every panel gets its own
// zoom and pan. Zoom stays modest — the pier and boulevard samples are only
// 720 px tall, so a big zoom would go soft at export size. The pans are
// positive, which frames the top of each photo, where the faces are;
// drawPanel clamps them to the photo's edge, so a big value just pins to
// the top on squarer panels.
const CROPS = [
  { zoom: 1.1, ox: -0.08, oy: 0.16 },
  { zoom: 1.3, ox: 0.12, oy: 0.9 },
  { zoom: 1.15, ox: 0.1, oy: 0.8 },
  { zoom: 1.35, ox: -0.1, oy: 1.1 },
  { zoom: 1.2, ox: 0.08, oy: 0.85 },
  { zoom: 1.4, ox: -0.12, oy: 1.0 },
  { zoom: 1.12, ox: -0.05, oy: 0.9 },
  { zoom: 1.28, ox: 0.06, oy: 0.75 },
  { zoom: 1.45, ox: 0.1, oy: 1.2 },
];

/** The framing for panel `i`: its own zoom and pan, never a copy. */
export function panelCrop(i) {
  return CROPS[i % CROPS.length];
}

export async function runShot(shot, query, api) {
  const size = query.get('size') ?? 'square';
  const layout = query.get('layout') ?? 'hero-three';
  const grade = query.get('grade') ?? 'poster-ink';
  const title = query.get('title') ?? 'VICE COAST';
  const subtitle = query.get('subtitle') ?? 'every street has a story';
  const tagline = query.get('tagline') ?? 'ONE NIGHT ON THE COAST';
  const badge = query.get('badge') ?? 'NEW';
  const stars = Number(query.get('stars') ?? 5);
  // How hard the print layer bites (0–100): the shots use the same gentle
  // default as the editor, so the faces stay photographic.
  const strength = query.get('strength');
  const intensity = strength === null ? 0.6 : Math.max(0, Math.min(1, Number(strength) / 100));
  const photo = query.get('photo') ?? 'rider';
  const photo2 = query.get('photo2') ?? 'neon';
  const photo3 = query.get('photo3') ?? 'street';
  const photo4 = query.get('photo4') ?? 'pier';
  const photo5 = query.get('photo5') ?? 'boulevard';

  if (shot === 'cover') document.body.classList.add('shot-cover');

  await api.apply({
    size: ['square', 'portrait', 'landscape'].includes(size) ? size : 'square',
    layout,
    grade,
    intensity,
    title,
    subtitle,
    tagline,
    badge,
    stars,
    grain: true,
    vignette: true,
  });

  // Panels rotate through the five samples, each with its own crop, so a
  // shot shows all five photos and no two panels look alike. The two new
  // faces (rider, neon) lead the pool, so panel 1 — the hero — is a new face.
  const count = { 'hero-three': 4, 'grid-4': 4, 'grid-9': 9, 'full-bleed': 1, tilted: 3, story: 3 }[layout] ?? 4;
  const pool = [photo, photo2, photo3, photo4, photo5];
  const frames = [];
  for (let i = 0; i < count; i++) {
    frames.push({ src: `samples/${pool[i % 5]}.jpg`, ...panelCrop(i) });
  }
  // A shot can pin one panel's framing with crop<i>=zoom,ox,oy (cover 1
  // pins panels 1 and 3: the shared crops cut both faces in the wide
  // landscape strips, so this shot alone zooms out and re-centres them
  // until forehead-to-chin sits whole inside the panel).
  for (let i = 0; i < frames.length; i++) {
    const pinned = query.get(`crop${i}`);
    if (!pinned) continue;
    const [zoom, ox, oy] = pinned.split(',').map(Number);
    if ([zoom, ox, oy].every(Number.isFinite)) frames[i] = { ...frames[i], zoom, ox, oy };
  }
  await api.setPanels(frames);
  api.draw();
}
