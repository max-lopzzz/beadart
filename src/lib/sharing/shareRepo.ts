import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

import { getSharedPatternsDb } from './firebaseClient';

import { Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';
import { SharedPatternSummary, SharedColorProgress } from '../../types/sharedPattern';
import {
  SharedOverviewSummary,
  SharedOverviewMaterial,
  SharedOverviewPattern,
} from '../../types/sharedOverview';

import { colorCounts, completionPercent } from '../pattern/patternStats';
import { aggregateColorTotals } from '../pattern/materialsSummary';

const COLLECTION = 'sharedPatterns';
const OVERVIEW_COLLECTION = 'sharedOverview';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSharedColorProgress(value: unknown): value is SharedColorProgress {
  if (!isRecord(value)) return false;

  return (
    typeof value.name === 'string' &&
    typeof value.hex === 'string' &&
    typeof value.total === 'number' &&
    Number.isFinite(value.total) &&
    value.total >= 0 &&
    typeof value.done === 'boolean'
  );
}

function parseSharedPatternSummary(
  slug: string,
  value: unknown,
): SharedPatternSummary | null {
  if (!isRecord(value)) return null;

  if (
    typeof value.name !== 'string' ||
    typeof value.thumbnail !== 'string' ||
    typeof value.percent !== 'number' ||
    !Number.isFinite(value.percent) ||
    value.percent < 0 ||
    value.percent > 100 ||
    !Array.isArray(value.colors) ||
    !value.colors.every(isSharedColorProgress) ||
    typeof value.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    slug,
    name: value.name,
    thumbnail: value.thumbnail,
    percent: value.percent,
    colors: value.colors,
    updatedAt: value.updatedAt,
  };
}

function isSharedOverviewMaterial(value: unknown): value is SharedOverviewMaterial {
  if (!isRecord(value)) return false;

  return (
    typeof value.name === 'string' &&
    typeof value.hex === 'string' &&
    typeof value.total === 'number' &&
    Number.isFinite(value.total) &&
    value.total >= 0 &&
    typeof value.remaining === 'number' &&
    Number.isFinite(value.remaining) &&
    value.remaining >= 0 &&
    value.remaining <= value.total
  );
}

function isSharedOverviewPattern(
  value: unknown,
): value is SharedOverviewPattern {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.thumbnail === 'string' &&
    typeof value.percent === 'number' &&
    Number.isFinite(value.percent) &&
    value.percent >= 0 &&
    value.percent <= 100
  );
}

function parseSharedOverviewSummary(value: unknown): SharedOverviewSummary | null {
  if (!isRecord(value)) return null;

  if (
    typeof value.patternCount !== 'number' ||
    !Number.isInteger(value.patternCount) ||
    value.patternCount < 0 ||
    typeof value.beadsPlaced !== 'number' ||
    !Number.isInteger(value.beadsPlaced) ||
    value.beadsPlaced < 0 ||
    typeof value.beadsTotal !== 'number' ||
    !Number.isInteger(value.beadsTotal) ||
    value.beadsTotal < 0 ||
    value.beadsPlaced > value.beadsTotal ||
    typeof value.percent !== 'number' ||
    !Number.isFinite(value.percent) ||
    value.percent < 0 ||
    value.percent > 100 ||
    !Array.isArray(value.materials) ||
    !value.materials.every(isSharedOverviewMaterial) ||
    !Array.isArray(value.patterns) ||
    !value.patterns.every(isSharedOverviewPattern) ||
    typeof value.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    patternCount: value.patternCount,
    beadsPlaced: value.beadsPlaced,
    beadsTotal: value.beadsTotal,
    percent: value.percent,
    materials: value.materials,
    patterns: value.patterns,
    updatedAt: value.updatedAt,
  };
}

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

export async function fetchSharedPattern(
  slug: string,
): Promise<SharedPatternSummary | null> {
  const db = getSharedPatternsDb();
  const snapshot = await getDoc(doc(db, COLLECTION, slug));

  if (!snapshot.exists()) return null;

  return parseSharedPatternSummary(slug, snapshot.data());
}

export function buildOverviewSummary(
  patterns: Pattern[],
  palettesById: Map<string, Palette>,
): SharedOverviewSummary {
  const materials = aggregateColorTotals(patterns, palettesById);
  const beadsTotal = materials.reduce((sum, m) => sum + m.total, 0);
  const beadsPlaced =
    beadsTotal - materials.reduce((sum, m) => sum + m.incomplete, 0);

  return {
    patternCount: patterns.length,
    beadsPlaced,
    beadsTotal,
    percent: beadsTotal === 0 ? 100 : Math.round((beadsPlaced / beadsTotal) * 100),
    materials: materials.map((m) => ({
      name: m.name,
      hex: m.hex,
      total: m.total,
      remaining: m.incomplete,
    })),
    patterns: patterns.map((pattern) => ({
      id: pattern.id,
      name: pattern.name,
      thumbnail: pattern.thumbnail,
      percent: (() => {
        const palette = palettesById.get(pattern.paletteId);
        return palette ? completionPercent(pattern, palette) : 0;
      })(),
    })),
    updatedAt: new Date().toISOString(),
  };
}

export async function publishOverview(
  slug: string,
  patterns: Pattern[],
  palettesById: Map<string, Palette>,
): Promise<void> {
  const summary = buildOverviewSummary(patterns, palettesById);
  const db = getSharedPatternsDb();

  await setDoc(doc(db, OVERVIEW_COLLECTION, slug), summary);
}

export async function unpublishOverview(slug: string): Promise<void> {
  const db = getSharedPatternsDb();

  await deleteDoc(doc(db, OVERVIEW_COLLECTION, slug));
}

export async function fetchSharedOverview(
  slug: string,
): Promise<SharedOverviewSummary | null> {
  const db = getSharedPatternsDb();
  const snapshot = await getDoc(doc(db, OVERVIEW_COLLECTION, slug));

  if (!snapshot.exists()) return null;

  return parseSharedOverviewSummary(snapshot.data());
}