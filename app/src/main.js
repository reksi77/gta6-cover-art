// main.js — wires Vice Sunset Cover Studio: state, controls, drag-to-pan,
// export, and the ?shot= scenes for screenshots.
//
// The preview canvas always renders at the chosen export resolution, so
// what you see is exactly the PNG you get. Photos are read on this machine
// only (FileReader / data URLs) and never uploaded anywhere.

import { drawCover, panelAt, panelRects, LAYOUTS, GRADES, SIZES } from './cover.js';
import { readShotParams, applyShot, markShotReady, SAMPLES } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const CAPTIONS = ['Sunset Heist', 'Boulevard Queen', 'Neon Nights', 'Vice City Lights', 'Palm Shadows'];

// Fresh default state. Sample photos are preloaded so the studio opens
// with a finished-looking cover instead of empty panels.
function defaultState() {
  return {
    layout: 'split',
    grade: 'sunset',
    caption: 'Sunset Heist',
    captionColor: '#ffffff',
    captionSize: 0.11,
    captionTilt: -2,
    captionOutline: true,
    size: '1080x1080',
    panels: [
      { img: null, zoom: 1, ox: 0, oy: 0, gradeAmt: 1 },
      { img: null, zoom: 1, ox: 0, oy: 0, gradeAmt: 1 },
      { img: null, zoom: 1, ox: 0, oy: 0, gradeAmt: 1 },
    ],
  };
}

