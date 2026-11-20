// Wiring for the Vice Coast cover maker, round 3.
//
// The studio opens with ONE photo in every window of the cover — a set of
// crops of a single photograph, the way a real poster is made. That is the
// whole point of round 3: the cover is a photograph, graded, with words
// laid over it. Add your own photo and it fills every window; pick a
// sample and it does the same. Each window can still be re-framed or
// swapped on its own — the photo controls live on the window itself —
// but the default is always one photo, every window.
//
// Layout, in the page, in order: 1. your photo (the big first step),
// 2. the windows (per-window photo, zoom, reset), 3. layout,
// 4. grade, 5. words, 6. finish and export.
import { FRAMES, frameById } from './frames.js';
import { TONES, toneById } from './tones.js';
import { renderCover, windowAt, exportCoverPNG, ensureFonts } from './painter.js';
import { EXPORT_SIZES, buildShotDoc, cropFor } from './scenes.js';

export const SAMPLES = [
  { id: 'neon', name: 'Neon', url: 'samples/neon.jpg' },
  { id: 'rider', name: 'Rider', url: 'samples/rider.jpg' },
  { id: 'street', name: 'Street', url: 'samples/street.jpg' },
  { id: 'boulevard', name: 'Boulevard', url: 'samples/boulevard.jpg' },
  { id: 'pier', name: 'Pier', url: 'samples/pier.jpg' },
];

// Six named looks. Each one is a frame, a tone and a set of words over
// ONE photo — the photo is part of the look, and every look stays as
// strong as the hero because every look IS the same construction: a
// graded photograph with the title over it.
const PRESETS = [
  {
    name: 'Vice Coast', frame: 'hero-trio', tone: 'sunset-print', photo: 'neon',
    title: 'VICE COAST', subtitle: 'every street has a story',
    tagline: 'ONE NIGHT ON THE COAST', badge: 'NEW', stars: 5,
  },
  {
    name: 'Neon Tide', frame: 'hero-trio', tone: 'neon', photo: 'neon',
    title: 'NEON TIDE', subtitle: 'the city never sleeps',
    tagline: 'FIVE STARS AFTER DARK', badge: 'NEW', stars: 5,
  },
  {
    name: 'Gold Hour', frame: 'banner', tone: 'gold', photo: 'boulevard',
    title: 'GOLD HOUR', subtitle: 'outrun the sunset',
    tagline: 'FULL THROTTLE AT DUSK', badge: 'NEW', stars: 5,
  },
  {
    name: 'Palm Static', frame: 'quad', tone: 'sunset', photo: 'street',
    title: 'PALM STATIC', subtitle: 'heat on the boulevard',
    tagline: 'ONE NIGHT ON THE COAST', badge: 'NEW', stars: 5,
  },
  {
    name: 'Sunset Run', frame: 'filmstrip', tone: 'sunset-print', photo: 'street',
    title: 'SUNSET RUN', subtitle: 'outrun the golden hour',
    tagline: 'FULL THROTTLE AT DUSK', badge: 'NEW', stars: 5,
  },
  {
    name: 'Midnight Harbor', frame: 'solo', tone: 'mono', photo: 'pier',
    title: 'MIDNIGHT HARBOR', subtitle: 'quiet water, loud night',
    tagline: 'FIVE STARS AFTER DARK', badge: 'NEW', stars: 5,
  },
];

const $ = (sel) => document.querySelector(sel);
const canvas = $('#cover');
const stage = $('#stage');

let doc = null;
let undoStack = [];
let redoStack = [];
let selected = 0;
let shotMode = null;

function freshDoc() {
  return {
    size: 'landscape',
    frame: 'hero-trio',
    tone: 'sunset-print',
    strength: 0.35,
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

function loadPhoto(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load ' + url));
    img.src = url;
  });
}

/** One photo, every window — each window its own crop of it. */
function fillAllWindows(img) {
  const count = frameById(doc.frame).windows(1, 1).length;
  doc.panels = [];
  for (let i = 0; i < count; i++) {
    const framing = cropFor(i, count);
    doc.panels.push({ img, zoom: framing.zoom, ox: framing.ox, oy: framing.oy });
  }
}

