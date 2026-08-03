import { describe, it, expect } from 'vitest';
import {
  defaultQuad,
  clampPoint,
  computeDisplayScale,
  toDisplayPoint,
  toImagePoint,
} from './quad';

describe('defaultQuad', () => {
  it('returns the four corners of the image bounding box', () => {
    expect(defaultQuad(100, 50)).toEqual({
      topLeft: { x: 0, y: 0 },
      topRight: { x: 100, y: 0 },
      bottomRight: { x: 100, y: 50 },
      bottomLeft: { x: 0, y: 50 },
    });
  });
});

describe('clampPoint', () => {
  it('leaves an in-bounds point unchanged', () => {
    expect(clampPoint({ x: 50, y: 20 }, 100, 50)).toEqual({ x: 50, y: 20 });
  });

  it('clamps a point below zero up to zero', () => {
    expect(clampPoint({ x: -10, y: -5 }, 100, 50)).toEqual({ x: 0, y: 0 });
  });

  it('clamps a point beyond the bounds down to the max', () => {
    expect(clampPoint({ x: 200, y: 999 }, 100, 50)).toEqual({ x: 100, y: 50 });
  });
});

describe('computeDisplayScale', () => {
  it('returns 1 (no upscaling) when the image is already narrower than the max', () => {
    expect(computeDisplayScale(400, 600)).toBe(1);
  });

  it('returns a fraction that scales a wider image down to the max width', () => {
    expect(computeDisplayScale(1200, 600)).toBe(0.5);
  });
});

describe('toDisplayPoint / toImagePoint', () => {
  it('scales a point down for display and back up for image coordinates', () => {
    const imagePoint = { x: 400, y: 200 };
    const scale = 0.5;
    const displayPoint = toDisplayPoint(imagePoint, scale);
    expect(displayPoint).toEqual({ x: 200, y: 100 });
    expect(toImagePoint(displayPoint, scale)).toEqual(imagePoint);
  });
});