const state = defaultState();
let selected = 0;
let drag = null;
let coverShot = false; // cover/wide shots show clean art: no selection outline

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${url}`));
    img.src = url;
  });
}

function sizeCanvas() {
  const s = SIZES[state.size] || SIZES['1080x1080'];
  canvas.width = s.w;
  canvas.height = s.h;
  canvas.style.aspectRatio = `${s.w} / ${s.h}`;
}

function render() {
  sizeCanvas();
  drawCover(ctx, state, canvas.width, canvas.height);
  if (!coverShot) drawSelection();
  window.__coverReady = true;
}

// A dashed outline around the selected panel, so dragging has a target.
function drawSelection() {
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  const r = rects[selected];
  if (!r) return;
  ctx.save();
  ctx.setLineDash([14, 10]);
  ctx.strokeStyle = '#ffe14d';
  ctx.lineWidth = Math.max(3, Math.round(Math.min(canvas.width, canvas.height) * 0.006));
  ctx.strokeRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
  ctx.restore();
}

function note(msg) {
  statusEl.textContent = msg;
}

// ---- panel cards ---------------------------------------------------------

const panelsEl = document.getElementById('panels');

function panelCard(i) {
  const panel = state.panels[i];
  const card = document.createElement('article');
  card.className = 'panel-card';
  card.dataset.index = String(i);
  if (i === selected) card.classList.add('selected');

  const title = document.createElement('h3');
  title.textContent = `Panel ${i + 1}`;
  card.appendChild(title);

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  thumb.textContent = panel.img ? 'Photo loaded' : 'Empty — pick a photo';
  card.appendChild(thumb);

  const fileLabel = document.createElement('label');
  fileLabel.className = 'file-label';
  fileLabel.textContent = 'Upload photo ';
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'image/*';
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      panel.img = await loadImage(URL.createObjectURL(f));
      selected = i;
      buildPanels();
      render();
      note(`Panel ${i + 1}: ${f.name} loaded. Drag on the preview to position it.`);
    } catch {
      note('That file could not be read as an image.');
    }
  });
  fileLabel.appendChild(file);
  card.appendChild(fileLabel);

  const sampleRow = document.createElement('div');
  sampleRow.className = 'sample-row';
  for (const [name, url] of Object.entries(SAMPLES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mini';
    b.textContent = `Sample: ${name}`;
    b.addEventListener('click', async () => {
      panel.img = await loadImage(url);
      selected = i;
      buildPanels();
      render();
    });
    sampleRow.appendChild(b);
  }
  card.appendChild(sampleRow);

  const zoomLabel = document.createElement('label');
  zoomLabel.textContent = `Zoom ${panel.zoom.toFixed(2)}×`;
  const zoom = document.createElement('input');
  zoom.type = 'range';
  zoom.min = '1';
  zoom.max = '2.5';
  zoom.step = '0.05';
  zoom.value = String(panel.zoom);
  zoom.addEventListener('input', () => {
    panel.zoom = Number(zoom.value);
    zoomLabel.firstChild.textContent = `Zoom ${panel.zoom.toFixed(2)}×`;
    render();
  });
  zoomLabel.appendChild(zoom);
  card.appendChild(zoomLabel);

  const gradeLabel = document.createElement('label');
  gradeLabel.textContent = `Grade ${Math.round(panel.gradeAmt * 100)}%`;
  const gradeAmt = document.createElement('input');
  gradeAmt.type = 'range';
  gradeAmt.min = '0';
  gradeAmt.max = '1';
  gradeAmt.step = '0.05';
  gradeAmt.value = String(panel.gradeAmt);
  gradeAmt.addEventListener('input', () => {
    panel.gradeAmt = Number(gradeAmt.value);
    gradeLabel.firstChild.textContent = `Grade ${Math.round(panel.gradeAmt * 100)}%`;
    render();
  });
  gradeLabel.appendChild(gradeAmt);
  card.appendChild(gradeLabel);

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'mini';
  reset.textContent = 'Reset position';
  reset.addEventListener('click', () => {
    panel.zoom = 1;
    panel.ox = 0;
    panel.oy = 0;
    buildPanels();
    render();
  });
  card.appendChild(reset);

  card.addEventListener('click', (e) => {
    if (e.target.closest('input, button')) return;
    selected = i;
    buildPanels();
    render();
  });
  return card;
}

function buildPanels() {
  const count = LAYOUTS[state.layout].panels;
  panelsEl.replaceChildren();
  for (let i = 0; i < count; i += 1) panelsEl.appendChild(panelCard(i));
  if (selected >= count) selected = 0;
}

// ---- option button groups -------------------------------------------------

function wireGroup(id, values, current, onPick) {
  const group = document.getElementById(id);
  group.replaceChildren();
  for (const [key, label] of Object.entries(values)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.value = key;
    if (key === current) b.classList.add('active');
    b.addEventListener('click', () => {
      onPick(key);
      group.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    });
    group.appendChild(b);
  }
}

wireGroup('layout-group', Object.fromEntries(Object.entries(LAYOUTS).map(([k, v]) => [k, v.label])),
  state.layout, (key) => { state.layout = key; buildPanels(); render(); });
wireGroup('grade-group', Object.fromEntries(Object.entries(GRADES).map(([k, v]) => [k, v.label])),
  state.grade, (key) => { state.grade = key; render(); });
wireGroup('size-group', Object.fromEntries(Object.entries(SIZES).map(([k, v]) => [k, v.label])),
  state.size, (key) => { state.size = key; render(); });

// ---- caption controls ------------------------------------------------------

const captionInput = document.getElementById('caption');
captionInput.addEventListener('input', () => { state.caption = captionInput.value; render(); });

const colorGroup = document.getElementById('color-group');
for (const color of ['#ffffff', '#ffe14d', '#ff5e7a', '#111111']) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch';
  b.style.background = color;
  b.setAttribute('aria-label', `Caption colour ${color}`);
  if (color === state.captionColor) b.classList.add('active');
  b.addEventListener('click', () => {
    state.captionColor = color;
    colorGroup.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', x === b));
    render();
  });
  colorGroup.appendChild(b);
}

const captionSize = document.getElementById('caption-size');
captionSize.addEventListener('input', () => {
  state.captionSize = Number(captionSize.value);
  render();
});

const outline = document.getElementById('outline');
outline.addEventListener('change', () => { state.captionOutline = outline.checked; render(); });

const tilt = document.getElementById('tilt');
tilt.addEventListener('input', () => { state.captionTilt = Number(tilt.value); render(); });

// ---- drag to pan, wheel to zoom --------------------------------------------

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}

canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = panelAt(state.layout, canvas.width, canvas.height, p.x, p.y);
  if (hit < 0) return;
  selected = hit;
  buildPanels();
  const panel = state.panels[hit];
  drag = { panel, x: p.x, y: p.y, ox: panel.ox, oy: panel.oy };
  canvas.setPointerCapture(e.pointerId);
  render();
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  drag.panel.ox = drag.ox + (p.x - drag.x) / canvas.width;
  drag.panel.oy = drag.oy + (p.y - drag.y) / canvas.height;
  render();
});

canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[selected];
  panel.zoom = Math.max(1, Math.min(2.5, panel.zoom + (e.deltaY < 0 ? 0.08 : -0.08)));
  buildPanels();
  render();
}, { passive: false });

// Drag a photo file straight onto the preview: it lands in the panel under it.
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const p = canvasPoint(e);
  const hit = panelAt(state.layout, canvas.width, canvas.height, p.x, p.y);
  const target = hit < 0 ? selected : hit;
  try {
    state.panels[target].img = await loadImage(URL.createObjectURL(file));
    selected = target;
    buildPanels();
    render();
    note(`Dropped ${file.name} into panel ${target + 1}.`);
  } catch {
    note('That file could not be read as an image.');
  }
});

// ---- export, surprise, reset ------------------------------------------------

document.getElementById('export').addEventListener('click', () => {
  const s = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = s.w;
  off.height = s.h;
  drawCover(off.getContext('2d'), state, s.w, s.h);
  off.toBlob((blob) => {
    if (!blob) { note('Export failed — the canvas is empty.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${state.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    note(`Saved vice-cover-${state.size}.png (${s.w} × ${s.h}).`);
  }, 'image/png');
});

document.getElementById('surprise').addEventListener('click', () => {
  const layouts = Object.keys(LAYOUTS);
  const grades = Object.keys(GRADES);
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  state.caption = CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)];
  captionInput.value = state.caption;
  wireGroup('layout-group', Object.fromEntries(Object.entries(LAYOUTS).map(([k, v]) => [k, v.label])),
    state.layout, (key) => { state.layout = key; buildPanels(); render(); });
  wireGroup('grade-group', Object.fromEntries(Object.entries(GRADES).map(([k, v]) => [k, v.label])),
    state.grade, (key) => { state.grade = key; render(); });
  buildPanels();
  render();
  note('Shuffled layout, grade and caption — export it if you like it.');
});

document.getElementById('reset-all').addEventListener('click', async () => {
  const fresh = defaultState();
  Object.assign(state, fresh);
  captionInput.value = state.caption;
  await bootSamples();
  buildPanels();
  render();
  note('Reset to the starting cover.');
});

// ---- boot -------------------------------------------------------------------

async function bootSamples() {
  try {
    const [pier, boulevard] = await Promise.all([
      loadImage(SAMPLES.pier),
      loadImage(SAMPLES.boulevard),
    ]);
    state.panels[0].img = pier;
    state.panels[1].img = boulevard;
    state.panels[2].img = pier;
  } catch {
    note('Sample photos could not be loaded — upload your own to begin.');
  }
}

const params = readShotParams(location.search);
buildPanels();
if (params.shot) {
  coverShot = params.shot === 'cover' || params.shot === 'wide';
  document.body.classList.add(`shot-${params.shot}`);
  applyShot(state, params, loadImage)
    .then(() => {
      captionInput.value = state.caption;
      buildPanels();
      render();
      markShotReady();
    })
    .catch(() => {
      render();
      markShotReady();
    });
} else {
  bootSamples().then(() => render());
}
