// shots.js — fixed scenes for screenshots, driven by the page's query string.
//
// ?shot=cover  → the cover alone, full viewport, no editor chrome.
// ?shot=editor → the editor with a sample photo loaded.
// ?shot=wide   → the cover alone in a wide export size.
// The other params pick the scene: photo (a sample name), caption, layout,
// grade and size. window.__shotReady is set once the scene has painted,
// so a screenshot script knows when to capture.

export const SAMPLES = {
  pier: 'samples/pier.jpg',
  boulevard: 'samples/boulevard.jpg',
};

export function readShotParams(search) {
  const q = new URLSearchParams(search);
  return {
    shot: q.get('shot') || '',
    photo: q.get('photo') || 'pier',
    photo2: q.get('photo2') || 'boulevard',
    caption: q.get('caption') || 'Sunset Heist',
    layout: q.get('layout') || 'split',
    grade: q.get('grade') || 'sunset',
    size: q.get('size') || '1080x1080',
  };
}

// Apply a shot scene to a fresh state object. Panel 0 gets `photo`, panel 1
// (when the layout has one) gets `photo2`, panel 2 repeats `photo`.
export function applyShot(state, params, loadImage) {
  state.layout = params.layout;
  state.grade = params.grade;
  state.caption = params.caption;
  state.size = params.size;
  const first = loadImage(SAMPLES[params.photo] || SAMPLES.pier);
  const second = loadImage(SAMPLES[params.photo2] || SAMPLES.boulevard);
  return Promise.all([first, second]).then(([imgA, imgB]) => {
    const pics = [imgA, imgB, imgA];
    state.panels = pics.map((img) => ({ img, zoom: 1, ox: 0, oy: 0, gradeAmt: 1 }));
    // In the split layout the top panel crops a landscape photo hard; nudge
    // it up a touch so faces near the top edge stay in frame.
    if (params.layout === 'split') state.panels[0].oy = -0.08;
    return state;
  });
}

export function markShotReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
