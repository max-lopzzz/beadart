# Bead Art Helper — Design Spec

> Date: 2026-08-02
> Status: Approved for planning

## Purpose

A tool to make fuse/perler bead art easier. The user supplies a digital
pixel art image. The app detects the grid, quantizes each cell to the
nearest color in a bead palette (starting from the user's own ~215-color
CSV), and then acts as a build guide: view the pattern one color at a time
and check off colors as they're completed.

## Approach

Fully client-side web app. No backend, no accounts. Everything — grid
detection, color quantization, pattern storage — runs in the browser.

- **React + TypeScript + Vite** for the UI.
- **Canvas API** for image manipulation (drawing, sampling, cropping,
  downsampling).
- **IndexedDB** (via `idb` or similar) for storing patterns and palettes.
- **Deployment**: static build, deployable to any static host (Vercel /
  Netlify / GitHub Pages). No server, no database, no secrets.

Rejected alternatives:
- **Web frontend + backend (Python/OpenCV)** — adds hosting/deployment
  complexity for no real benefit.
- **Photo-of-a-drawing upload path** (OpenCV.js grid/corner detection and
  perspective warp) — built and shipped, then removed after hands-on
  testing; digital pixel art images cover the actual use case, and the
  OpenCV dependency added significant weight and complexity for a path
  that wasn't needed.

## Screens & Components

### Home screen
- Grid of saved patterns: thumbnail, name, % of colors completed.
- "+ New Pattern" button.
- "Manage Palettes" link.

### New Pattern flow
1. **Upload** — choose a digital pixel art image.
2. **Grid size confirmation** — auto-detect the pixel-art dimensions (how
   many pixels wide/tall the artwork is), pre-filling that guess; numeric
   override if the guess is wrong.
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
   differences) → block width/height in source pixels, converted to a
   pixel-art column/row count for display.
3. Downsample: average (or median) color within each cell → one RGB value
   per grid cell.
4. User can override the detected column/row count directly (asked as "how
   many pixels wide/tall is your pixel art", not a source-pixel block
   size); re-runs downsampling at the corrected grid size.

### Color matching
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
  (e.g. 2000px) before processing, to keep in-browser image processing
  performant.
- **IndexedDB storage limits**: store only compressed thumbnails (not
  full-res source images) long-term.

## Testing Approach

- **Unit tests (Vitest)**: Lab color conversion, Delta-E distance,
  nearest-palette-match, digital block-size detection (run-length/
  autocorrelation), CSV palette parsing/validation.
- **Component tests (React Testing Library)**: Working view interactions —
  filtering by color, marking complete, completion % calculation.
- **Manual/visual verification**: canvas-dependent parts (image loading,
  thumbnail/export rendering) tested against real digital pixel art images
  during development.

## Out of Scope (for this spec)

- User accounts / cloud sync across devices.
- Multiple simultaneous users / sharing patterns with others.
- Auto-generating pixel art from arbitrary photos (e.g. converting a photo
  of a face into pixel art) — this app only reads *already-designed*
  pixel/bead art, it doesn't invent a design from a non-pixelated photo.
