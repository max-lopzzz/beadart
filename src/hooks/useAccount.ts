import { useEffect, useState } from 'react';

import {
  createAccount,
  getCurrentUser,
  logOut,
  signIn,
  subscribeToAuthState,
} from '../lib/account/auth';

import {
  migrateLocalDataToAccount,
  importAccountDataToLocal,
  subscribeToAccountPatterns,
  subscribeToAccountPalettes,
} from '../lib/account/accountRepo';

/**
 * - 'offline': no account is signed in; data only lives on this device.
 * - 'connecting': signed in, waiting for the first snapshot from Firestore.
 * - 'live': both the pattern and palette listeners are attached and
 *   healthy — changes on any device will appear here in real time.
 * - 'error': a listener reported an error (e.g. the device lost network,
 *   or Firestore rejected a read). Sync has stopped until reconnected.
 */
export type SyncStatus = 'offline' | 'connecting' | 'live' | 'error';

export function useAccount() {
  const [user, setUser] = useState(() => getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');

  useEffect(() => {
    return subscribeToAuthState((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('connecting');

    let patternsReady = false;
    let palettesReady = false;

    const handlePatternsReady = () => {
      patternsReady = true;
      // A successful snapshot means the listener is healthy again, even
      // if a previous snapshot on either collection had errored out.
      setSyncStatus(palettesReady ? 'live' : 'connecting');
    };

    const handlePalettesReady = () => {
      palettesReady = true;
      setSyncStatus(patternsReady ? 'live' : 'connecting');
    };

    const handleError = () => {
      setSyncStatus('error');
    };

    const unsubscribePatterns = subscribeToAccountPatterns(
      handlePatternsReady,
      handleError,
    );

    const unsubscribePalettes = subscribeToAccountPalettes(
      handlePalettesReady,
      handleError,
    );

    return () => {
      unsubscribePatterns();
      unsubscribePalettes();
    };
  }, [user]);

  const register = async (email: string, password: string) => {
    const createdUser = await createAccount(email, password);

    // The user's existing local data becomes their initial cloud data.
    await migrateLocalDataToAccount();

    return createdUser;
  };

  const login = async (email: string, password: string) => {
    const signedInUser = await signIn(email, password);

    // Download the account's existing cloud data first.
    await importAccountDataToLocal();

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