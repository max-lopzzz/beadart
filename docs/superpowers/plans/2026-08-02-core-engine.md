# Core Engine + Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the project scaffold and the non-UI "engine" of the Bead Art Helper app: color matching, palette CSV parsing (including the user's real bead palette), digital pixel-art grid detection, and IndexedDB-backed storage for patterns and palettes.

**Architecture:** A Vite + React + TypeScript project with no backend. This plan only touches `src/lib/`, `src/types/`, and project scaffolding — no UI screens yet (those come in Plan 2). Every piece of logic here is a pure function or a thin IndexedDB wrapper, fully covered by Vitest unit tests, so it can be verified independent of any UI.

**Tech Stack:** React 19, TypeScript 5.6, Vite 6, Vitest, `idb` (IndexedDB wrapper), `fake-indexeddb` (test-only).

## Global Constraints

- Fully client-side app — no backend/server. (Design spec §1)
- Storage is IndexedDB via the `idb` package. (Design spec §1, §3)
- Color matching uses CIELAB color space with CIE76 Delta-E distance, not raw RGB distance. (Design spec §3)
- The default palette is the user's real bead CSV (221 colors, `Name,Color` columns) and must not be deletable. (Design spec §2, §4)
- Digital pixel-art block-size detection must fall back gracefully (return `null`) when no grid can be detected, rather than throwing — the UI layer (Plan 2) is responsible for prompting manual entry. (Design spec §4)

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `.gitignore`

**Interfaces:**
- Produces: a working `npm run build`, `npm run dev`, and `npm test` (Vitest) setup that every later task relies on.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "beadart",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "idb": "^8.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "fake-indexeddb": "^6.0.0",
    "typescript": "^5.6.3",
    "vite": "^6.0.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 5: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

- [ ] **Step 6: Create `vitest.setup.ts`**

```typescript
import 'fake-indexeddb/auto';
```

- [ ] **Step 7: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bead Art Helper</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `src/main.tsx`**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 9: Create `src/App.tsx`** (placeholder — replaced in Plan 2)

```typescript
export default function App() {
  return <div>Bead Art Helper — coming soon</div>;
}
```

- [ ] **Step 10: Create `.gitignore`**

```
node_modules
dist
.DS_Store
```

- [ ] **Step 11: Install dependencies and verify the build**

Run: `npm install && npm run build`
Expected: build completes with no errors, producing a `dist/` directory.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TypeScript + Vitest project"
```

---

### Task 2: Core types

**Files:**
- Create: `src/types/palette.ts`
- Create: `src/types/pattern.ts`

**Interfaces:**
- Consumes: nothing (leaf types).
- Produces: `PaletteColor { name: string; hex: string }`, `Palette { id: string; name: string; isBuiltIn: boolean; colors: PaletteColor[] }`, `Pattern { id: string; name: string; createdAt: string; rows: number; cols: number; cellColors: string[][]; paletteId: string; completedColors: string[]; thumbnail: string }` — used by every later task in this plan.

This task only declares shared types with no runtime behavior, so there is no test to write first — verification is via the TypeScript compiler.

- [ ] **Step 1: Create `src/types/palette.ts`**

```typescript
export interface PaletteColor {
  name: string;
  hex: string;
}

export interface Palette {
  id: string;
  name: string;
  isBuiltIn: boolean;
  colors: PaletteColor[];
}
```

- [ ] **Step 2: Create `src/types/pattern.ts`**

```typescript
export interface Pattern {
  id: string;
  name: string;
  createdAt: string;
  rows: number;
  cols: number;
  cellColors: string[][];
  paletteId: string;
  completedColors: string[];
  thumbnail: string;
}
```

- [ ] **Step 3: Verify the project still compiles**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types
git commit -m "feat: add Palette and Pattern types"
```

---

### Task 3: Lab color conversion and Delta-E distance

**Files:**
- Create: `src/lib/color/lab.ts`
- Test: `src/lib/color/lab.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `RGB { r: number; g: number; b: number }`, `Lab { l: number; a: number; b: number }`, `rgbToLab(rgb: RGB): Lab`, `deltaE76(a: Lab, b: Lab): number` — used by Task 4 (nearest-color matching) and Task 8 (downsampling, via the `RGB` type).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { rgbToLab, deltaE76 } from './lab';

describe('rgbToLab', () => {
  it('converts white to L=100, a=0, b=0', () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(lab.l).toBeCloseTo(100, 0);
    expect(lab.a).toBeCloseTo(0, 0);
    expect(lab.b).toBeCloseTo(0, 0);
  });

  it('converts black to L=0, a=0, b=0', () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 0 });
    expect(lab.l).toBeCloseTo(0, 0);
    expect(lab.a).toBeCloseTo(0, 0);
    expect(lab.b).toBeCloseTo(0, 0);
  });
});

describe('deltaE76', () => {
  it('returns 0 for identical Lab colors', () => {
    const lab = rgbToLab({ r: 128, g: 64, b: 200 });
    expect(deltaE76(lab, lab)).toBe(0);
  });

  it('returns a larger distance for more different colors', () => {
    const white = rgbToLab({ r: 255, g: 255, b: 255 });
    const black = rgbToLab({ r: 0, g: 0, b: 0 });
    const gray = rgbToLab({ r: 200, g: 200, b: 200 });
    expect(deltaE76(white, black)).toBeGreaterThan(deltaE76(white, gray));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/color/lab.test.ts`
