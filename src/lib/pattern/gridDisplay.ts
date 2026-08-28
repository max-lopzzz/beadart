// Whether the working-view grid should draw a bolder "major" gridline
// before this row/column, at a fixed interval - like the bold lines every
// 10 squares on graph paper, so a large pattern's position can be counted
// at a glance instead of only pixel-by-pixel.
export function isMajorLineStart(index: number, interval: number): boolean {
  return interval > 0 && index > 0 && index % interval === 0;
}

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.25;
export const ZOOM_DEFAULT = 1;

function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom * 100) / 100));
}

export function zoomIn(zoom: number): number {
  return clampZoom(zoom + ZOOM_STEP);
}

export function zoomOut(zoom: number): number {
  return clampZoom(zoom - ZOOM_STEP);
}
