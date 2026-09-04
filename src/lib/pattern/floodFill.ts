// Flood-fills outward from (row, col) across 4-connected neighbors that
// share the exact same cellColors value (including EMPTY_CELL, which is
// itself just a regular string value here) - lets a shift-click select an
// entire same-color region in one action instead of clicking every cell.
export function floodFillRegion(
  cellColors: string[][],
  row: number,
  col: number,
): { row: number; col: number }[] {
  if (row < 0 || row >= cellColors.length) return [];
  if (col < 0 || col >= cellColors[row].length) return [];

  const target = cellColors[row][col];
  const visited = new Set<string>();
  const result: { row: number; col: number }[] = [];
  const stack: { row: number; col: number }[] = [{ row, col }];

  while (stack.length > 0) {
    const cell = stack.pop()!;
    const key = `${cell.row}-${cell.col}`;
    if (visited.has(key)) continue;
    if (cell.row < 0 || cell.row >= cellColors.length) continue;
    if (cell.col < 0 || cell.col >= cellColors[cell.row].length) continue;
    if (cellColors[cell.row][cell.col] !== target) continue;

    visited.add(key);
    result.push(cell);
    stack.push(
      { row: cell.row - 1, col: cell.col },
      { row: cell.row + 1, col: cell.col },
      { row: cell.row, col: cell.col - 1 },
      { row: cell.row, col: cell.col + 1 },
    );
  }

  return result;
}
