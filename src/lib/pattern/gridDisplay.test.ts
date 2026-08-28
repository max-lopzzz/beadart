import { describe, it, expect } from 'vitest';
import { ZOOM_MAX, ZOOM_MIN, isMajorLineStart, zoomIn, zoomOut } from './gridDisplay';

describe('isMajorLineStart', () => {
  it('is true for a nonzero index that is a multiple of the interval', () => {
    expect(isMajorLineStart(10, 10)).toBe(true);
    expect(isMajorLineStart(20, 10)).toBe(true);
  });

  it('is false for index 0, even though 0 is a multiple of everything', () => {
    // The very first row/column doesn't need a "major line" - it's already
    // the grid's own edge.
    expect(isMajorLineStart(0, 10)).toBe(false);
  });

  it('is false for an index that is not a multiple of the interval', () => {
    expect(isMajorLineStart(7, 10)).toBe(false);
  });

  it('is false when the interval is 0 (feature turned off)', () => {
    expect(isMajorLineStart(10, 0)).toBe(false);
  });
});

describe('zoomIn / zoomOut', () => {
  it('steps up by the fixed increment', () => {
    expect(zoomIn(1)).toBeCloseTo(1.25);
  });

  it('steps down by the fixed increment', () => {
    expect(zoomOut(1)).toBeCloseTo(0.75);
  });

  it('clamps zoomIn at the maximum', () => {
    expect(zoomIn(ZOOM_MAX)).toBe(ZOOM_MAX);
  });

  it('clamps zoomOut at the minimum', () => {
    expect(zoomOut(ZOOM_MIN)).toBe(ZOOM_MIN);
  });
});
