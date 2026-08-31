export interface SharedOverviewMaterial {
  name: string;
  hex: string;
  total: number;
  remaining: number;
}

export interface SharedOverviewPattern {
  id: string;
  name: string;
  thumbnail: string;
  percent: number;
}

export interface SharedOverviewSummary {
  patternCount: number;
  beadsPlaced: number;
  beadsTotal: number;
  percent: number;
  materials: SharedOverviewMaterial[];
  patterns: SharedOverviewPattern[];
  updatedAt: string;
}
