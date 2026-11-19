// Wires the Vice Coast Cover Studio: photo slots, layouts, grades, caption,
// badge and stars, undo/redo, drag-to-pan and wheel-to-zoom on the preview,
// and PNG export in the three post sizes. A `?shot=` query sets up a fixed
// scene for a screenshot instead (./shots.js).
import { renderCover, ensureFonts, exportCoverPNG, panelAt } from './cover.js';
import { LAYOUTS, layoutById } from './layouts.js';
import { GRADES, gradeById } from './grades.js';
import { runShot, panelCrop } from './shots.js';

export const SIZES = {
  square: { label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  portrait: { label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  landscape: { label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
};

const PRESETS = [
  { title: 'VICE COAST', subtitle: 'every street has a story', tagline: 'ONE NIGHT ON THE COAST' },
  { title: 'NEON TIDE', subtitle: 'the city never sleeps', tagline: 'FIVE STARS AFTER DARK' },
  { title: 'PALM STATIC', subtitle: 'tuned to the sunset', tagline: 'LIVE FROM THE BOULEVARD' },
  { title: 'BOULEVARD QUEEN', subtitle: 'crown the avenue', tagline: 'QUEEN OF THE GOLDEN HOUR' },
  { title: 'SUNSET RUN', subtitle: 'outrun the golden hour', tagline: 'FULL THROTTLE AT DUSK' },
  { title: 'MIDNIGHT HARBOR', subtitle: 'where the tide keeps secrets', tagline: 'LAST BOAT OUT AT MIDNIGHT' },
];

const SAMPLES = [
  { id: 'rider', label: 'Rider', src: 'samples/rider.jpg' },
  { id: 'neon', label: 'Neon', src: 'samples/neon.jpg' },
  { id: 'street', label: 'Street', src: 'samples/street.jpg' },
  { id: 'pier', label: 'Pier', src: 'samples/pier.jpg' },
  { id: 'boulevard', label: 'Boulevard', src: 'samples/boulevard.jpg' },
];

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const taglineInput = document.getElementById('tagline');
const badgeInput = document.getElementById('badge');
const starsInput = document.getElementById('stars');
const grainInput = document.getElementById('grain');
const vignetteInput = document.getElementById('vignette');
const zoomInput = document.getElementById('zoom');
const zoomValue = document.getElementById('zoom-value');
const fileInput = document.getElementById('photo-file');
const selectedLabel = document.getElementById('selected-label');

/** The cover document: layout, grade, words, effects and one photo per panel. */
let doc = freshDoc();
let selected = 0;
let undoStack = [];
let redoStack = [];
let pendingSlot = 0;
let dragging = null;

function freshDoc() {
  return {
    size: 'square',
    layout: 'hero-three',
    grade: 'poster-ink',
    title: 'VICE COAST',
    subtitle: 'every street has a story',
    tagline: 'ONE NIGHT ON THE COAST',
    badge: 'NEW',
    stars: 5,
    grain: true,
    vignette: true,
    panels: [],
  };
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function say(text) {
  statusEl.textContent = text;
}

function panelCount() {
  return layoutById(doc.layout).panels(1080, 1080).length;
}

/** Keeps the panel list the layout's length, carrying photos across layouts. */
function syncPanels() {
  const keep = doc.panels.slice(0, panelCount());
  while (keep.length < panelCount()) keep.push({ img: null, src: null, zoom: 1, ox: 0, oy: 0 });
  doc.panels = keep;
  if (selected >= doc.panels.length) selected = 0;
}

function redraw() {
  const size = SIZES[doc.size];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  // The dashed selection outline is editor chrome: it shows while the maker
  // works, never on a cover shot or an exported PNG.
  const coverShot = document.body.classList.contains('shot-cover');
  renderCover(canvas, doc, { editor: !coverShot, selected: coverShot ? -1 : selected });
  refreshSlots();
  refreshZoom();
}

/** A snapshot of the document without image objects, for undo and redo. */
function snapshot() {
  return JSON.stringify({
    ...doc,
    panels: doc.panels.map((p) => ({ src: p.src, zoom: p.zoom, ox: p.ox, oy: p.oy })),
  });
}

async function restore(text) {
  const saved = JSON.parse(text);
  const panels = [];
  for (const p of saved.panels) {
    panels.push({
      img: p.src ? await loadImage(p.src) : null,
      src: p.src,
      zoom: p.zoom,
      ox: p.ox,
      oy: p.oy,
    });
  }
  doc = { ...saved, panels };
  titleInput.value = doc.title;
  subtitleInput.value = doc.subtitle;
  taglineInput.value = doc.tagline || '';
  badgeInput.value = doc.badge;
  starsInput.value = String(doc.stars);
  grainInput.checked = doc.grain;
  vignetteInput.checked = doc.vignette;
  syncPanels();
  refreshLayoutButtons();
  refreshGradeButtons();
  refreshSizeButtons();
  redraw();
}

function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  refreshHistoryButtons();
}

async function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  await restore(undoStack.pop());
  textDirty.title = textDirty.subtitle = textDirty.tagline = textDirty.badge = false;
  refreshHistoryButtons();
  say('Undid the last change.');
}

async function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  await restore(redoStack.pop());
  textDirty.title = textDirty.subtitle = textDirty.tagline = textDirty.badge = false;
  refreshHistoryButtons();
  say('Redid the change.');
}

function refreshHistoryButtons() {
  document.getElementById('undo').disabled = undoStack.length === 0;
  document.getElementById('redo').disabled = redoStack.length === 0;
}

// ---- Layout, grade and size pickers ---------------------------------------

function buildLayoutButtons() {
  const list = document.getElementById('layout-list');
  for (const layout of LAYOUTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pick';
    button.dataset.layout = layout.id;
    button.innerHTML = `<span class="pick-name">${layout.name}</span><span class="pick-blurb">${layout.blurb}</span>`;
    button.addEventListener('click', () => {
      if (doc.layout === layout.id) return;
      pushHistory();
      doc.layout = layout.id;
      syncPanels();
      refreshLayoutButtons();
      redraw();
      say(`Layout: ${layout.name}.`);
    });
    list.appendChild(button);
  }
}

function refreshLayoutButtons() {
  for (const button of document.querySelectorAll('#layout-list .pick')) {
    button.classList.toggle('active', button.dataset.layout === doc.layout);
  }
}

function buildGradeButtons() {
  const list = document.getElementById('grade-list');
  for (const grade of GRADES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pick';
    button.dataset.grade = grade.id;
    const stops = grade.swatch.map((c, i) => `${c} ${i * 100}%`).join(', ');
    button.innerHTML = `<span class="swatch" style="background:linear-gradient(135deg, ${stops})"></span><span class="pick-name">${grade.name}</span>`;
    button.addEventListener('click', () => {
      if (doc.grade === grade.id) return;
      pushHistory();
      doc.grade = grade.id;
      refreshGradeButtons();
      redraw();
      say(`Grade: ${grade.name}.`);
    });
    list.appendChild(button);
  }
}

function refreshGradeButtons() {
  for (const button of document.querySelectorAll('#grade-list .pick')) {
    button.classList.toggle('active', button.dataset.grade === doc.grade);
  }
}

function refreshSizeButtons() {
  for (const button of document.querySelectorAll('.size-btn')) {
    button.classList.toggle('active', button.dataset.size === doc.size);
  }
}

// ---- Photo slots -----------------------------------------------------------

function refreshSlots() {
  const list = document.getElementById('photo-slots');
  list.innerHTML = '';
  doc.panels.forEach((panel, i) => {
    const row = document.createElement('div');
    row.className = `slot${i === selected ? ' selected' : ''}`;
    const thumb = panel.img
      ? `<img class="slot-thumb" src="${panel.src}" alt="Panel ${i + 1} photo">`
      : '<span class="slot-thumb empty">No photo</span>';
    row.innerHTML = `${thumb}<span class="slot-name">Panel ${i + 1}</span>`;
    const upload = document.createElement('button');
    upload.type = 'button';
    upload.textContent = 'Upload';
    upload.addEventListener('click', () => {
      pendingSlot = i;
      fileInput.click();
    });
    const samples = document.createElement('span');
    samples.className = 'slot-samples';
    for (const sample of SAMPLES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = sample.label;
      button.addEventListener('click', async () => {
        pushHistory();
        try {
          // A sample lands with this panel's own crop, so two panels never
          // show the same slice even when they share a photo.
          doc.panels[i] = { img: await loadImage(sample.src), src: sample.src, ...panelCrop(i) };
          selected = i;
          redraw();
          say(`Panel ${i + 1}: ${sample.label} sample loaded.`);
        } catch {
          say(`Could not load the ${sample.label} sample.`);
        }
      });
      samples.appendChild(button);
    }
    row.appendChild(upload);
    row.appendChild(samples);
    row.addEventListener('click', (event) => {
      if (event.target === row || event.target.classList.contains('slot-name')) {
        selected = i;
        redraw();
      }
    });
    list.appendChild(row);
  });
  selectedLabel.textContent = `Panel ${selected + 1} of ${doc.panels.length} selected — drag its photo to move it, scroll to zoom.`;
}

function refreshZoom() {
  const panel = doc.panels[selected];
  if (!panel) return;
  zoomInput.value = String(panel.zoom || 1);
  zoomValue.textContent = `${Math.round((panel.zoom || 1) * 100)}%`;
}

// ---- Drag to pan, wheel to zoom --------------------------------------------

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const hit = panelAt(doc.layout, canvas.width, canvas.height, point.x, point.y);
  if (hit < 0) return;
  selected = hit;
  pushHistory();
  dragging = { startX: point.x, startY: point.y, ox: doc.panels[hit].ox, oy: doc.panels[hit].oy };
  canvas.setPointerCapture(event.pointerId);
  redraw();
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const point = canvasPoint(event);
  const panel = doc.panels[selected];
  const rect = { w: canvas.width, h: canvas.height };
  panel.ox = dragging.ox + (point.x - dragging.startX) / rect.w;
  panel.oy = dragging.oy + (point.y - dragging.startY) / rect.h;
  panel.ox = Math.max(-0.6, Math.min(0.6, panel.ox));
  panel.oy = Math.max(-0.6, Math.min(0.6, panel.oy));
  redraw();
});

