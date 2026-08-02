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
