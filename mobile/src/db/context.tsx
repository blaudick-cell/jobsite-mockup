// DbProvider — in-memory `db` mirrored to AsyncStorage. Mental model mirrors
// the web mockup's `db` + `setDb` prop pair; here we use Context to avoid
// prop-drilling across the file-based router.
//
// Storage strategy:
//   - On mount, hydrate from AsyncStorage. If absent or malformed, fall back to
//     SEED.
//   - Every setDb call writes the new db back to AsyncStorage (fire-and-forget).
//   - We do NOT debounce writes — typical mutations are infrequent (clock in,
//     log a load) and the payload stays small for the mockup.
//
// TODO(realtime): no cross-device sync. Web side has a localStorage `storage`
// event listener for cross-tab sync; mobile would need a backend or
// WatermelonDB/Replicache for true real-time. Out of scope for this pass.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { SEED } from '@/data/seed';
import type { Db } from '@/data/types';

const STORAGE_KEY = 'jse-hauler:db:v1';

export type DbUpdater = Db | ((prev: Db) => Db);

interface DbContextValue {
  db: Db;
  setDb: (updater: DbUpdater) => void;
  resetDb: () => Promise<void>;
  hydrated: boolean;
}

const DbContext = createContext<DbContextValue | null>(null);

export function DbProvider({ children }: { children: React.ReactNode }) {
  const [db, setDbState] = useState<Db>(SEED);
  const [hydrated, setHydrated] = useState(false);
  const dbRef = useRef<Db>(SEED);

  // Hydrate from AsyncStorage on first mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as Db;
          // Light shape sanity check — if a critical collection is missing we
          // discard and fall back to SEED. Cheaper than a full schema check.
          if (
            parsed &&
            Array.isArray(parsed.projects) &&
            Array.isArray(parsed.drivers) &&
            Array.isArray(parsed.trucks)
          ) {
            dbRef.current = parsed;
            setDbState(parsed);
          }
        }
      } catch {
        // Ignore — stick with SEED.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setDb = useCallback((updater: DbUpdater) => {
    setDbState((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: Db) => Db)(prev) : updater;
      dbRef.current = next;
      // Fire-and-forget persistence.
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {
        // TODO(persistence): surface to user if storage is full / unavailable.
      });
      return next;
    });
  }, []);

  const resetDb = useCallback(async () => {
    dbRef.current = SEED;
    setDbState(SEED);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore.
    }
  }, []);

  const value = useMemo<DbContextValue>(
    () => ({ db, setDb, resetDb, hydrated }),
    [db, setDb, resetDb, hydrated],
  );

  return <DbContext.Provider value={value}>{children}</DbContext.Provider>;
}

export function useDb(): DbContextValue {
  const ctx = useContext(DbContext);
  if (!ctx) {
    throw new Error('useDb() must be used inside <DbProvider>');
  }
  return ctx;
}
