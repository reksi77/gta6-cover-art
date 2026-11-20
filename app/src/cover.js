// cover.js — the rendering engine for Vice Sunset Cover Studio.
//
// Pure Canvas 2D, no dependencies, no network. It turns a small state object
// (layout, grade, caption, panels) into GTA-poster-style cover art: comic
// panels with thick gutters, a sunset or neon colour grade, and big bold
// caption lettering with a hard outline. Everything is drawn from scratch
// on every frame, so the preview and the exported PNG are the same picture.

export const LAYOUTS = {
  hero: { label: 'Hero', panels: 1 },
  split: { label: 'Split', panels: 2 },
  triptych: { label: 'Triptych', panels: 3 },
};

export const GRADES = {
  sunset: {
    label: 'Sunset',
    sky: ['#ff9a3d', '#ff5e7a', '#7a2b8f'],
    wash: 'rgba(255, 94, 122, 0.20)',
    glow: 'rgba(255, 154, 61, 0.55)',
  },
  neon: {
    label: 'Neon',
    sky: ['#ff2e88', '#7b2ff7', '#00e5ff'],
    wash: 'rgba(255, 46, 136, 0.18)',
    glow: 'rgba(0, 229, 255, 0.45)',
  },
  noir: {
    label: 'Noir',
    sky: ['#e8e8e8', '#9a9a9a', '#1a1a1a'],
    wash: 'rgba(255, 255, 255, 0.08)',
    glow: 'rgba(255, 255, 255, 0.25)',
  },
  palm: {
    label: 'Palm',
    sky: ['#ffd166', '#06d6a0', '#073b4c'],
    wash: 'rgba(6, 214, 160, 0.16)',
    glow: 'rgba(255, 209, 102, 0.50)',
  },
};

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide · 1920 × 1080' },
};

// Panel rectangles for a layout, in canvas pixels. Gutters are thick black
// bars, like a comic page; the caption band overlaps the seam on split.
export function panelRects(layout, W, H) {
  const g = Math.round(Math.min(W, H) * 0.018); // gutter thickness
  if (layout === 'hero') {
    return [{ x: 0, y: 0, w: W, h: H }];
  }
  if (layout === 'split') {
    const topH = Math.round(H * 0.56);
    return [
      { x: 0, y: 0, w: W, h: topH },
      { x: 0, y: topH + g, w: W, h: H - topH - g },
    ];
  }
  // triptych: three vertical columns
  const colW = Math.floor((W - 2 * g) / 3);
  return [
    { x: 0, y: 0, w: colW, h: H },
    { x: colW + g, y: 0, w: colW, h: H },
    { x: 2 * (colW + g), y: 0, w: W - 2 * (colW + g), h: H },
  ];
}

// Where the caption sits for each layout. It always lives fully inside one
// panel, never straddling a gutter, so no letter is ever sliced in half.
function captionZone(layout, W, H) {
  if (layout === 'split') return { x: W * 0.04, y: H * 0.68, w: W * 0.92, align: 'left' };
  if (layout === 'triptych') return { x: W * 0.05, y: H * 0.78, w: W * 0.90, align: 'left' };
  return { x: W * 0.05, y: H * 0.74, w: W * 0.90, align: 'left' };
}

// Draw one photo into one panel: cover-fit, then the panel's zoom and pan.
function drawPanelImage(ctx, img, rect, zoom, ox, oy) {
  if (!img || !img.naturalWidth) return;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  // Pan is a fraction of the panel; clamp so the photo always covers it.
  const maxOx = Math.max(0, (dw - rect.w) / 2 / rect.w);
  const maxOy = Math.max(0, (dh - rect.h) / 2 / rect.h);
  const cx = Math.max(-maxOx, Math.min(maxOx, ox));
  const cy = Math.max(-maxOy, Math.min(maxOy, oy));
  const dx = rect.x + (rect.w - dw) / 2 + cx * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + cy * rect.h;
  ctx.drawImage(img, dx, dy, dw, dh);
}

