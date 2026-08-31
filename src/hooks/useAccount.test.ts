import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

type AuthCallback = (user: { uid: string; email: string } | null) => void;

let authCallback: AuthCallback | null = null;
let patternsOnChange: (() => void) | null = null;
let patternsOnError: ((error: Error) => void) | null = null;
let palettesOnChange: (() => void) | null = null;
let palettesOnError: ((error: Error) => void) | null = null;

const mockUser = { uid: 'user-1', email: 'max@example.com' };

vi.mock('../lib/account/auth', () => ({
  getCurrentUser: vi.fn(() => null),
  createAccount: vi.fn(),
  signIn: vi.fn(),
  logOut: vi.fn(),
  subscribeToAuthState: vi.fn((callback: AuthCallback) => {
    authCallback = callback;
    return () => {
      authCallback = null;
    };
  }),
}));

vi.mock('../lib/account/accountRepo', () => ({
  migrateLocalDataToAccount: vi.fn(),
  importAccountDataToLocal: vi.fn(),
  subscribeToAccountPatterns: vi.fn(
    (onChange?: () => void, onError?: (error: Error) => void) => {
      patternsOnChange = onChange ?? null;
      patternsOnError = onError ?? null;
      return vi.fn();
    },
  ),
  subscribeToAccountPalettes: vi.fn(
    (onChange?: () => void, onError?: (error: Error) => void) => {
      palettesOnChange = onChange ?? null;
      palettesOnError = onError ?? null;
      return vi.fn();
    },
  ),
}));

import { useAccount } from './useAccount';

beforeEach(() => {
  vi.clearAllMocks();
  authCallback = null;
  patternsOnChange = null;
  patternsOnError = null;
  palettesOnChange = null;
  palettesOnError = null;
});

describe('useAccount syncStatus', () => {
  it('starts offline when signed out', async () => {
    const { result } = renderHook(() => useAccount());

    act(() => {
      authCallback?.(null);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.syncStatus).toBe('offline');
  });

  it('goes connecting -> live once both listeners report a snapshot', async () => {
    const { result } = renderHook(() => useAccount());

    act(() => {
      authCallback?.(mockUser);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.syncStatus).toBe('connecting');

    act(() => {
      patternsOnChange?.();
    });
    expect(result.current.syncStatus).toBe('connecting');

    act(() => {
      palettesOnChange?.();
    });
    expect(result.current.syncStatus).toBe('live');
  });

  it('flips to error if either listener fails, and recovers on the next snapshot', async () => {
    const { result } = renderHook(() => useAccount());

    act(() => {
      authCallback?.(mockUser);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      patternsOnChange?.();
      palettesOnChange?.();
    });
    expect(result.current.syncStatus).toBe('live');

    act(() => {
      patternsOnError?.(new Error('offline'));
    });
    expect(result.current.syncStatus).toBe('error');

    act(() => {
      patternsOnChange?.();
    });
    expect(result.current.syncStatus).toBe('live');
  });

  it('also flips to error when the palette listener fails', async () => {
    const { result } = renderHook(() => useAccount());

    act(() => {
      authCallback?.(mockUser);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      patternsOnChange?.();
      palettesOnChange?.();
    });
    expect(result.current.syncStatus).toBe('live');

    act(() => {
      palettesOnError?.(new Error('unavailable'));
    });
    expect(result.current.syncStatus).toBe('error');
  });

  it('drops back to offline after signing out', async () => {
    const { result } = renderHook(() => useAccount());

    act(() => {
      authCallback?.(mockUser);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      patternsOnChange?.();
      palettesOnChange?.();
    });
    expect(result.current.syncStatus).toBe('live');

    act(() => {
      authCallback?.(null);
    });
    expect(result.current.syncStatus).toBe('offline');
  });
});
