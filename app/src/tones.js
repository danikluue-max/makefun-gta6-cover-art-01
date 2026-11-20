// Colour tones for the Vice Coast cover maker, round 3.
//
// A tone is a canvas filter (saturation, contrast, warmth) plus one or two
// translucent gradient washes laid over every photo panel with a blend mode.
// The washes are drawn inside each panel clip AND once more across the
// whole cover (see painter.js), so the grade is the same everywhere: no
// panel can keep its daylight while the rest go sunset.
//
// Round 3 keeps the photo a photo. The print tone is gentle on purpose —
// nine flat tones and a faint dot screen, blended at a low default
// strength — so a face keeps its likeness at full size and at 300 px.
// The old heavy print is what made the hero read as an illustration
// instead of a graded photograph; the dots now texture the print, they
// never draw over it.
export const TONES = [
  {
    id: 'sunset-print',
    name: 'Sunset Print',
    swatch: ['#ff9e2e', '#ff2e88'],
    // The default: a light print over a warm sunset grade. Nine tones, a
    // 0.12 dot screen, strength 0.35 — photographic first, printed second.
    filter: 'saturate(1.45) contrast(1.12) brightness(1.03)',
    print: { levels: 9, screen: 0.12 },
    washes: [
      {
        from: 'rgba(255, 122, 60, 0.08)',
        to: 'rgba(255, 46, 136, 0.22)',
        blend: 'overlay',
      },
      {
        from: 'rgba(255, 209, 102, 0.10)',
        to: 'rgba(20, 40, 120, 0.14)',
        blend: 'soft-light',
      },
    ],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    swatch: ['#ff7a3c', '#c82878'],
    filter: 'saturate(1.3) contrast(1.08) brightness(1.02)',
    print: null,
    washes: [
      {
        from: 'rgba(255, 122, 60, 0)',
        to: 'rgba(255, 90, 40, 0.38)',
        blend: 'overlay',
      },
      {
        from: 'rgba(255, 170, 90, 0.16)',
        to: 'rgba(200, 40, 120, 0.22)',
        blend: 'soft-light',
      },
    ],
  },
  {
    id: 'neon',
    name: 'Neon Night',
    swatch: ['#ff2fb3', '#22e6ff'],
    filter: 'saturate(1.65) contrast(1.14) brightness(1.0)',
    print: null,
    washes: [
      {
        from: 'rgba(255, 47, 179, 0.30)',
        to: 'rgba(34, 230, 255, 0.30)',
        blend: 'overlay',
      },
      {
        from: 'rgba(120, 40, 255, 0.18)',
        to: 'rgba(0, 229, 255, 0.12)',
        blend: 'soft-light',
      },
    ],
  },
  {
    id: 'teal-pink',
    name: 'Teal / Pink',
    swatch: ['#14e5c5', '#ff5e8a'],
    filter: 'saturate(1.35) contrast(1.1)',
    print: null,
    washes: [
      {
        from: 'rgba(20, 229, 197, 0.26)',
        to: 'rgba(255, 94, 138, 0.26)',
        blend: 'overlay',
      },
      {
        from: 'rgba(20, 229, 197, 0.14)',
        to: 'rgba(255, 94, 138, 0.18)',
        blend: 'soft-light',
      },
    ],
  },
  {
    id: 'gold',
    name: 'Gold Hour',
    swatch: ['#ffd166', '#b97a1e'],
    filter: 'sepia(0.32) saturate(1.45) contrast(1.06) brightness(1.03)',
    print: null,
    washes: [
      {
        from: 'rgba(255, 209, 102, 0.10)',
        to: 'rgba(185, 122, 30, 0.30)',
        blend: 'overlay',
      },
      {
        from: 'rgba(255, 220, 130, 0.20)',
        to: 'rgba(160, 90, 10, 0.16)',
        blend: 'soft-light',
      },
    ],
  },
  {
    id: 'mono',
    name: 'Mono Noir',
    swatch: ['#e8e8e8', '#111111'],
    filter: 'grayscale(1) contrast(1.28) brightness(1.06)',
    print: null,
    washes: [
      {
        from: 'rgba(255, 255, 255, 0.06)',
        to: 'rgba(0, 0, 0, 0.22)',
        blend: 'overlay',
      },
    ],
  },
];

/** Looks a tone up by id, falling back to the first tone. */
export function toneById(id) {
  return TONES.find((entry) => entry.id === id) ?? TONES[0];
}
