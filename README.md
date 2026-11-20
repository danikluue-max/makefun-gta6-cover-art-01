[![Competition](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/danikluue-max/makefun-gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/danikluue-max/makefun-gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

# Vice Coast Cover Studio

Turn your own photos into a GTA-style poster — offline, in the browser, nothing uploaded anywhere.

Built for the [gta6-cover-art-01 bounty](https://make.fun/bounty/gta6-cover-art-01) on [make.fun](https://make.fun). My referral code: `0zdpscn2`.

## What it does

- **One photo, every window.** Add your photo and it fills every panel of the cover — each panel a different crop of the same photograph, so the poster is unmistakably yours. Pick a sample photo and it works the same way.
- **Six photo-forward layouts** — Hero + Three, Four Windows, Contact Sheet, Solo Photo, Banner Hero, Hero + Filmstrip. Every layout is full-bleed: the photo runs to the edge and the title sits on the photo, never on a separate band below it.
- **Six sunset/neon grades** — Sunset Print, Sunset, Neon Night, Teal / Pink, Gold Hour, Mono Noir. One grade covers the whole poster, so no panel keeps its daylight. Sunset Print is a light print (nine flat tones, faint dot screen) that keeps a face photographic.
- **Original lettering.** Bold Anton title in solid cream with a hard pink offset stamp, letterspaced small-caps subtitle, tagline and a five-star heat meter — the display type that wins, restyled so it is clearly not Rockstar's branding.
- **Real photo controls.** Per-window upload, drag to reframe, scroll to zoom, reset framing, editable title / subtitle / tagline / badge, undo and redo, film grain and vignette toggles.
- **Three export sizes** — Square 1080 × 1080, Portrait 1080 × 1350, Wide 1920 × 1080 — as PNG files, plus six one-tap named looks (Vice Coast, Neon Tide, Gold Hour, Palm Static, Sunset Run, Midnight Harbor).

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` checks the entry is whole (app entry point, studio modules, 3–4 screenshots), copies `app/` and `screenshots/` to the output directory, and writes `dossier.json` with the vendored make.fun library.

## Files

- `app/index.html` — the studio page
- `app/src/studio.js` — wiring: photos, presets, undo, export
- `app/src/painter.js` — the cover renderer (canvas)
- `app/src/frames.js` — the six layouts
- `app/src/tones.js` — the six grades
- `app/src/scenes.js` — the `?shot=` screenshot driver
- `app/samples/` — five sample photos (made for make.fun with an image model, free to use)
- `app/fonts/anton.woff2` — Anton, OFL licensed
- `screenshots/` — the four renders the judge sees first
- `main.ts` — the entry program
- `serve.ts` — the local dev server
