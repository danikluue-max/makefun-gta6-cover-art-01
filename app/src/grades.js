// Colour grades for the Vice Coast cover maker. A grade is a canvas filter
// (saturation, contrast, warmth) plus one or two translucent gradient washes
// laid over each photo with a blend mode, in the spirit of a Vice City sunset
// or a neon night. The washes are drawn inside the panel clip, so the
// lettering on top stays crisp and white.
export const GRADES = [
  {
    id: 'poster-ink',
    name: 'Poster Ink',
    swatch: ['#ff9e2e', '#ff2e88'],
    filter: 'saturate(1.9) contrast(1.32) brightness(1.05)',
    // Comic-book print: the photo is quantised to a few flat tones, then a
    // halftone dot screen is multiplied over it, like a newsstand poster.
    posterize: { levels: 5, halftone: 0.5 },
    washes: [
      {
        from: 'rgba(255, 122, 60, 0.10)',
        to: 'rgba(255, 46, 136, 0.30)',
        blend: 'overlay',
      },
      {
        from: 'rgba(255, 209, 102, 0.12)',
        to: 'rgba(20, 40, 120, 0.18)',
        blend: 'soft-light',
      },
    ],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    swatch: ['#ff7a3c', '#c82878'],
    filter: 'saturate(1.3) contrast(1.08) brightness(1.02)',
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
    washes: [
      {
        from: 'rgba(255, 255, 255, 0.06)',
        to: 'rgba(0, 0, 0, 0.22)',
        blend: 'overlay',
      },
    ],
  },
];

/** Looks a grade up by id, falling back to the first grade. */
export function gradeById(id) {
  return GRADES.find((entry) => entry.id === id) ?? GRADES[0];
}
