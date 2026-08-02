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
