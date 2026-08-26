export interface SharedOverviewMaterial {
  name: string;
  hex: string;
  total: number;
  remaining: number;
}

export interface SharedOverviewSummary {
  patternCount: number;
  beadsPlaced: number;
  beadsTotal: number;
  percent: number;
  materials: SharedOverviewMaterial[];
  updatedAt: string;
}
