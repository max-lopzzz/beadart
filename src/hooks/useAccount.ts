import { useEffect, useRef, useState } from 'react';

import {
  createAccount,
  getCurrentUser,
  logOut,
  signIn,
  subscribeToAuthState,
} from '../lib/account/auth';

import {
  migrateLocalDataToAccount,
  syncLocalDataWithAccount,
  subscribeToAccountPatterns,
  subscribeToAccountPalettes,
} from '../lib/account/accountRepo';

export type SyncStatus =
  | 'offline'
  | 'connecting'
  | 'live'
  | 'error';

export type AccountState = ReturnType<typeof useAccount>;

export function useAccount() {
  const [user, setUser] = useState(() => getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] =
    useState<SyncStatus>('offline');

  const patternsReadyRef = useRef(false);
  const palettesReadyRef = useRef(false);

  useEffect(() => {
    return subscribeToAuthState((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      patternsReadyRef.current = false;
      palettesReadyRef.current = false;
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('connecting');

    patternsReadyRef.current = false;
    palettesReadyRef.current = false;

    const handlePatternsReady = () => {
      patternsReadyRef.current = true;

      setSyncStatus(
        palettesReadyRef.current ? 'live' : 'connecting',
      );
    };

    const handlePalettesReady = () => {
      palettesReadyRef.current = true;

      setSyncStatus(
        patternsReadyRef.current ? 'live' : 'connecting',
      );
    };

    const handleError = () => {
      setSyncStatus('error');
    };

    const unsubscribePatterns =
      subscribeToAccountPatterns(
        handlePatternsReady,
        handleError,
      );

    const unsubscribePalettes =
      subscribeToAccountPalettes(
        handlePalettesReady,
        handleError,
      );

    return () => {
      unsubscribePatterns();
      unsubscribePalettes();
    };
  }, [user]);

  const register = async (
    email: string,
    password: string,
  ) => {
    const createdUser = await createAccount(
      email,
      password,
    );

    await migrateLocalDataToAccount();

    return createdUser;
  };

  const login = async (
    email: string,
    password: string,
  ) => {
    const signedInUser = await signIn(
      email,
      password,
    );

    await syncLocalDataWithAccount();

    return signedInUser;
  };

  const logout = async () => {
    await logOut();
  };

  return {
    user,
    loading,
    isAuthenticated: user !== null,
    syncStatus,
    register,
    login,
    logout,
  };
}
