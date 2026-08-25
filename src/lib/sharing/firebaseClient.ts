import { initializeApp, getApps, FirebaseOptions } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { isSharingConfigured } from './config';

let firestore: Firestore | null = null;

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

export function getSharedPatternsDb(): Firestore {
  if (!isSharingConfigured()) {
    throw new Error(
      'Sharing is not configured: set VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID (see README).',
    );
  }
  if (!firestore) {
    const app = getApps()[0] ?? initializeApp(config());
    firestore = getFirestore(app);
  }
  return firestore;
}