/** A snapshot of the doc for undo/redo (images are shared by reference). */
function snapshot() {
  return {
    ...doc,
    panels: doc.panels.map((p) => ({ ...p })),
  };
}

function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  syncUndoButtons();
}

function restore(state) {
  doc = { ...state, panels: state.panels.map((p) => ({ ...p })) };
  syncAll();
  render();
}

function syncUndoButtons() {
  $('#undoBtn').disabled = undoStack.length === 0;
  $('#redoBtn').disabled = redoStack.length === 0;
}

async function applyPreset(preset) {
  pushHistory();
  const entry = SAMPLES.find((s) => s.id === preset.photo) ?? SAMPLES[0];
  const img = await loadPhoto(entry.url);
  doc.frame = preset.frame;
  doc.tone = preset.tone;
  doc.title = preset.title;
  doc.subtitle = preset.subtitle;
  doc.tagline = preset.tagline;
  doc.badge = preset.badge;
  doc.stars = preset.stars;
  fillAllWindows(img);
  selected = 0;
  syncAll();
  render();
}

async function applyPhoto(entry) {
  pushHistory();
  const img = await loadPhoto(entry.url);
  fillAllWindows(img);
  selected = 0;
  syncAll();
  render();
}

async function replaceWindow(index, file) {
  const url = URL.createObjectURL(file);
  const img = await loadPhoto(url);
  pushHistory();
  const framing = cropFor(index, doc.panels.length);
  doc.panels[index] = { img, zoom: framing.zoom, ox: framing.ox, oy: framing.oy };
  selected = index;
  syncAll();
  render();
}

function setFrame(id) {
  if (doc.frame === id) return;
  pushHistory();
  const first = doc.panels[0];
  doc.frame = id;
  // Keep the cover's photo when the frame changes: re-crop the same
  // photograph into the new windows instead of emptying them.
  const count = frameById(id).windows(1, 1).length;
  const img = first ? first.img : null;
  doc.panels = [];
  for (let i = 0; i < count; i++) {
    const framing = cropFor(i, count);
    doc.panels.push(img
      ? { img, zoom: framing.zoom, ox: framing.ox, oy: framing.oy }
      : { img: null, zoom: 1, ox: 0, oy: 0 });
  }
  selected = 0;
  syncAll();
  render();
}

function setTone(id) {
  if (doc.tone === id) return;
  pushHistory();
  doc.tone = id;
  syncAll();
  render();
}

function setSize(id) {
  if (doc.size === id) return;
  doc.size = id;
  syncAll();
  render();
}

function setStrength(value) {
  doc.strength = value;
  $('#strengthVal').textContent = Math.round(value * 100) + '%';
  render();
}

function render() {
  const size = EXPORT_SIZES[doc.size];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  renderCover(canvas, doc, { editor: true, selected });
  window.__shotReady = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}

function syncAll() {
  // Frame buttons.
  document.querySelectorAll('[data-frame]').forEach((b) => {
    b.classList.toggle('active', b.dataset.frame === doc.frame);
  });
  // Tone buttons.
  document.querySelectorAll('[data-tone]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tone === doc.tone);
  });
  // Size buttons.
  document.querySelectorAll('[data-size]').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === doc.size);
  });
  // Words.
  $('#titleInput').value = doc.title;
  $('#subtitleInput').value = doc.subtitle;
  $('#taglineInput').value = doc.tagline;
  $('#badgeInput').value = doc.badge;
  document.querySelectorAll('[data-stars]').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.stars) === doc.stars);
  });
  // Strength.
  $('#strengthRange').value = String(doc.strength);
  $('#strengthVal').textContent = Math.round(doc.strength * 100) + '%';
  // Toggles.
  $('#grainCheck').checked = doc.grain;
  $('#vignetteCheck').checked = doc.vignette;
  // Per-window rows.
  buildWindowRows();
  syncUndoButtons();
}

