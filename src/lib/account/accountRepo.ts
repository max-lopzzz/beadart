import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';

import { getSharedPatternsDb } from '../sharing/firebaseClient';
import { getCurrentUser } from './auth';

import { Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';

function requireUser() {
  const user = getCurrentUser();

  if (!user) {
    throw new Error('No authenticated user.');
  }

  return user;
}

function patternsCollection(uid: string) {
  return collection(getSharedPatternsDb(), 'users', uid, 'patterns');
}

function palettesCollection(uid: string) {
  return collection(getSharedPatternsDb(), 'users', uid, 'palettes');
}

/**
 * Firestore does not support nested arrays.
 *
 * Pattern.cellColors is string[][] locally, so we flatten it before
 * storing it in Firestore. rows/cols allow us to reconstruct the
 * original matrix when downloading the pattern.
 */
type FirestorePattern = Omit<Pattern, 'cellColors'> & {
  cellColors: string[];
};

function patternToFirestore(pattern: Pattern): FirestorePattern {
  return {
    ...pattern,
    cellColors: pattern.cellColors.flat(),
  };
}

function patternFromFirestore(data: FirestorePattern): Pattern {
  const { cellColors, rows, cols, ...rest } = data;

  const matrix: string[][] = [];

  for (let row = 0; row < rows; row += 1) {
    matrix.push(cellColors.slice(row * cols, (row + 1) * cols));
  }

  return {
    ...rest,
    rows,
    cols,
    cellColors: matrix,
  };
}

export async function uploadLocalData(): Promise<void> {
  const user = requireUser();

  const { listPatterns } = await import('../storage/patternsRepo');
  const { listPalettes } = await import('../storage/palettesRepo');

  const patterns = await listPatterns();
  const palettes = await listPalettes();

  const db = getSharedPatternsDb();

  await Promise.all([
    ...patterns.map((pattern) =>
      setDoc(
        doc(db, 'users', user.uid, 'patterns', pattern.id),
        patternToFirestore(pattern),
      ),
    ),

    ...palettes.map((palette) =>
      setDoc(
        doc(db, 'users', user.uid, 'palettes', palette.id),
        palette,
      ),
    ),
  ]);
}

export async function downloadAccountData(): Promise<{
  patterns: Pattern[];
  palettes: Palette[];
}> {
  const user = requireUser();

  const [patternsSnapshot, palettesSnapshot] = await Promise.all([
    getDocs(patternsCollection(user.uid)),
    getDocs(palettesCollection(user.uid)),
  ]);

  return {
    patterns: patternsSnapshot.docs.map((snapshot) =>
      patternFromFirestore(snapshot.data() as FirestorePattern),
    ),

    palettes: palettesSnapshot.docs.map(
      (snapshot) => snapshot.data() as Palette,
    ),
  };
}

export async function syncPattern(pattern: Pattern): Promise<void> {
  const user = getCurrentUser();

  if (!user) {
    return;
  }

  const db = getSharedPatternsDb();

  await setDoc(
    doc(db, 'users', user.uid, 'patterns', pattern.id),
    patternToFirestore(pattern),
  );
}

export async function deleteSyncedPattern(
  patternId: string,
): Promise<void> {
  const user = getCurrentUser();

  if (!user) {
    return;
  }

  const db = getSharedPatternsDb();

  await deleteDoc(
    doc(db, 'users', user.uid, 'patterns', patternId),
  );
}

export async function syncPalette(palette: Palette): Promise<void> {
  const user = getCurrentUser();

  if (!user) {
    return;
  }

  const db = getSharedPatternsDb();

  await setDoc(
    doc(db, 'users', user.uid, 'palettes', palette.id),
    palette,
  );
}

export async function deleteSyncedPalette(
  paletteId: string,
): Promise<void> {
  const user = getCurrentUser();

  if (!user) {
    return;
  }

  const db = getSharedPatternsDb();

  await deleteDoc(
    doc(db, 'users', user.uid, 'palettes', paletteId),
  );
}

export async function migrateLocalDataToAccount(): Promise<void> {
  await uploadLocalData();
}

export async function importAccountDataToLocal(): Promise<void> {
  const { patterns, palettes } = await downloadAccountData();

  const { savePattern } = await import('../storage/patternsRepo');
  const { savePalette } = await import('../storage/palettesRepo');

  await Promise.all([
    ...patterns.map((pattern) => savePattern(pattern)),
    ...palettes.map((palette) => savePalette(palette)),
  ]);
}