canvas.addEventListener('pointerup', () => {
  dragging = null;
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const panel = doc.panels[selected];
  if (!panel) return;
  if (event.deltaY === 0) return;
  pushHistory();
  panel.zoom = Math.max(1, Math.min(3, (panel.zoom || 1) * (event.deltaY < 0 ? 1.08 : 0.93)));
  redraw();
}, { passive: false });

zoomInput.addEventListener('input', () => {
  const panel = doc.panels[selected];
  if (!panel) return;
  panel.zoom = Number(zoomInput.value);
  refreshZoom();
  redraw();
});

document.getElementById('reset-pan').addEventListener('click', () => {
  const panel = doc.panels[selected];
  if (!panel) return;
  pushHistory();
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  redraw();
  say(`Panel ${selected + 1} reframed.`);
});

// ---- Uploads and fill-all ---------------------------------------------------

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  pushHistory();
  try {
    doc.panels[pendingSlot] = { img: await loadImage(dataUrl), src: dataUrl, zoom: 1, ox: 0, oy: 0 };
    selected = pendingSlot;
    redraw();
    say(`Panel ${pendingSlot + 1}: your photo is in.`);
  } catch {
    say('That file could not be read as a photo.');
  }
});

document.getElementById('fill-all').addEventListener('click', async () => {
  const source = doc.panels.find((p) => p.img);
  if (!source) {
    say('Load a photo into any panel first, then Fill all copies it everywhere.');
    return;
  }
  pushHistory();
  // One photo fills every panel, but each panel keeps its own crop — the
  // result is a set of different framings, never the same shot repeated.
  doc.panels = doc.panels.map((_, i) => ({ img: source.img, src: source.src, ...panelCrop(i) }));
  redraw();
  say('One photo now fills every panel, each with its own crop.');
});