function buildWindowRows() {
  const list = $('#windowList');
  list.innerHTML = '';
  doc.panels.forEach((panel, i) => {
    const row = document.createElement('div');
    row.className = 'window-row' + (i === selected ? ' selected' : '');
    const thumb = document.createElement('img');
    thumb.className = 'window-thumb';
    thumb.alt = 'Window ' + (i + 1);
    if (panel.img) thumb.src = panel.img.src;
    const label = document.createElement('div');
    label.className = 'window-label';
    label.textContent = 'Window ' + (i + 1);
    const upload = document.createElement('button');
    upload.className = 'mini-btn';
    upload.type = 'button';
    upload.textContent = 'Upload';
    upload.addEventListener('click', (e) => {
      e.stopPropagation();
      openFilePicker((file) => replaceWindow(i, file));
    });
    const zoom = document.createElement('input');
    zoom.type = 'range';
    zoom.min = '1';
    zoom.max = '3';
    zoom.step = '0.05';
    zoom.value = String(panel.zoom || 1);
    zoom.setAttribute('aria-label', 'Zoom window ' + (i + 1));
    zoom.addEventListener('input', () => {
      doc.panels[i].zoom = parseFloat(zoom.value);
      render();
    });
    zoom.addEventListener('change', () => pushHistory());
    const reset = document.createElement('button');
    reset.className = 'mini-btn';
    reset.type = 'button';
    reset.textContent = 'Reset';
    reset.addEventListener('click', (e) => {
      e.stopPropagation();
      pushHistory();
      const framing = cropFor(i, doc.panels.length);
      doc.panels[i].zoom = framing.zoom;
      doc.panels[i].ox = framing.ox;
      doc.panels[i].oy = framing.oy;
      render();
    });
    row.append(thumb, label, upload, zoom, reset);
    row.addEventListener('click', () => {
      selected = i;
      syncAll();
      render();
    });
    list.append(row);
  });
}

function buildLibrary() {
  // Layout buttons.
  const frameBox = $('#frameList');
  FRAMES.forEach((f) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.dataset.frame = f.id;
    b.textContent = f.name;
    b.title = f.blurb;
    b.addEventListener('click', () => setFrame(f.id));
    frameBox.append(b);
  });
  // Tone buttons.
  const toneBox = $('#toneList');
  TONES.forEach((t) => {
    const b = document.createElement('button');
    b.className = 'chip swatch';
    b.type = 'button';
    b.dataset.tone = t.id;
    b.innerHTML = '';
    const dot = document.createElement('span');
    dot.className = 'swatch-dot';
    dot.style.background = `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})`;
    b.append(dot, document.createTextNode(t.name));
    b.addEventListener('click', () => setTone(t.id));
    toneBox.append(b);
  });
  // Size buttons.
  document.querySelectorAll('[data-size]').forEach((b) => {
    b.addEventListener('click', () => setSize(b.dataset.size));
  });
  // Preset buttons.
  const presetBox = $('#presetList');
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'chip preset';
    b.type = 'button';
    b.textContent = p.name;
    b.addEventListener('click', () => applyPreset(p));
    presetBox.append(b);
  });
  // Sample photos: a small "try one" row, clearly labelled, below the
  // big Add-your-photo step — samples are a convenience, never the flow.
  const sampleBox = $('#sampleList');
  SAMPLES.forEach((s) => {
    const card = document.createElement('button');
    card.className = 'sample-card';
    card.type = 'button';
    const img = document.createElement('img');
    img.src = s.url;
    img.alt = s.name;
    const cap = document.createElement('span');
    cap.textContent = s.name;
    card.append(img, cap);
    card.addEventListener('click', () => applyPhoto(s));
    sampleBox.append(card);
  });
  // Star buttons.
  document.querySelectorAll('[data-stars]').forEach((b) => {
    b.addEventListener('click', () => {
      pushHistory();
      doc.stars = Number(b.dataset.stars);
      syncAll();
      render();
    });
  });
}

function openFilePicker(onFile) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) onFile(input.files[0]);
  });
  input.click();
}

