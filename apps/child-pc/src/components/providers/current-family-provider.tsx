'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchFamilies, type Family } from '@/lib/api';

interface CurrentFamilyContextValue {
  currentFamilyId: string;
  currentFamily: Family | null;
  families: Family[];
  isLoading: boolean;
  setCurrentFamilyId: (id: string) => void;
  refreshFamilies: () => Promise<void>;
}

const CurrentFamilyContext = createContext<CurrentFamilyContextValue | null>(null);

const STORAGE_KEY = 'currentFamilyId';

export function CurrentFamilyProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [families, setFamilies] = useState<Family[]>([]);
  const [currentFamilyId, setCurrentFamilyIdState] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const resolveInitialId = useCallback(
    (loadedFamilies: Family[]) => {
      if (loadedFamilies.length === 0) return '';

      const queryId = searchParams.get('familyId');
      if (queryId && loadedFamilies.some((f) => f.id === queryId)) {
        return queryId;
      }

      const storedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (storedId && loadedFamilies.some((f) => f.id === storedId)) {
        return storedId;
      }

      return loadedFamilies[0].id;
    },
    [searchParams]
  );

  useEffect(() => {
    fetchFamilies()
      .then((loaded) => {
        setFamilies(loaded);
        const initialId = resolveInitialId(loaded);
        if (initialId) {
          setCurrentFamilyIdState(initialId);
          localStorage.setItem(STORAGE_KEY, initialId);
        }
      })
      .catch(() => {
        setFamilies([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [resolveInitialId]);

  const setCurrentFamilyId = useCallback((id: string) => {
    setCurrentFamilyIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const refreshFamilies = useCallback(async () => {
    const loaded = await fetchFamilies();
    setFamilies(loaded);
    if (currentFamilyId && !loaded.some((f) => f.id === currentFamilyId)) {
      const fallbackId = loaded[0]?.id || '';
      setCurrentFamilyIdState(fallbackId);
      if (fallbackId) localStorage.setItem(STORAGE_KEY, fallbackId);
    }
  }, [currentFamilyId]);

  const currentFamily = families.find((f) => f.id === currentFamilyId) || families[0] || null;

  const effectiveFamilyId = currentFamily?.id || '';

  return (
    <CurrentFamilyContext.Provider
      value={{
        currentFamilyId: effectiveFamilyId,
        currentFamily,
        families,
        isLoading,
        setCurrentFamilyId,
        refreshFamilies,
      }}
    >
      {children}
    </CurrentFamilyContext.Provider>
  );
}

export function useCurrentFamily() {
  const ctx = useContext(CurrentFamilyContext);
  if (!ctx) throw new Error('useCurrentFamily must be used within CurrentFamilyProvider');
  return ctx;
}
