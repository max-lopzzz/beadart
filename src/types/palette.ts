export interface PaletteColor {
  name: string;
  hex: string;
}

export interface Palette {
  id: string;
  name: string;
  isBuiltIn: boolean;
  colors: PaletteColor[];
}
