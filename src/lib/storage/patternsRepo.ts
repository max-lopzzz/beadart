import { getDb } from './db';
import { Pattern } from '../../types/pattern';

export async function savePattern(pattern: Pattern): Promise<void> {
  const db = await getDb();
  await db.put('patterns', pattern);
}

export async function getPattern(id: string): Promise<Pattern | undefined> {
  const db = await getDb();
  return db.get('patterns', id);
}

export async function listPatterns(): Promise<Pattern[]> {
  const db = await getDb();
  return db.getAll('patterns');
}

export async function deletePattern(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('patterns', id);
}

export async function setColorCompleted(
  patternId: string,
  colorName: string,
  completed: boolean,
): Promise<Pattern> {
  const db = await getDb();
  const pattern = await db.get('patterns', patternId);
  if (!pattern) {
    throw new Error(`Pattern "${patternId}" not found`);
  }

  const completedColors = new Set(pattern.completedColors);
  if (completed) {
    completedColors.add(colorName);
  } else {
    completedColors.delete(colorName);
  }

  const updated: Pattern = { ...pattern, completedColors: Array.from(completedColors) };
  await db.put('patterns', updated);
  return updated;
}

export async function replaceColorInPattern(
  patternId: string,
  fromColor: string,
  toColor: string,
): Promise<Pattern> {
  const db = await getDb();
  const pattern = await db.get('patterns', patternId);
  if (!pattern) {
    throw new Error(`Pattern "${patternId}" not found`);
  }

  const cellColors = pattern.cellColors.map((row) =>
    row.map((colorName) => (colorName === fromColor ? toColor : colorName)),
  );
  const completedColors = pattern.completedColors.filter((name) => name !== fromColor);

  const updated: Pattern = { ...pattern, cellColors, completedColors };
  await db.put('patterns', updated);
  return updated;
}

export async function renamePattern(patternId: string, name: string): Promise<Pattern> {
  const db = await getDb();
  const pattern = await db.get('patterns', patternId);
  if (!pattern) {
    throw new Error(`Pattern "${patternId}" not found`);
  }

  const updated: Pattern = { ...pattern, name };
  await db.put('patterns', updated);
  return updated;
}

export interface CellPosition {
  row: number;
  col: number;
}

export async function setCellsColor(
  patternId: string,
  cells: CellPosition[],
  newColor: string,
): Promise<Pattern> {
  const db = await getDb();
  const pattern = await db.get('patterns', patternId);
  if (!pattern) {
    throw new Error(`Pattern "${patternId}" not found`);
  }

  const targets = new Set(cells.map(({ row, col }) => `${row}-${col}`));
  const cellColors = pattern.cellColors.map((rowColors, rowIndex) =>
    rowColors.map((colorName, colIndex) =>
      targets.has(`${rowIndex}-${colIndex}`) ? newColor : colorName,
    ),
  );

  const updated: Pattern = { ...pattern, cellColors };
  await db.put('patterns', updated);
  return updated;
}
