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
} from '../lib/account/accountRepo';

export function useAccount() {
  const [user, setUser] = useState(() => getCurrentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeToAuthState((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  const register = async (email: string, password: string) => {
    const createdUser = await createAccount(email, password);

    // The user's existing local data becomes their initial cloud data.
    await migrateLocalDataToAccount();

    return createdUser;
  };

  const login = async (email: string, password: string) => {
    const signedInUser = await signIn(email, password);

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
    register,
    login,
    logout,
  };
}