Expected: FAIL — `./lab` has no exported member `rgbToLab`/`deltaE76` (module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Lab {
  l: number;
  a: number;
  b: number;
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function labF(t: number): number {
  const delta = 6 / 29;
  return t > delta ** 3 ? Math.cbrt(t) : t / (3 * delta ** 2) + 4 / 29;
}

export function rgbToLab(rgb: RGB): Lab {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  // sRGB (linear) -> XYZ, D65 illuminant
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;

  // Normalize against the D65 white point
  const fx = labF(x / 0.95047);
  const fy = labF(y / 1.0);
  const fz = labF(z / 1.08883);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function deltaE76(a: Lab, b: Lab): number {
  const dl = a.l - b.l;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/color/lab.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/color/lab.ts src/lib/color/lab.test.ts
git commit -m "feat: add RGB-to-Lab conversion and Delta-E76 distance"
```

---

### Task 4: Nearest palette color matching

**Files:**
- Create: `src/lib/color/nearestMatch.ts`
- Test: `src/lib/color/nearestMatch.test.ts`

**Interfaces:**
- Consumes: `RGB`, `Lab`, `rgbToLab`, `deltaE76` from `src/lib/color/lab.ts`; `PaletteColor` from `src/types/palette.ts`.
- Produces: `hexToRgb(hex: string): RGB`, `findNearestColor(rgb: RGB, palette: PaletteColor[]): PaletteColor` — used by Plan 2's palette-assignment step and Plan 3's photo cell-sampling step.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { hexToRgb, findNearestColor } from './nearestMatch';
import { PaletteColor } from '../../types/palette';

describe('hexToRgb', () => {
  it('parses a 6-digit hex color', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });
});

describe('findNearestColor', () => {
  const palette: PaletteColor[] = [
    { name: 'Red', hex: '#ff0000' },
    { name: 'Green', hex: '#00ff00' },
    { name: 'Blue', hex: '#0000ff' },
  ];

  it('picks the closest palette color', () => {
    const match = findNearestColor({ r: 250, g: 10, b: 10 }, palette);
    expect(match.name).toBe('Red');
  });

  it('throws on an empty palette', () => {
    expect(() => findNearestColor({ r: 0, g: 0, b: 0 }, [])).toThrow(
      'palette must not be empty',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/color/nearestMatch.test.ts`
Expected: FAIL — module `./nearestMatch` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { RGB, rgbToLab, deltaE76 } from './lab';
import { PaletteColor } from '../../types/palette';

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

export function findNearestColor(rgb: RGB, palette: PaletteColor[]): PaletteColor {
  if (palette.length === 0) {
    throw new Error('findNearestColor: palette must not be empty');
  }

  const targetLab = rgbToLab(rgb);
  let best = palette[0];
  let bestDistance = deltaE76(targetLab, rgbToLab(hexToRgb(palette[0].hex)));

  for (let i = 1; i < palette.length; i++) {
    const candidate = palette[i];
    const distance = deltaE76(targetLab, rgbToLab(hexToRgb(candidate.hex)));
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/color/nearestMatch.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/color/nearestMatch.ts src/lib/color/nearestMatch.test.ts
git commit -m "feat: add nearest-palette-color matching via Lab distance"
```

---

### Task 5: Palette CSV parser

**Files:**
- Create: `src/lib/palette/csv.ts`
- Test: `src/lib/palette/csv.test.ts`

**Interfaces:**
- Consumes: `PaletteColor` from `src/types/palette.ts`.
- Produces: `ParseResult { colors: PaletteColor[]; errors: string[] }`, `parsePaletteCsv(csvText: string): ParseResult` — used by Task 6 (default palette) and Plan 2's palette-import screen.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { parsePaletteCsv } from './csv';

describe('parsePaletteCsv', () => {
  it('parses valid rows', () => {
    const csv = 'Name,Color\nA1,#fff4e6\nA2,#f4f5d1';
    const result = parsePaletteCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.colors).toEqual([
      { name: 'A1', hex: '#fff4e6' },
      { name: 'A2', hex: '#f4f5d1' },
    ]);
  });

  it('skips rows with invalid hex colors and reports an error', () => {
    const csv = 'Name,Color\nA1,#fff4e6\nA2,notacolor';
    const result = parsePaletteCsv(csv);
    expect(result.colors).toEqual([{ name: 'A1', hex: '#fff4e6' }]);
    expect(result.errors).toEqual(['Row 3: invalid color "notacolor"']);
  });

  it('skips rows with a duplicate name', () => {
    const csv = 'Name,Color\nA1,#fff4e6\nA1,#000000';
    const result = parsePaletteCsv(csv);
    expect(result.colors).toEqual([{ name: 'A1', hex: '#fff4e6' }]);
    expect(result.errors).toEqual(['Row 3: duplicate name "A1"']);
  });

  it('reports an error when required headers are missing', () => {
    const csv = 'Foo,Bar\n1,2';
    const result = parsePaletteCsv(csv);
    expect(result.colors).toEqual([]);
    expect(result.errors).toEqual(['CSV header must contain "Name" and "Color" columns']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/palette/csv.test.ts`
Expected: FAIL — module `./csv` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { PaletteColor } from '../../types/palette';

export interface ParseResult {
  colors: PaletteColor[];
  errors: string[];
}

const HEX_PATTERN = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function parsePaletteCsv(csvText: string): ParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { colors: [], errors: ['CSV is empty'] };
  }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  const colorIdx = header.indexOf('color');

  if (nameIdx === -1 || colorIdx === -1) {
    return { colors: [], errors: ['CSV header must contain "Name" and "Color" columns'] };
  }

  const colors: PaletteColor[] = [];
  const errors: string[] = [];
  const seenNames = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const cells = lines[i].split(',').map((c) => c.trim());
    const name = cells[nameIdx];
    const hex = cells[colorIdx];

    if (!name) {
      errors.push(`Row ${rowNumber}: missing name`);
      continue;
    }
    if (!hex || !HEX_PATTERN.test(hex)) {
      errors.push(`Row ${rowNumber}: invalid color "${hex ?? ''}"`);
      continue;
    }
    if (seenNames.has(name)) {
      errors.push(`Row ${rowNumber}: duplicate name "${name}"`);
      continue;
    }

    seenNames.add(name);
    colors.push({ name, hex: hex.toLowerCase() });
  }

  return { colors, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/palette/csv.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/palette/csv.ts src/lib/palette/csv.test.ts
git commit -m "feat: add palette CSV parser with row-level validation"
```

---

### Task 6: Default bead palette data

**Files:**
- Create: `src/lib/palette/defaultPaletteCsv.ts`
- Create: `src/lib/palette/defaultPalette.ts`
- Test: `src/lib/palette/defaultPalette.test.ts`

**Interfaces:**
- Consumes: `parsePaletteCsv` from `src/lib/palette/csv.ts`; `Palette` from `src/types/palette.ts`.
- Produces: `DEFAULT_PALETTE_ID: string`, `defaultPalette: Palette` — used by Task 11 (`ensureDefaultPalette`) and Plan 2's palette-assignment step.

- [ ] **Step 1: Create `src/lib/palette/defaultPaletteCsv.ts`**

This embeds the user's actual bead color CSV (from `beads - colors.csv`) as the app's built-in default palette.

```typescript
export const DEFAULT_PALETTE_CSV = `Name,Color
A1,#fff4e6
A2,#f4f5d1
A3,#fff3b1
A4,#faf95d
A5,#fde93d
A6,#fbc83a
A7,#fe8546
A8,#e2c731
A9,#fcaa75
A10,#fe923e
A11,#fdd785
A12,#fabda0
A13,#fecf48
A14,#f66a2c
A15,#fefd3a
A16,#fffab2
A17,#fde476
A18,#facd94
A19,#ff8f86
A20,#f8d772
A21,#ffe880
A22,#eef786
A23,#dfcbb2
A24,#fbf495
A25,#fcdb74
A26,#fdca24
B1,#ebf045
B2,#b5e944
B3,#9af4a8
B4,#51fa41
B5,#6ed163
B6,#79edc8
B7,#3cb48f
B8,#0f9348
B9,#26523a
B10,#b0e0d7
B11,#5b7820
B12,#1e6f55
B13,#e6f5ad
B14,#cbea3b
B15,#304f33
B16,#d3f2b7
B17,#a6b026
B18,#e5f754
B19,#5dccb3
B20,#e4fbde
B21,#119092
B22,#0c5546
B23,#364916
B24,#ebfbb5
B25,#5f9182
B26,#ccb975
B27,#c4e1b1
B28,#9ee3b6
B29,#c3e156
B30,#e5faab
B31,#b1e592
B32,#96a95f
C1,#f2fbf3
C2,#d1f8ee
C3,#acf5fb
C4,#6ed7f9
C5,#24b5e7
C6,#7abdf5
C7,#408aec
C8,#1372c8
C9,#3148bf
C10,#57d2f7
C11,#3fd2d8
C12,#203d6b
C13,#ceebf9
C14,#e7fafe
C15,#32dee8
C16,#0a5297
C17,#75e5f6
C18,#1f4354
C19,#2299bf
C20,#177bc1
C21,#deecfc
C22,#6fb3be
C23,#c8dff7
C24,#83bdfe
C25,#b6dfe5
C26,#3da9d0
C27,#d4dcf4
C28,#c0cfe9
C29,#2e4786
D1,#b4cfff
D2,#9ea4e0
D3,#234eae
D4,#314470
D5,#c56ebb
D6,#a99be3
D7,#8b6aba
D8,#ded4fd
D9,#cdc4fe
D10,#342055
D11,#c8d1ff
D12,#d7aede
D13,#c14bb0
D14,#8435a6
D15,#44277a
D16,#e7e9ff
D17,#c9d6fd
D18,#b88ec8
D19,#e3cffa
D20,#9f55d0
D21,#8a319c
D22,#594f8e
D23,#eae7f9
D24,#7488ec
D25,#464ec5
D26,#dcbef2
E1,#f9d2d0
E2,#f8d4ed
E3,#fc9ecc
E4,#ed79aa
E5,#f652a7
E6,#fe2f82
E7,#a51267
E8,#fadfec
E9,#e88ed5
E10,#bc3972
E11,#fceae9
E12,#feaddd
E13,#a6127f
E14,#fcd1bd
E15,#edd5d8
E16,#fff1ef
E17,#f6e7f7
E18,#fcd0e7
E19,#f6d1f1
E20,#d3c8d5
E21,#c39999
E22,#b7859b
E23,#927c89
E24,#e1b8e0
F1,#fba097
F2,#fa6964
F3,#ea4856
F4,#fe1027
F5,#ef2122
F6,#b53c34
F7,#941b38
F8,#b80b32
F9,#e5708a
F10,#9d4f31
F11,#6d3530
F12,#f7415c
F13,#d14a2e
F14,#ffa9aa
F15,#de0a2d
F16,#fddce2
F17,#f09c70
F18,#ce7a4c
F19,#b84750
F20,#ca928e
F21,#f8b2c6
F22,#fbbfd2
F23,#eb8165
F24,#e897b0
F25,#ea484e
G1,#ffe6c6
G2,#fbceb6
G3,#ecc3b3
G4,#dbb39c
G5,#f0a470
G6,#eb9664
G7,#8b5a3b
G8,#49251d
G9,#e9bd83
G10,#ce912f
G11,#e3c697
G12,#dbb088
G13,#d08f58
G14,#8e634e
G15,#f4f1de
G16,#efdfd0
G17,#695952
G18,#ffecdb
G19,#f09f56
G20,#b2603c
G21,#b88459
H1,#fffdfe
H2,#ffffff
H3,#cbc6cf
H4,#939095
H5,#635e66
H6,#39383f
H7,#020004
H8,#f2e4ec
H9,#e6e0db
H10,#e2e1f1
H11,#cecbcc
H12,#f9f6e7
H13,#ede1cc
H14,#d4dde8
H15,#99a4b9
H16,#261716
H17,#f3ebee
H18,#fdfcf6
H19,#f1efe4
H20,#95a0a0
H21,#f9fce3
H22,#cbcbcf
H23,#9a9d8c
M1,#cdd6cd
M2,#91ac96
M3,#718794
M4,#eee5dc
M5,#dbd6b0
M6,#d0c09c
M7,#bfaca7
M8,#ac9696
M9,#b69780
M10,#bbadc0
M11,#9b7fa0
M12,#6f5b5f
M13,#e5a398
M14,#d47065
M15,#817b81
`;
```

- [ ] **Step 2: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { defaultPalette, DEFAULT_PALETTE_ID } from './defaultPalette';

describe('defaultPalette', () => {
  it('has an id and is marked built-in', () => {
    expect(defaultPalette.id).toBe(DEFAULT_PALETTE_ID);
    expect(defaultPalette.isBuiltIn).toBe(true);
  });

  it('parses all 221 colors from the bead CSV with no errors', () => {
    expect(defaultPalette.colors).toHaveLength(221);
  });

  it('includes the first and last colors from the source CSV', () => {
    expect(defaultPalette.colors[0]).toEqual({ name: 'A1', hex: '#fff4e6' });
    expect(defaultPalette.colors[defaultPalette.colors.length - 1]).toEqual({
      name: 'M15',
      hex: '#817b81',
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/palette/defaultPalette.test.ts`
Expected: FAIL — module `./defaultPalette` does not exist.

- [ ] **Step 4: Write the implementation**

```typescript
import { parsePaletteCsv } from './csv';
import { DEFAULT_PALETTE_CSV } from './defaultPaletteCsv';
import { Palette } from '../../types/palette';

const parsed = parsePaletteCsv(DEFAULT_PALETTE_CSV);

if (parsed.errors.length > 0) {
  throw new Error(`Default palette CSV has invalid rows: ${parsed.errors.join('; ')}`);
}

export const DEFAULT_PALETTE_ID = 'default-bead-palette';

export const defaultPalette: Palette = {
  id: DEFAULT_PALETTE_ID,
  name: 'Default Bead Palette',
  isBuiltIn: true,
  colors: parsed.colors,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/palette/defaultPalette.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/palette/defaultPaletteCsv.ts src/lib/palette/defaultPalette.ts src/lib/palette/defaultPalette.test.ts
git commit -m "feat: embed default bead palette from user's color CSV"
```

---

### Task 7: Digital pixel-art block-size detection

**Files:**
- Create: `src/lib/pixelart/blockDetect.ts`
- Test: `src/lib/pixelart/blockDetect.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ImageBuffer { width: number; height: number; data: Uint8ClampedArray }` (RGBA, matches the browser's native `ImageData` shape), `BlockSize { blockWidth: number; blockHeight: number }`, `detectBlockSize(image: ImageBuffer): BlockSize | null` — used by Task 8 (downsampling) and Plan 2's digital-image upload step.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { detectBlockSize, ImageBuffer } from './blockDetect';

function makeCheckerboard(
  blockWidth: number,
  blockHeight: number,
  blocksX: number,
  blocksY: number,
): ImageBuffer {
  const width = blockWidth * blocksX;
  const height = blockHeight * blocksY;
  const data = new Uint8ClampedArray(width * height * 4);
  const colorA: [number, number, number] = [255, 0, 0];
  const colorB: [number, number, number] = [0, 0, 255];

  for (let y = 0; y < height; y++) {
    const blockY = Math.floor(y / blockHeight);
    for (let x = 0; x < width; x++) {
      const blockX = Math.floor(x / blockWidth);
      const color = (blockX + blockY) % 2 === 0 ? colorA : colorB;
      const idx = (y * width + x) * 4;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = 255;
    }
  }

  return { width, height, data };
}

describe('detectBlockSize', () => {
  it('detects a square block size from a checkerboard pattern', () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    expect(detectBlockSize(image)).toEqual({ blockWidth: 3, blockHeight: 3 });
  });

  it('detects a non-square block size', () => {
    const image = makeCheckerboard(4, 5, 3, 2);
    expect(detectBlockSize(image)).toEqual({ blockWidth: 4, blockHeight: 5 });
  });

  it('returns null for a solid-color image with no detectable grid', () => {
    const width = 12;
    const height = 12;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 100;
      data[i + 1] = 100;
      data[i + 2] = 100;
      data[i + 3] = 255;
    }
    expect(detectBlockSize({ width, height, data })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pixelart/blockDetect.test.ts`
Expected: FAIL — module `./blockDetect` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
export interface ImageBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface BlockSize {
  blockWidth: number;
  blockHeight: number;
}

function getPixel(image: ImageBuffer, x: number, y: number): [number, number, number] {
  const idx = (y * image.width + x) * 4;
  return [image.data[idx], image.data[idx + 1], image.data[idx + 2]];
}

function pixelsEqual(a: [number, number, number], b: [number, number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let bestValue = values[0];
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  }
  return bestValue;
}

function gapsFromBoundaries(boundaries: number[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < boundaries.length; i++) {
    const gap = boundaries[i] - boundaries[i - 1];
    if (gap > 0) gaps.push(gap);
  }
  return gaps;
}

function detectBlockWidth(image: ImageBuffer): number | null {
  const changeCounts = new Array(image.width).fill(0);
  for (let y = 0; y < image.height; y++) {
    for (let x = 1; x < image.width; x++) {
      if (!pixelsEqual(getPixel(image, x, y), getPixel(image, x - 1, y))) {
        changeCounts[x]++;
      }
    }
  }
  const threshold = image.height * 0.5;
  const boundaries = [0];
  for (let x = 1; x < image.width; x++) {
    if (changeCounts[x] >= threshold) boundaries.push(x);
  }
  boundaries.push(image.width);
  // No interior boundaries found (only the start/end sentinels) means no
  // grid was detected at all — fall back to null instead of reporting the
  // whole image as a single block.
  if (boundaries.length <= 2) return null;
  return mode(gapsFromBoundaries(boundaries));
}

function detectBlockHeight(image: ImageBuffer): number | null {
  const changeCounts = new Array(image.height).fill(0);
  for (let x = 0; x < image.width; x++) {
    for (let y = 1; y < image.height; y++) {
      if (!pixelsEqual(getPixel(image, x, y), getPixel(image, x, y - 1))) {
        changeCounts[y]++;
      }
    }
  }
  const threshold = image.width * 0.5;
  const boundaries = [0];
  for (let y = 1; y < image.height; y++) {
    if (changeCounts[y] >= threshold) boundaries.push(y);
  }
  boundaries.push(image.height);
  if (boundaries.length <= 2) return null;
  return mode(gapsFromBoundaries(boundaries));
}

export function detectBlockSize(image: ImageBuffer): BlockSize | null {
  const blockWidth = detectBlockWidth(image);
  const blockHeight = detectBlockHeight(image);
  if (blockWidth === null || blockHeight === null) return null;
  return { blockWidth, blockHeight };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pixelart/blockDetect.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pixelart/blockDetect.ts src/lib/pixelart/blockDetect.test.ts
git commit -m "feat: detect pixel-art block size via color-change run analysis"
```

---

### Task 8: Digital image downsampling to a color grid

**Files:**
- Create: `src/lib/pixelart/downsample.ts`
- Test: `src/lib/pixelart/downsample.test.ts`

**Interfaces:**
- Consumes: `ImageBuffer` from `src/lib/pixelart/blockDetect.ts`; `RGB` from `src/lib/color/lab.ts`.
- Produces: `downsampleToGrid(image: ImageBuffer, blockWidth: number, blockHeight: number): RGB[][]` — used by Plan 2's digital-image upload step (feeds into `findNearestColor` per cell).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { downsampleToGrid } from './downsample';
import { ImageBuffer } from './blockDetect';

function makeCheckerboard(
  blockWidth: number,
  blockHeight: number,
  blocksX: number,
  blocksY: number,
): ImageBuffer {
  const width = blockWidth * blocksX;
  const height = blockHeight * blocksY;
  const data = new Uint8ClampedArray(width * height * 4);
  const colorA: [number, number, number] = [255, 0, 0];
  const colorB: [number, number, number] = [0, 0, 255];

  for (let y = 0; y < height; y++) {
    const blockY = Math.floor(y / blockHeight);
    for (let x = 0; x < width; x++) {
      const blockX = Math.floor(x / blockWidth);
      const color = (blockX + blockY) % 2 === 0 ? colorA : colorB;
      const idx = (y * width + x) * 4;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = 255;
    }
  }

  return { width, height, data };
}

describe('downsampleToGrid', () => {
  it('averages each block to a single color', () => {
    const image = makeCheckerboard(3, 3, 2, 2);
    const grid = downsampleToGrid(image, 3, 3);
    expect(grid).toEqual([
      [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 0, b: 255 },
      ],
      [
        { r: 0, g: 0, b: 255 },
        { r: 255, g: 0, b: 0 },
      ],
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pixelart/downsample.test.ts`
Expected: FAIL — module `./downsample` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { ImageBuffer } from './blockDetect';
import { RGB } from '../color/lab';

export function downsampleToGrid(
  image: ImageBuffer,
  blockWidth: number,
  blockHeight: number,
): RGB[][] {
  const cols = Math.round(image.width / blockWidth);
  const rows = Math.round(image.height / blockHeight);
  const grid: RGB[][] = [];

  for (let row = 0; row < rows; row++) {
    const rowColors: RGB[] = [];
    for (let col = 0; col < cols; col++) {
      const startX = col * blockWidth;
      const startY = row * blockHeight;
      const endX = Math.min(startX + blockWidth, image.width);
      const endY = Math.min(startY + blockHeight, image.height);

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let count = 0;
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * image.width + x) * 4;
          sumR += image.data[idx];
          sumG += image.data[idx + 1];
          sumB += image.data[idx + 2];
          count++;
        }
      }

      rowColors.push({
        r: Math.round(sumR / count),
        g: Math.round(sumG / count),
        b: Math.round(sumB / count),
      });
    }
    grid.push(rowColors);
  }

  return grid;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pixelart/downsample.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pixelart/downsample.ts src/lib/pixelart/downsample.test.ts
git commit -m "feat: downsample pixel-art image to a per-cell color grid"
```

---

### Task 9: IndexedDB setup and palette repository

**Files:**
- Create: `src/lib/storage/db.ts`
- Create: `src/lib/storage/palettesRepo.ts`
- Test: `src/lib/storage/palettesRepo.test.ts`

**Interfaces:**
- Consumes: `Palette` from `src/types/palette.ts`; `Pattern` from `src/types/pattern.ts` (referenced in the shared DB schema).
- Produces: `getDb(): Promise<IDBPDatabase<BeadArtDB>>`, `resetDbForTests(): void`, `savePalette(palette: Palette): Promise<void>`, `getPalette(id: string): Promise<Palette | undefined>`, `listPalettes(): Promise<Palette[]>`, `deletePalette(id: string): Promise<void>` (throws if the palette is built-in) — used by Task 10 (`patternsRepo` shares `db.ts`), Task 11 (`ensureDefaultPalette`), and Plan 2's palette-management screen.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { resetDbForTests } from './db';
import { savePalette, getPalette, listPalettes, deletePalette } from './palettesRepo';
import { Palette } from '../../types/palette';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

function makePalette(overrides: Partial<Palette> = {}): Palette {
  return {
    id: 'palette-1',
    name: 'Test Palette',
    isBuiltIn: false,
    colors: [{ name: 'A1', hex: '#ff0000' }],
    ...overrides,
  };
}

describe('palettesRepo', () => {
  it('saves and retrieves a palette', async () => {
    const palette = makePalette();
    await savePalette(palette);
    expect(await getPalette('palette-1')).toEqual(palette);
  });

  it('lists all saved palettes', async () => {
    await savePalette(makePalette({ id: 'palette-1' }));
    await savePalette(makePalette({ id: 'palette-2', name: 'Second' }));
    const palettes = await listPalettes();
    expect(palettes.map((p) => p.id).sort()).toEqual(['palette-1', 'palette-2']);
  });

  it('deletes a custom palette', async () => {
    await savePalette(makePalette());
    await deletePalette('palette-1');
    expect(await getPalette('palette-1')).toBeUndefined();
  });

  it('refuses to delete a built-in palette', async () => {
    await savePalette(makePalette({ id: 'builtin-1', isBuiltIn: true }));
    await expect(deletePalette('builtin-1')).rejects.toThrow('built-in');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/storage/palettesRepo.test.ts`
Expected: FAIL — modules `./db` and `./palettesRepo` do not exist.

- [ ] **Step 3: Write `src/lib/storage/db.ts`**

```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Palette } from '../../types/palette';
import { Pattern } from '../../types/pattern';

interface BeadArtDB extends DBSchema {
  palettes: {
    key: string;
    value: Palette;
  };
  patterns: {
    key: string;
    value: Pattern;
  };
}

const DB_NAME = 'beadart';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BeadArtDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<BeadArtDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BeadArtDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('palettes')) {
          db.createObjectStore('palettes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('patterns')) {
          db.createObjectStore('patterns', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export function resetDbForTests(): void {
  dbPromise = null;
}
```

- [ ] **Step 4: Write `src/lib/storage/palettesRepo.ts`**

```typescript
import { getDb } from './db';
import { Palette } from '../../types/palette';

export async function savePalette(palette: Palette): Promise<void> {
  const db = await getDb();
  await db.put('palettes', palette);
}

export async function getPalette(id: string): Promise<Palette | undefined> {
  const db = await getDb();
  return db.get('palettes', id);
}

export async function listPalettes(): Promise<Palette[]> {
  const db = await getDb();
  return db.getAll('palettes');
}

export async function deletePalette(id: string): Promise<void> {
  const db = await getDb();
  const palette = await db.get('palettes', id);
  if (palette?.isBuiltIn) {
    throw new Error(`Cannot delete built-in palette "${palette.name}"`);
  }
  await db.delete('palettes', id);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/storage/palettesRepo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/db.ts src/lib/storage/palettesRepo.ts src/lib/storage/palettesRepo.test.ts
git commit -m "feat: add IndexedDB setup and palette repository"
```

---

### Task 10: Pattern repository

**Files:**
- Create: `src/lib/storage/patternsRepo.ts`
- Test: `src/lib/storage/patternsRepo.test.ts`

**Interfaces:**
- Consumes: `getDb`, `resetDbForTests` from `src/lib/storage/db.ts`; `Pattern` from `src/types/pattern.ts`.
- Produces: `savePattern(pattern: Pattern): Promise<void>`, `getPattern(id: string): Promise<Pattern | undefined>`, `listPatterns(): Promise<Pattern[]>`, `deletePattern(id: string): Promise<void>`, `setColorCompleted(patternId: string, colorName: string, completed: boolean): Promise<Pattern>` — used by Plan 2's Home and Working-view screens.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { resetDbForTests } from './db';
import {
  savePattern,
  getPattern,
  listPatterns,
  deletePattern,
  setColorCompleted,
} from './patternsRepo';
import { Pattern } from '../../types/pattern';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: 'pattern-1',
    name: 'Test Pattern',
    createdAt: '2026-08-02T00:00:00.000Z',
    rows: 2,
    cols: 2,
    cellColors: [
      ['A1', 'A2'],
      ['A3', 'A4'],
    ],
    paletteId: 'default-bead-palette',
    completedColors: [],
    thumbnail: 'data:image/png;base64,',
    ...overrides,
  };
}

describe('patternsRepo', () => {
  it('saves and retrieves a pattern', async () => {
    const pattern = makePattern();
    await savePattern(pattern);
    expect(await getPattern('pattern-1')).toEqual(pattern);
  });

  it('lists all saved patterns', async () => {
    await savePattern(makePattern({ id: 'pattern-1' }));
    await savePattern(makePattern({ id: 'pattern-2', name: 'Second' }));
    const patterns = await listPatterns();
    expect(patterns.map((p) => p.id).sort()).toEqual(['pattern-1', 'pattern-2']);
  });

  it('deletes a pattern', async () => {
    await savePattern(makePattern());
    await deletePattern('pattern-1');
    expect(await getPattern('pattern-1')).toBeUndefined();
  });

  it('marks a color as completed and un-completed', async () => {
    await savePattern(makePattern());
    const afterComplete = await setColorCompleted('pattern-1', 'A1', true);
    expect(afterComplete.completedColors).toEqual(['A1']);
    const afterUncomplete = await setColorCompleted('pattern-1', 'A1', false);
    expect(afterUncomplete.completedColors).toEqual([]);
  });

  it('throws when marking a color complete on a missing pattern', async () => {
    await expect(setColorCompleted('missing', 'A1', true)).rejects.toThrow('not found');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/storage/patternsRepo.test.ts`
Expected: FAIL — module `./patternsRepo` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { getDb } from './db';
import { Pattern } from '../../types/pattern';

export async function savePattern(pattern: Pattern): Promise<void> {
  const db = await getDb();
  await db.put('patterns', pattern);
}

export async function getPattern(id: string): Promise<Pattern | undefined> {
  const db = await getDb();
  return db.get('patterns', id);
}

export async function listPatterns(): Promise<Pattern[]> {
  const db = await getDb();
  return db.getAll('patterns');
}

export async function deletePattern(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('patterns', id);
}

export async function setColorCompleted(
  patternId: string,
  colorName: string,
  completed: boolean,
): Promise<Pattern> {
  const db = await getDb();
  const pattern = await db.get('patterns', patternId);
  if (!pattern) {
    throw new Error(`Pattern "${patternId}" not found`);
  }

  const completedColors = new Set(pattern.completedColors);
  if (completed) {
    completedColors.add(colorName);
  } else {
    completedColors.delete(colorName);
  }

  const updated: Pattern = { ...pattern, completedColors: Array.from(completedColors) };
  await db.put('patterns', updated);
  return updated;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/storage/patternsRepo.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/patternsRepo.ts src/lib/storage/patternsRepo.test.ts
git commit -m "feat: add pattern repository with per-color completion tracking"
```

---

### Task 11: Default palette initialization

**Files:**
- Create: `src/lib/storage/initStorage.ts`
- Test: `src/lib/storage/initStorage.test.ts`

**Interfaces:**
- Consumes: `defaultPalette` from `src/lib/palette/defaultPalette.ts`; `getPalette`, `savePalette` from `src/lib/storage/palettesRepo.ts`.
- Produces: `ensureDefaultPalette(): Promise<void>` — called once at app startup in Plan 2 (e.g. in `main.tsx` or an app-level effect) before rendering the Home screen.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { resetDbForTests } from './db';
import { ensureDefaultPalette } from './initStorage';
import { getPalette } from './palettesRepo';
import { defaultPalette } from '../palette/defaultPalette';

afterEach(async () => {
  resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('beadart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
});

describe('ensureDefaultPalette', () => {
  it('saves the default palette when none exists', async () => {
    await ensureDefaultPalette();
    expect(await getPalette(defaultPalette.id)).toEqual(defaultPalette);
  });

  it('does not overwrite an existing default palette', async () => {
    await ensureDefaultPalette();
    await ensureDefaultPalette();
    expect(await getPalette(defaultPalette.id)).toEqual(defaultPalette);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/storage/initStorage.test.ts`
Expected: FAIL — module `./initStorage` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
import { defaultPalette } from '../palette/defaultPalette';
import { getPalette, savePalette } from './palettesRepo';

export async function ensureDefaultPalette(): Promise<void> {
  const existing = await getPalette(defaultPalette.id);
  if (!existing) {
    await savePalette(defaultPalette);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/storage/initStorage.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests across every task in this plan pass (lab, nearestMatch, csv, defaultPalette, blockDetect, downsample, palettesRepo, patternsRepo, initStorage).

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/initStorage.ts src/lib/storage/initStorage.test.ts
git commit -m "feat: ensure default bead palette exists on startup"
```
