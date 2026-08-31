import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';

import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { isSharingConfigured } from '../sharing/config';

function config(): FirebaseOptions {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

function getFirebaseAuth() {
  if (!isSharingConfigured()) {
    throw new Error(
      'Firebase is not configured: set the VITE_FIREBASE_* environment variables.',
    );
  }

  const app = getApps()[0] ?? initializeApp(config());

  return getAuth(app);
}

export function getCurrentUser(): User | null {
  try {
    return getFirebaseAuth().currentUser;
  } catch {
    return null;
  }
}

export function subscribeToAuthState(
  callback: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export async function createAccount(
  email: string,
  password: string,
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    email,
    password,
  );

  return credential.user;
}

export async function signIn(
  email: string,
  password: string,
): Promise<User> {
  const credential = await signInWithEmailAndPassword(
    getFirebaseAuth(),
    email,
    password,
  );

  return credential.user;
}

export async function logOut(): Promise<void> {
  await signOut(getFirebaseAuth());
}