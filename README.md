# Bead Art Helper

Turn a digital pixel-art image into a fuse/perler bead build guide: upload
an image, confirm its pixel dimensions, match each pixel to the closest
color in a bead palette, then use the working view to place beads one
color at a time and track your progress.

**Live app:** https://beadart-sable.vercel.app

## Features

- **Upload → grid → palette → name** wizard to turn a pixel-art image into
  a pattern, with automatic grid-size detection (tolerant of JPEG
  compression noise) and manual override.
- **Nearest-color matching** against a bead palette using CIELAB color
  space and Delta-E76 distance, so matches look right to the eye, not just
  in raw RGB.
- **Working view**: view the full pattern, show one or more colors at a
  time to make placement easier, check off colors as they're completed,
  and export an image of the pattern (or just the colors you're currently
  focused on).
- **Edit saved patterns**: rename a pattern, replace a color throughout
  the whole pattern with a similar alternative, or select and recolor any
  number of individual cells.
- **Materials overview**: total and remaining bead counts per color across
  every saved pattern, so you know what you still need.
- **Custom palettes**: import your own bead colors from a CSV
  (`Name,Color`), alongside the built-in default palette.

Everything runs client-side — patterns and palettes are stored locally in
the browser via IndexedDB. There's no backend, no accounts, and no data
leaves your device.

## Tech stack

React 19 + TypeScript + Vite, no CSS framework (hand-written design
system in `src/index.css`). Tests with Vitest + React Testing Library.

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm test          # run the test suite
npm run build     # type-check and produce a production build in dist/
npm run preview   # preview the production build locally
```

## Deployment

Deployed on [Vercel](https://vercel.com), connected to this repository —
pushing to `master` deploys to production automatically, and other
branches/PRs get their own preview deployments.

## Project structure

```
src/
├── components/    # screens and shared UI (home, new-pattern wizard, working view, palettes)
├── hooks/         # usePatterns, usePalettes (IndexedDB-backed state)
├── lib/
│   ├── color/     # RGB/Lab conversion, Delta-E, nearest/similar color matching, contrast
│   ├── image/     # loading an uploaded image, rendering a pattern back to an image
│   ├── palette/   # CSV parsing, default palette
│   ├── pattern/   # per-pattern stats, cross-pattern materials summary
│   ├── pixelart/  # grid/block-size detection, downsampling
│   └── storage/   # IndexedDB access (patterns, palettes)
└── types/         # shared Pattern/Palette types
```
