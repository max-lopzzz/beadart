import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getSharedPatternsDb } from './firebaseClient';
import { Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';
import { SharedPatternSummary } from '../../types/sharedPattern';
import { colorCounts, completionPercent } from '../pattern/patternStats';

const COLLECTION = 'sharedPatterns';

export function buildSharedSummary(
  slug: string,
  pattern: Pattern,
  palette: Palette,
): SharedPatternSummary {
  return {
    slug,
    name: pattern.name,
    thumbnail: pattern.thumbnail,
    percent: completionPercent(pattern, palette),
    colors: colorCounts(pattern, palette).map((c) => ({
      name: c.name,
      hex: c.hex,
      total: c.count,
      done: pattern.completedColors.includes(c.name),
    })),
    updatedAt: new Date().toISOString(),
  };
}

export async function publishPattern(
  slug: string,
  pattern: Pattern,
  palette: Palette,
): Promise<void> {
  const summary = buildSharedSummary(slug, pattern, palette);
  const db = getSharedPatternsDb();
  await setDoc(doc(db, COLLECTION, slug), {
    name: summary.name,
    thumbnail: summary.thumbnail,
    percent: summary.percent,
    colors: summary.colors,
    updatedAt: summary.updatedAt,
  });
}

export async function unpublishPattern(slug: string): Promise<void> {
  const db = getSharedPatternsDb();
  await deleteDoc(doc(db, COLLECTION, slug));
}

export async function fetchSharedPattern(slug: string): Promise<SharedPatternSummary | null> {
  const db = getSharedPatternsDb();
  const snapshot = await getDoc(doc(db, COLLECTION, slug));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    slug,
    name: data.name,
    thumbnail: data.thumbnail,
    percent: data.percent,
    colors: data.colors,
    updatedAt: data.updatedAt,
  };
}
