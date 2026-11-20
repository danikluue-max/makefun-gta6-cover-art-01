// Vice Coast Cover Studio, round 3 — the entry program (Node 22, standard
// library only). The app is this directory's app/ folder: plain static
// files a desktop browser loads offline (app/index.html and its ES
// modules, no library and no network request). This program hands the app
// in: it copies app/ and screenshots/ from beside this file to /output
// and writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library.
//
// Round 3 is a photo-first poster maker: one photograph fills every
// window of the cover, graded the same everywhere, with the title laid
// over the photo itself — no title strip, no polaroid frames, no script
// lettering. Six photo-forward layouts, six sunset/neon grades, three
// export sizes, PNG export, undo, and per-window crop and zoom.
//
// Before copying, the program checks the entry is whole: app/index.html
// and the studio module must exist, and screenshots/ must hold three or
// four images, so a half-built entry never ships.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB
// of app files in all, or a path under app/ over 1000 bytes).
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function fail(message) {
  throw new Error(message);
}

function isImage(name) {
  return /\.(png|jpe?g)$/i.test(name);
}

/** The screenshot files in screenshots/, in name order. */
function collectShots(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.') && isImage(name))
    .sort();
}

const required = [
  ['app', 'index.html'],
  ['app', 'src', 'studio.js'],
  ['app', 'src', 'painter.js'],
  ['app', 'src', 'frames.js'],
  ['app', 'src', 'tones.js'],
  ['app', 'src', 'scenes.js'],
  ['app', 'style.css'],
];
for (const parts of required) {
  const path = join(here, ...parts);
  if (!existsSync(path) || !statSync(path).isFile()) {
    fail(`missing ${parts.join('/')}: the cover maker is not built`);
  }
}

const shots = collectShots(join(here, 'screenshots'));
if (shots.length < 3 || shots.length > 4) {
  fail(`screenshots/ must hold 3 or 4 images, found ${shots.length}`);
}

mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, CAPS));
console.log(`handed in ${shots.length} screenshots and app/ to ${outDir}`);