// ---- Words ------------------------------------------------------------------

// Text edits snapshot on the FIRST keystroke of a burst, before the
// document takes the new words: the snapshot then holds what was there
// before the edit, so undo restores it. (A focus listener would be the
// obvious hook, but a headless page never fires focus events, so the
// first-input guard is the reliable one.) The burst ends on blur, or on
// any undo/redo, which reset the flags.
const textDirty = { title: false, subtitle: false, tagline: false, badge: false };
function wireText(input, key) {
  input.addEventListener('input', () => {
    if (!textDirty[key]) {
      pushHistory();
      textDirty[key] = true;
    }
    doc[key] = input.value;
    redraw();
  });
  input.addEventListener('blur', () => {
    textDirty[key] = false;
  });
}
wireText(titleInput, 'title');
wireText(subtitleInput, 'subtitle');
wireText(taglineInput, 'tagline');
wireText(badgeInput, 'badge');
starsInput.addEventListener('change', () => {
  pushHistory();
  doc.stars = Number(starsInput.value);
  redraw();
});
grainInput.addEventListener('change', () => {
  pushHistory();
  doc.grain = grainInput.checked;
  redraw();
});
vignetteInput.addEventListener('change', () => {
  pushHistory();
  doc.vignette = vignetteInput.checked;
  redraw();
});

