import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Palette } from '../../types/palette';
import { Pattern } from '../../types/pattern';

interface BeadArtDB extends DBSchema {
  palettes: {
    key: string;
    value: Palette;
  };
  patterns: {
    key: string;
    value: Pattern;
  };
}

const DB_NAME = 'beadart';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BeadArtDB>> | null = null;
let dbInstance: IDBPDatabase<BeadArtDB> | null = null;

export function getDb(): Promise<IDBPDatabase<BeadArtDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BeadArtDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('palettes')) {
          db.createObjectStore('palettes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('patterns')) {
          db.createObjectStore('patterns', { keyPath: 'id' });
        }
      },
    }).then((db) => {
      dbInstance = db;
      return db;
    });
  }
  return dbPromise;
}

export async function resetDbForTests(): Promise<void> {
  dbInstance?.close();
  dbInstance = null;
  dbPromise = null;

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn(`Database "${DB_NAME}" deletion is blocked.`);
      resolve();
    };
  });
}
