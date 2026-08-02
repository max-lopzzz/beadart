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
