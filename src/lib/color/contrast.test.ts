import { describe, it, expect } from 'vitest';
import { hexToRgbChannels, contrastTextColor } from './contrast';

describe('hexToRgbChannels', () => {
  it('parses a hex color into r, g, b channels', () => {
    expect(hexToRgbChannels('#ff0080')).toEqual([255, 0, 128]);
  });
});

describe('contrastTextColor', () => {
  it('returns black text for a light background', () => {
    expect(contrastTextColor('#ffffff')).toBe('#000000');
  });

  it('returns white text for a dark background', () => {
    expect(contrastTextColor('#000000')).toBe('#ffffff');
  });
});
