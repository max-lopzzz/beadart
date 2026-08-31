import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
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

/**
 * Upload all local patterns and palettes to the authenticated account.
 */
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

/**
 * Sync one pattern to Firestore.
 */
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

/**
 * Download all account data once.
 */
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

/**
 * Synchronize local and cloud account data.
 *
 * - Local-only data is uploaded.
 * - Cloud-only data is downloaded.
 * - When the same item exists in both places, the newest updatedAt wins.
 */
export async function syncLocalDataWithAccount(): Promise<void> {
  const user = requireUser();

  const { listPatterns } = await import('../storage/patternsRepo');
  const { listPalettes } = await import('../storage/palettesRepo');
  const { savePattern } = await import('../storage/patternsRepo');
  const { savePalette } = await import('../storage/palettesRepo');

  const [localPatterns, localPalettes, cloudData] = await Promise.all([
    listPatterns(),
    listPalettes(),
    downloadAccountData(),
  ]);

  const localPatternsById = new Map(
    localPatterns.map((pattern) => [pattern.id, pattern]),
  );

  const cloudPatternsById = new Map(
    cloudData.patterns.map((pattern) => [pattern.id, pattern]),
  );

  const localPalettesById = new Map(
    localPalettes.map((palette) => [palette.id, palette]),
  );

  const cloudPalettesById = new Map(
    cloudData.palettes.map((palette) => [palette.id, palette]),
  );

  const db = getSharedPatternsDb();

  const patternWrites: Promise<unknown>[] = [];
  const paletteWrites: Promise<unknown>[] = [];

  const allPatternIds = new Set([
    ...localPatternsById.keys(),
    ...cloudPatternsById.keys(),
  ]);

  for (const id of allPatternIds) {
    const local = localPatternsById.get(id);
    const cloud = cloudPatternsById.get(id);

    if (local && !cloud) {
      // Only exists locally → upload it.
      patternWrites.push(
        setDoc(
          doc(db, 'users', user.uid, 'patterns', id),
          patternToFirestore(local),
        ),
      );
      continue;
    }

    if (!local && cloud) {
      // Only exists in cloud → download it.
      await savePattern(cloud);
      continue;
    }

    if (!local || !cloud) {
      continue;
    }

    // Exists in both places → newest version wins.
    const localTime = Date.parse(local.updatedAt);
    const cloudTime = Date.parse(cloud.updatedAt);

    if (localTime >= cloudTime) {
      patternWrites.push(
        setDoc(
          doc(db, 'users', user.uid, 'patterns', id),
          patternToFirestore(local),
        ),
      );
    } else {
      await savePattern(cloud);
    }
  }

  const allPaletteIds = new Set([
    ...localPalettesById.keys(),
    ...cloudPalettesById.keys(),
  ]);

  for (const id of allPaletteIds) {
    const local = localPalettesById.get(id);
    const cloud = cloudPalettesById.get(id);

    if (local && !cloud) {
      paletteWrites.push(
        setDoc(
          doc(db, 'users', user.uid, 'palettes', id),
          local,
        ),
      );
      continue;
    }

    if (!local && cloud) {
      await savePalette(cloud);
      continue;
    }

    if (!local || !cloud) {
      continue;
    }

    // Palettes currently don't have updatedAt, so keep the cloud
    // version when both exist.
    await savePalette(cloud);
  }

  await Promise.all([...patternWrites, ...paletteWrites]);
  
  window.dispatchEvent(new Event('beadart-patterns-updated'));
  window.dispatchEvent(new Event('beadart-palettes-updated'));
}

/**
 * Upload local data when creating a new account.
 */
export async function migrateLocalDataToAccount(): Promise<void> {
  await uploadLocalData();
}

/**
 * Import all cloud data into IndexedDB.
 */
export async function importAccountDataToLocal(): Promise<void> {
  const { patterns, palettes } = await downloadAccountData();

  const { savePattern } = await import('../storage/patternsRepo');
  const { savePalette } = await import('../storage/palettesRepo');

  await Promise.all([
    ...patterns.map((pattern) => savePattern(pattern)),
    ...palettes.map((palette) => savePalette(palette)),
  ]);
}

/**
 * Listen for real-time pattern changes in Firestore.
 *
 * Every remote change is mirrored into local IndexedDB and then a
 * browser event is dispatched so React hooks can refresh themselves.
 */
export function subscribeToAccountPatterns(
  onChange?: () => void,
  onError?: (error: Error) => void,
): () => void {
  const user = getCurrentUser();

  if (!user) {
    return () => {};
  }

  return onSnapshot(
    patternsCollection(user.uid),
    async (snapshot) => {
      const { savePattern, deletePattern } =
        await import('../storage/patternsRepo');

      await Promise.all(
        snapshot.docChanges().map(async (change) => {
          if (change.type === 'removed') {
            await deletePattern(change.doc.id);
            return;
          }

          const pattern = patternFromFirestore(
            change.doc.data() as FirestorePattern,
          );

          await savePattern(pattern);
        }),
      );

      window.dispatchEvent(
        new Event('beadart-patterns-updated'),
      );

      onChange?.();
    },
    (error) => {
      console.error(
        '[accountRepo] Pattern subscription failed:',
        error,
      );

      onError?.(error);
    },
  );
}

/**
 * Listen for real-time palette changes in Firestore.
 */
export function subscribeToAccountPalettes(
  onChange?: () => void,
  onError?: (error: Error) => void,
): () => void {
  const user = getCurrentUser();

  if (!user) {
    return () => {};
  }

  return onSnapshot(
    palettesCollection(user.uid),
    async (snapshot) => {
      const { savePalette, deletePalette } =
        await import('../storage/palettesRepo');

      await Promise.all(
        snapshot.docChanges().map(async (change) => {
          if (change.type === 'removed') {
            await deletePalette(change.doc.id);
            return;
          }

          const palette = change.doc.data() as Palette;
          await savePalette(palette);
        }),
      );

      window.dispatchEvent(new Event('beadart-palettes-updated'));

      onChange?.();
    },
    (error) => {
      console.error(
        '[accountRepo] Palette subscription failed:',
        error,
      );

      onError?.(error);
    },
  );
}