// A soft diagonal wash plus a sun glow, clipped to the panel.
function gradePanel(ctx, rect, grade, amount) {
  if (amount <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  grad.addColorStop(0, grade.sky[0]);
  grad.addColorStop(0.55, grade.sky[1]);
  grad.addColorStop(1, grade.sky[2]);
  ctx.globalAlpha = 0.28 * amount;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.35 * amount;
  ctx.fillStyle = grade.wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

// Halftone dots fading down from the top edge — a print-poster texture.
function halftone(ctx, W, H, color) {
  ctx.save();
  ctx.fillStyle = color;
  const step = Math.max(10, Math.round(W / 90));
  for (let y = step / 2; y < H * 0.22; y += step) {
    const fade = 1 - y / (H * 0.22);
    for (let x = step / 2; x < W; x += step) {
      const r = Math.max(0.6, step * 0.16 * fade);
      ctx.globalAlpha = 0.5 * fade;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Rounded-rectangle path (avoids ctx.roundRect, which older canvases lack).
function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function vignette(ctx, W, H) {
  const grad = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// Split the caption into at most two lines that fit the zone width.
function wrapCaption(ctx, text, maxWidth, startPx) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let size = startPx;
  while (size > 24) {
    ctx.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(size * 0.02)}px`; } catch { /* older canvas */ }
    let current = '';
    const built = [];
    for (const word of words) {
      const trial = current ? `${current} ${word}` : word;
      if (ctx.measureText(trial).width <= maxWidth || !current) {
        current = trial;
      } else {
        built.push(current);
        current = word;
      }
    }
    if (current) built.push(current);
    if (built.length <= 2) return { lines: built, size };
    size = Math.round(size * 0.88);
  }
  return { lines: words.slice(0, 2), size };
}

function drawCaption(ctx, state, W, H) {
  const text = (state.caption || '').trim();
  if (!text) return;
  const zone = captionZone(state.layout, W, H);
  const startPx = Math.round(Math.min(W, H) * (state.captionSize ?? 0.11));
  const { lines, size } = wrapCaption(ctx, text.toUpperCase(), zone.w, startPx);
  const lineH = size * 1.04;
  const totalH = lines.length * lineH;
  const tilt = ((state.captionTilt ?? -2) * Math.PI) / 180;

  ctx.save();
  ctx.translate(zone.x + zone.w / 2, zone.y + totalH / 2);
  ctx.rotate(tilt);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  try { ctx.letterSpacing = `${Math.round(size * 0.02)}px`; } catch { /* older canvas */ }
  // A dark scrim behind the words, so the caption reads over any photo.
  const textW = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const padX = size * 0.28;
  const padY = size * 0.18;
  ctx.fillStyle = 'rgba(8, 6, 14, 0.55)';
  roundRect(ctx, -textW / 2 - padX, -totalH / 2 - padY, textW + padX * 2, totalH + padY * 2, size * 0.12);
  ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = size * 0.08;
  ctx.shadowOffsetY = size * 0.05;
  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * lineH;
    if (state.captionOutline !== false) {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = Math.max(4, size * 0.14);
      ctx.strokeText(line, 0, y);
    }
    ctx.fillStyle = state.captionColor || '#ffffff';
    ctx.fillText(line, 0, y);
  });
  ctx.restore();
}

// The whole picture: panels, grade, texture, caption.
export function drawCover(ctx, state, W, H) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const rects = panelRects(state.layout, W, H);
  ctx.fillStyle = '#0b0b10';
  ctx.fillRect(0, 0, W, H);

  rects.forEach((rect, i) => {
    const panel = state.panels[i];
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (panel && panel.img) {
      drawPanelImage(ctx, panel.img, rect, panel.zoom || 1, panel.ox || 0, panel.oy || 0);
    } else {
      // Empty panel: a dusk gradient so the layout still reads.
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      g.addColorStop(0, '#2b1a4a');
      g.addColorStop(1, '#120a24');
      ctx.fillStyle = g;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    gradePanel(ctx, rect, grade, panel ? (panel.gradeAmt ?? 1) : 1);
    ctx.restore();
    // Crisp white pinstripe inside each panel edge.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, Math.round(Math.min(W, H) * 0.004));
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
  });

  // One low sun glow over the whole poster, then print texture + vignette.
  const glow = ctx.createRadialGradient(W * 0.78, H * 0.2, 0, W * 0.78, H * 0.2, W * 0.55);
  glow.addColorStop(0, grade.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  halftone(ctx, W, H, 'rgba(255,255,255,0.9)');
  vignette(ctx, W, H);
  drawCaption(ctx, state, W, H);
}

// Hit-test: which panel contains this canvas point, if any.
export function panelAt(layout, W, H, x, y) {
  const rects = panelRects(layout, W, H);
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}
