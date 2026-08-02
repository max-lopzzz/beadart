# Bead Art Helper — Design Spec

> Date: 2026-08-02
> Status: Approved for planning

## Purpose

A tool to make fuse/perler bead art easier. The user photographs a hand-drawn
pixel art design (on grid paper) or supplies an existing digital pixel art
image. The app detects the grid, quantizes each cell to the nearest color in
a bead palette (starting from the user's own ~215-color CSV), and then acts
as a build guide: view the pattern one color at a time and check off colors
as they're completed.

## Approach

Fully client-side web app. No backend, no accounts. Everything — grid
detection, perspective correction, color quantization, pattern storage —
runs in the browser.

- **React + TypeScript + Vite** for the UI.
- **Canvas API** for image manipulation (drawing, sampling, cropping,
  downsampling).
- **OpenCV.js** (WASM) for the photo path: grid-line/quadrilateral detection
  and perspective warp.
- **IndexedDB** (via `idb` or similar) for storing patterns and palettes.
- **Deployment**: static build, deployable to any static host (Vercel /
  Netlify / GitHub Pages). No server, no database, no secrets.

Rejected alternatives:
- **Web frontend + backend (Python/OpenCV)** — adds hosting/deployment
  complexity for no real benefit; the manual-correction step already
  compensates for imperfect client-side detection.
- **No grid-line detection, corners-only** — pushes too much manual work
  onto the user for every photo; a decent auto-guess is achievable and
  worth building.

## Screens & Components

### Home screen
- Grid of saved patterns: thumbnail, name, % of colors completed.
- "+ New Pattern" button.
- "Manage Palettes" link.

### New Pattern flow
1. **Upload** — choose a photo (grid drawing) or digital pixel art image;
   select which type it is.
2. **Grid Detection & Correction**
   - *Digital image path*: auto-detect block size, show pixelated preview,
     numeric override for rows/columns if the guess is wrong.
   - *Photo path*: overlay auto-detected quadrilateral as 4 draggable corner
     handles on the photo, plus +/- steppers for row/column count. Live
     preview of the perspective-warped, gridded result as corners/counts are
     adjusted.
3. **Palette assignment** — pick palette to match against (default: user's
   CSV). Show resulting pattern with each cell mapped to nearest palette
   color.
4. **Cell override** — click any cell to manually reassign its color from
   the palette.
5. **Save** — name the pattern, save to IndexedDB, land on Working view.

### Working view
- Full grid rendered as colored cells.
- Sidebar: colors used in this pattern, each as swatch + name + count
  (e.g. ■ A7 × 34) + checkbox.
- Clicking a color name filters the grid to show only that color's cells
  (others dimmed), for accurate placement/counting.
- Checking a color's checkbox marks it done — dims it from the "remaining"
  view, updates completion %.
- Export/print: save the full-color grid or a single color's filtered view
  as an image, for reference while away from the screen.

### Palette management screen
- List of palettes, starting with the user's CSV imported as the default
  (not deletable).
- Import a new CSV (`Name`, `Color` columns).
- Rename/delete custom palettes.

## Data Flow & Detection Algorithm

### Digital pixel art path
1. Load image onto canvas.
2. Detect repeating pixel block size: scan rows/columns for color-change
   boundaries, find most common run-length (or use autocorrelation on pixel
   differences) → block width/height in source pixels.
3. Downsample: average (or median) color within each detected block → one
   RGB value per grid cell.
4. User can override detected row/column count; re-runs downsampling at the
   corrected grid size.

### Photo path
1. Load photo onto canvas, run through OpenCV.js: grayscale → adaptive
   threshold/Canny edge detection → Hough line transform to find dominant
   horizontal/vertical lines → intersect to estimate the grid's 4 outer
   corners and approximate row/column count.
2. Show corners as draggable handles over the photo; user nudges to match
   the real grid, adjusts row/column count with +/- steppers.
3. On confirm: perspective-warp (`cv.warpPerspective`) the photo flat using
   the 4 corners, divide into confirmed rows × columns, average color
   sampled from the center region of each cell (avoiding grid
   lines/shadows at cell edges).

### Color matching (both paths)
1. Convert each cell's average RGB and every palette color to CIELAB color
   space (perceptually uniform, better for "closest color" than raw RGB
   Euclidean distance).
2. Nearest palette color = smallest Delta-E (CIE76) distance in Lab space.
3. Store resulting cell → palette-color-name grid as the pattern's data.

### Persistence (IndexedDB)
- `patterns`: id, name, createdAt, rows, cols, cellColors (string[][]
  referencing palette color names), paletteId, completedColors (string[]).
- `palettes`: id, name, isBuiltIn, colors ({name, hex}[]).
- Thumbnails generated once at save time (small canvas render), not
  re-rendered from the full grid on the home screen.

## Error Handling & Edge Cases

- **Bad photo (too blurry/dark for line detection)**: if OpenCV can't
  confidently find a quadrilateral, fall back to the user manually placing
  all 4 corners on the raw photo, rather than blocking the flow.
- **Non-rectangular photo crop / extreme perspective**: handled generically
  by the perspective warp, which doesn't assume a specific angle.
- **Ambiguous digital pixel-art block size** (anti-aliased or resized image
  with no clean blocks): fall back to a manual "enter grid size" numeric
  input.
- **Cell color equidistant between two palette colors**: no special
  handling needed — deterministic nearest-match, user can override any cell
  manually.
- **Palette CSV import errors** (missing columns, bad hex values): validate
  on import, show which rows failed and skip them rather than rejecting the
  whole file.
- **Very large source images**: downscale working canvas to a max dimension
  (e.g. 2000px) before processing, to keep OpenCV.js performant in-browser.
- **IndexedDB storage limits**: store only compressed thumbnails (not
  full-res source photos) long-term.

## Testing Approach

- **Unit tests (Vitest)**: Lab color conversion, Delta-E distance,
  nearest-palette-match, digital block-size detection (run-length/
  autocorrelation), CSV palette parsing/validation.
- **Component tests (React Testing Library)**: Working view interactions —
  filtering by color, marking complete, completion % calculation.
- **Manual/visual verification**: OpenCV.js-dependent parts (corner
  detection, perspective warp) tested against real sample photos (varied
  angles/lighting) and digital pixel art images during development.

## Out of Scope (for this spec)

- User accounts / cloud sync across devices.
- Multiple simultaneous users / sharing patterns with others.
- Auto-generating pixel art from arbitrary photos (e.g. converting a photo
  of a face into pixel art) — this app only reads *already-designed*
  pixel/bead art, it doesn't invent a design from a non-pixelated photo.
