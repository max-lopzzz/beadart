import { describe, it, expect, vi, beforeEach } from 'vitest';

import { Pattern } from '../../types/pattern';
import { Palette } from '../../types/palette';

type SnapshotHandler = (snapshot: unknown) => void | Promise<void>;
type ErrorHandler = (error: Error) => void;

// Captures the handlers passed to onSnapshot so tests can drive them
// manually, as if a change had arrived from Firestore.
let capturedOnNext: SnapshotHandler | null = null;
let capturedOnError: ErrorHandler | null = null;

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...segments) => ({ path: segments.join('/') })),
  doc: vi.fn((_db, ...segments) => ({ path: segments.join('/') })),
  setDoc: vi.fn(),
  getDocs: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(
    (_query, onNext: SnapshotHandler, onError: ErrorHandler) => {
      capturedOnNext = onNext;
      capturedOnError = onError;
      return vi.fn(); // unsubscribe
    },
  ),
}));

vi.mock('../sharing/firebaseClient', () => ({
  getSharedPatternsDb: vi.fn(() => ({ mocked: true })),
}));

vi.mock('./auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('../storage/patternsRepo', () => ({
  savePattern: vi.fn(),
  deletePattern: vi.fn(),
}));

vi.mock('../storage/palettesRepo', () => ({
  savePalette: vi.fn(),
  deletePalette: vi.fn(),
}));

import { setDoc, deleteDoc } from 'firebase/firestore';
import { getCurrentUser } from './auth';
import { savePattern, deletePattern } from '../storage/patternsRepo';
import { savePalette, deletePalette } from '../storage/palettesRepo';

import {
  syncPattern,
  syncPalette,
  deleteSyncedPattern,
  deleteSyncedPalette,
  subscribeToAccountPatterns,
  subscribeToAccountPalettes,
} from './accountRepo';

const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedSetDoc = vi.mocked(setDoc);
const mockedDeleteDoc = vi.mocked(deleteDoc);
const mockedSavePattern = vi.mocked(savePattern);
const mockedDeletePattern = vi.mocked(deletePattern);
const mockedSavePalette = vi.mocked(savePalette);
const mockedDeletePalette = vi.mocked(deletePalette);

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: 'pattern-1',
    name: 'Test Pattern',
    createdAt: '2026-08-02T00:00:00.000Z',
    rows: 2,
    cols: 2,
    cellColors: [
      ['Red', 'Red'],
      ['Blue', 'Blue'],
    ],
    paletteId: 'default-bead-palette',
    completedColors: [],
    thumbnail: '',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const palette: Palette = {
  id: 'default-bead-palette',
  name: 'Default',
  isBuiltIn: true,
  colors: [
    { name: 'Red', hex: '#ff0000' },
    { name: 'Blue', hex: '#0000ff' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  capturedOnNext = null;
  capturedOnError = null;
});

describe('syncPattern / syncPalette', () => {
  it('does nothing when no user is signed in', async () => {
    mockedGetCurrentUser.mockReturnValue(null);

    await syncPattern(makePattern());
    await syncPalette(palette);

    expect(mockedSetDoc).not.toHaveBeenCalled();
  });

  it('uploads the pattern with cellColors flattened for Firestore', async () => {
    mockedGetCurrentUser.mockReturnValue({ uid: 'user-1' } as never);

    await syncPattern(makePattern());

    expect(mockedSetDoc).toHaveBeenCalledTimes(1);

    const [, payload] = mockedSetDoc.mock.calls[0];
    expect((payload as { cellColors: unknown }).cellColors).toEqual([
      'Red',
      'Red',
      'Blue',
      'Blue',
    ]);
  });

  it('deletes the remote pattern and palette when signed in', async () => {
    mockedGetCurrentUser.mockReturnValue({ uid: 'user-1' } as never);

    await deleteSyncedPattern('pattern-1');
    await deleteSyncedPalette('palette-1');

    expect(mockedDeleteDoc).toHaveBeenCalledTimes(2);
  });
});

describe('subscribeToAccountPatterns', () => {
  it('returns a no-op unsubscribe when signed out', () => {
    mockedGetCurrentUser.mockReturnValue(null);

    const unsubscribe = subscribeToAccountPatterns();

    expect(capturedOnNext).toBeNull();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('mirrors remote changes into local storage and notifies listeners', async () => {
    mockedGetCurrentUser.mockReturnValue({ uid: 'user-1' } as never);

    const onChange = vi.fn();
    const eventListener = vi.fn();
    window.addEventListener('beadart-patterns-updated', eventListener);

    subscribeToAccountPatterns(onChange);
    expect(capturedOnNext).not.toBeNull();

    await capturedOnNext!({
      docChanges: () => [
        {
          type: 'added',
          doc: {
            id: 'pattern-1',
            data: () => ({
              ...makePattern(),
              cellColors: ['Red', 'Red', 'Blue', 'Blue'],
            }),
          },
        },
        {
          type: 'removed',
          doc: { id: 'pattern-2', data: () => ({}) },
        },
      ],
    });

    expect(mockedSavePattern).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pattern-1',
        cellColors: [
          ['Red', 'Red'],
          ['Blue', 'Blue'],
        ],
      }),
    );

    expect(mockedDeletePattern).toHaveBeenCalledWith('pattern-2');
    expect(eventListener).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);

    window.removeEventListener('beadart-patterns-updated', eventListener);
  });

  it('reports listener errors through onError without throwing', () => {
    mockedGetCurrentUser.mockReturnValue({ uid: 'user-1' } as never);

    const onError = vi.fn();
    subscribeToAccountPatterns(undefined, onError);

    const error = new Error('permission-denied');
    capturedOnError!(error);

    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe('subscribeToAccountPalettes', () => {
  it('mirrors remote palette changes into local storage', async () => {
    mockedGetCurrentUser.mockReturnValue({ uid: 'user-1' } as never);

    const onChange = vi.fn();
    subscribeToAccountPalettes(onChange);

    await capturedOnNext!({
      docChanges: () => [
        {
          type: 'added',
          doc: { id: 'palette-1', data: () => palette },
        },
        {
          type: 'removed',
          doc: { id: 'palette-2', data: () => ({}) },
        },
      ],
    });

    expect(mockedSavePalette).toHaveBeenCalledWith(palette);
    expect(mockedDeletePalette).toHaveBeenCalledWith('palette-2');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reports listener errors through onError', () => {
    mockedGetCurrentUser.mockReturnValue({ uid: 'user-1' } as never);

    const onError = vi.fn();
    subscribeToAccountPalettes(undefined, onError);

    const error = new Error('unavailable');
    capturedOnError!(error);

    expect(onError).toHaveBeenCalledWith(error);
  });
});
