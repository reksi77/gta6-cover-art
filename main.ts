// Vice Sunset Cover Studio — a gta6-cover-art-01 entry (Node 22, standard
// library only). The app is this directory's app/ folder: plain static files
// a desktop browser loads offline (app/index.html and its ES modules, no
// library and no network request). It turns a photo and a caption into
// GTA-style poster art — comic panels, a sunset or neon grade, bold caption
// lettering — and exports it as a PNG. This program hands the app in: it
// copies app/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// My own pre-flight check: the hand-in is only complete when the app entry
// point and at least one screenshot sit beside this file. I check that here,
// before anything is copied, so a broken tree fails loudly instead of
// handing in an empty dossier.
const entryPoint = join(here, 'app', 'index.html');
if (!existsSync(entryPoint)) {
  throw new Error(`entry point missing: ${entryPoint}`);
}
const shotDir = join(here, 'screenshots');
const shotFiles = existsSync(shotDir)
  ? readdirSync(shotDir).filter((name) => !name.startsWith('.'))
  : [];
if (shotFiles.length < 1 || shotFiles.length > 4) {
  throw new Error(`expected 1-4 screenshots, found ${shotFiles.length}`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

console.log(
  `Vice Sunset handed in: app/ + ${shotFiles.length} screenshot(s) (${shotFiles.join(', ')}) -> ${out} (dossier.json written)`,
);
