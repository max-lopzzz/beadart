export interface Point {
  x: number;
  y: number;
}

export interface Quad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export function defaultQuad(width: number, height: number): Quad {
  return {
    topLeft: { x: 0, y: 0 },
    topRight: { x: width, y: 0 },
    bottomRight: { x: width, y: height },
    bottomLeft: { x: 0, y: height },
  };
}

export function clampPoint(point: Point, width: number, height: number): Point {
  return {
    x: Math.min(Math.max(point.x, 0), width),
    y: Math.min(Math.max(point.y, 0), height),
  };
}

export function computeDisplayScale(imageWidth: number, maxDisplayWidth: number): number {
  return Math.min(1, maxDisplayWidth / imageWidth);
}

export function toDisplayPoint(point: Point, scale: number): Point {
  return { x: point.x * scale, y: point.y * scale };
}

export function toImagePoint(point: Point, scale: number): Point {
  return { x: point.x / scale, y: point.y / scale };
}
