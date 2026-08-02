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

export function resetDbForTests(): void {
  // Close the underlying connection synchronously before dropping our
  // references. `indexedDB.deleteDatabase` blocks indefinitely while any
  // connection to the database remains open, which is exactly what tests
  // do in `afterEach` — so without this close(), test cleanup hangs.
  dbInstance?.close();
  dbInstance = null;
  dbPromise = null;
}