function bindControls() {
  $('#addPhotoBtn').addEventListener('click', () => {
    openFilePicker(async (file) => {
      const url = URL.createObjectURL(file);
      const img = await loadPhoto(url);
      pushHistory();
      fillAllWindows(img);
      selected = 0;
      syncAll();
      render();
    });
  });
  $('#undoBtn').addEventListener('click', () => {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
  });
  $('#redoBtn').addEventListener('click', () => {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
  });
  $('#strengthRange').addEventListener('input', (e) => {
    setStrength(parseFloat(e.target.value));
  });
  $('#strengthRange').addEventListener('change', () => pushHistory());
  $('#titleInput').addEventListener('input', (e) => {
    doc.title = e.target.value;
    render();
  });
  $('#subtitleInput').addEventListener('input', (e) => {
    doc.subtitle = e.target.value;
    render();
  });
  $('#taglineInput').addEventListener('input', (e) => {
    doc.tagline = e.target.value;
    render();
  });
  $('#badgeInput').addEventListener('input', (e) => {
    doc.badge = e.target.value;
    render();
  });
  $('#titleInput').addEventListener('change', () => pushHistory());
  $('#subtitleInput').addEventListener('change', () => pushHistory());
  $('#taglineInput').addEventListener('change', () => pushHistory());
  $('#badgeInput').addEventListener('change', () => pushHistory());
  $('#grainCheck').addEventListener('change', (e) => {
    pushHistory();
    doc.grain = e.target.checked;
    render();
  });
  $('#vignetteCheck').addEventListener('change', (e) => {
    pushHistory();
    doc.vignette = e.target.checked;
    render();
  });
  $('#exportBtn').addEventListener('click', () => exportPng(doc.size));
  document.querySelectorAll('[data-export-size]').forEach((b) => {
    b.addEventListener('click', () => exportPng(b.dataset.exportSize));
  });

  // Canvas: click selects a window, drag reframes it, wheel zooms it.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    const hit = windowAt(doc.frame, canvas.width, canvas.height, x, y);
    if (hit < 0) return;
    selected = hit;
    syncAll();
    render();
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, index: hit, moved: false };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const panel = doc.panels[drag.index];
    if (!panel) return;
    const dx = (e.clientX - drag.x) / rect.width;
    const dy = (e.clientY - drag.y) / rect.height;
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) {
      drag.moved = true;
    }
    panel.ox = (panel.ox || 0) + dx;
    panel.oy = (panel.oy || 0) + dy;
    drag.x = e.clientX;
    drag.y = e.clientY;
    render();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag && drag.moved) pushHistory();
    drag = null;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const panel = doc.panels[selected];
    if (!panel) return;
    const next = (panel.zoom || 1) * Math.pow(1.0015, -e.deltaY);
    panel.zoom = Math.max(1, Math.min(3, next));
    render();
  }, { passive: false });
}

async function exportPng(sizeId) {
  const size = EXPORT_SIZES[sizeId] ?? EXPORT_SIZES[doc.size];
  const blob = await exportCoverPNG(doc, size.w, size.h);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vice-coast-${sizeId}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// The grader's export hook: renders the current doc at an export size and
// downloads the PNG. Available on every load, shot or not.
window.__exportCover = exportPng;

async function start() {
  buildLibrary();
  bindControls();
  await ensureFonts();

  const params = new URLSearchParams(window.location.search);
  if (params.get('shot')) {
    const base = freshDoc();
    // Load the sample images once so shots can build panels from them.
    const loaded = [];
    for (const s of SAMPLES) {
      loaded.push({ ...s, img: await loadPhoto(s.url) });
    }
    const makePanel = (entry, framing) => ({
      img: entry.img, zoom: framing.zoom, ox: framing.ox, oy: framing.oy,
    });
    const { doc: shotDoc, shot, size } = buildShotDoc(base, window.location.search, loaded, makePanel);
    doc = shotDoc;
    shotMode = shot;
    if (shot === 'cover') {
      document.body.classList.add('shot-cover');
      canvas.width = size.w;
      canvas.height = size.h;
      renderCover(canvas, doc);
      window.__shotReady = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.__shotReady = true;
        });
      });
      return;
    }
    // Editor shot: the editor page, with the shot's doc loaded.
    syncAll();
    render();
    return;
  }

  doc = freshDoc();
  const img = await loadPhoto(SAMPLES[0].url);
  fillAllWindows(img);
  syncAll();
  render();
}

start().catch((err) => {
  console.error(err);
  const note = document.createElement('p');
  note.className = 'load-error';
  note.textContent = 'Could not start the studio: ' + err.message;
  stage.append(note);
});
