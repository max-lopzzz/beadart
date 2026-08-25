export interface SharedColorProgress {
  name: string;
  hex: string;
  total: number;
  done: boolean;
}

export interface SharedPatternSummary {
  slug: string;
  name: string;
  thumbnail: string;
  percent: number;
  colors: SharedColorProgress[];
  updatedAt: string;
}