function buildPresets() {
  const list = document.getElementById('preset-list');
  for (const preset of PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = preset.title;
    button.addEventListener('click', () => {
      pushHistory();
      doc.title = preset.title;
      doc.subtitle = preset.subtitle;
      doc.tagline = preset.tagline;
      titleInput.value = preset.title;
      subtitleInput.value = preset.subtitle;
      taglineInput.value = preset.tagline;
      redraw();
      say(`Caption: ${preset.title} — ${preset.subtitle}.`);
    });
    list.appendChild(button);
  }
}

// ---- Sizes and export --------------------------------------------------------

for (const button of document.querySelectorAll('.size-btn')) {
  button.addEventListener('click', () => {
    if (doc.size === button.dataset.size) return;
    pushHistory();
    doc.size = button.dataset.size;
    refreshSizeButtons();
    redraw();
    say(`Post size: ${SIZES[doc.size].label}.`);
  });
}

async function downloadPNG(sizeId) {
  const size = SIZES[sizeId];
  const blob = await exportCoverPNG(doc, size.w, size.h);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vice-coast-${sizeId}-${size.w}x${size.h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  say(`Saved ${a.download} (${Math.round(blob.size / 1024)} KB).`);
}

for (const button of document.querySelectorAll('.export-btn')) {
  button.addEventListener('click', async () => {
    try {
      await downloadPNG(button.dataset.size);
    } catch {
      say('Export failed — try again.');
    }
  });
}

document.getElementById('export-all').addEventListener('click', async () => {
  try {
    for (const sizeId of Object.keys(SIZES)) {
      // eslint-disable-next-line no-await-in-loop
      await downloadPNG(sizeId);
    }
  } catch {
    say('One of the exports failed — try again.');
  }
});

// ---- History buttons ---------------------------------------------------------

document.getElementById('undo').addEventListener('click', undo);
document.getElementById('redo').addEventListener('click', redo);
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
  }
});

// ---- For the screenshot driver: export a size and hand back its PNG data -----
window.__exportCover = async (sizeId) => {
  const size = SIZES[sizeId];
  const blob = await exportCoverPNG(doc, size.w, size.h);
  const dataUrl = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
  return { width: size.w, height: size.h, bytes: blob.size, dataUrl };
};

// ---- Start -------------------------------------------------------------------

async function start() {
  syncPanels();
  buildLayoutButtons();
  buildGradeButtons();
  buildPresets();
  refreshLayoutButtons();
  refreshGradeButtons();
  refreshSizeButtons();
  refreshHistoryButtons();
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), {
      loadSample: loadImage,
      apply: async (next) => {
        pushHistory();
        Object.assign(doc, next);
        syncPanels();
        titleInput.value = doc.title;
        subtitleInput.value = doc.subtitle;
        taglineInput.value = doc.tagline || '';
        badgeInput.value = doc.badge;
        starsInput.value = String(doc.stars);
        grainInput.checked = doc.grain;
        vignetteInput.checked = doc.vignette;
        refreshLayoutButtons();
        refreshGradeButtons();
        refreshSizeButtons();
      },
      draw: () => redraw(),
      setPanels: async (frames) => {
        const panels = [];
        for (const frame of frames) {
          // A frame is { src, zoom, ox, oy } — or a bare sample URL, which
          // frames at 1:1. Every panel keeps its own crop, never a clone.
          const src = typeof frame === 'string' ? frame : frame.src;
          const crop = typeof frame === 'string'
            ? { zoom: 1, ox: 0, oy: 0 }
            : { zoom: frame.zoom ?? 1, ox: frame.ox ?? 0, oy: frame.oy ?? 0 };
          panels.push(src
            ? { img: await loadImage(src), src, ...crop }
            : { img: null, src: null, zoom: 1, ox: 0, oy: 0 });
        }
        doc.panels = panels;
      },
    });
  } else {
    // A cover on screen at once: the five sample photos, rotating, each
    // panel with its own crop so none of them repeats. The two new faces
    // (Rider, Neon) lead the rotation so the first panels show them.
    const rider = await loadImage(SAMPLES[0].src);
    const neon = await loadImage(SAMPLES[1].src);
    const street = await loadImage(SAMPLES[2].src);
    const pier = await loadImage(SAMPLES[3].src);
    const boulevard = await loadImage(SAMPLES[4].src);
    const loaded = [rider, neon, street, pier, boulevard];
    doc.panels = doc.panels.map((_, i) => {
      const sample = SAMPLES[i % 5];
      return { img: loaded[i % 5], src: sample.src, ...panelCrop(i) };
    });
  }
  await ensureFonts();
  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

start().catch((error) => {
  say(`Could not start the studio: ${error.message}`);
});
