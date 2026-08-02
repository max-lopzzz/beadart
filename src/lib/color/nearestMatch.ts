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
