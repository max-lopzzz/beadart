import { describe, it, expect } from 'vitest';
import { containScale } from './renderRgbGrid';

describe('containScale', () => {
  it('returns 1 when both dimensions already fit within maxSize', () => {
    expect(containScale(100, 50, 200)).toBe(1);
  });

  it('scales down a wide image by its width', () => {
    expect(containScale(400, 100, 200)).toBe(0.5);
  });

  it('scales down a tall image by its height, not just its width', () => {
    // A portrait image narrower than maxSize but taller than it must still
    // be scaled down by the height ratio, or it renders oversized.
    expect(containScale(100, 400, 200)).toBe(0.5);
  });

  it('picks the smaller ratio when both dimensions exceed maxSize', () => {
    expect(containScale(400, 800, 200)).toBe(0.25);
  });
});
