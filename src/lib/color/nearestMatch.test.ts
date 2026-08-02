import { describe, it, expect } from 'vitest';
import { hexToRgb, findNearestColor } from './nearestMatch';
import { PaletteColor } from '../../types/palette';

describe('hexToRgb', () => {
  it('parses a 6-digit hex color', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('expands a 3-digit shorthand hex color', () => {
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
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
