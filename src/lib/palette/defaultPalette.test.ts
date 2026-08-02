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
