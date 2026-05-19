'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchPairings, type Pairing } from '@/lib/api';

interface CurrentPairingContextValue {
  currentPairingId: string;
  currentPairing: Pairing | null;
  pairings: Pairing[];
  isLoading: boolean;
  setCurrentPairingId: (id: string) => void;
  refreshPairings: () => Promise<void>;
}

const CurrentPairingContext = createContext<CurrentPairingContextValue | null>(null);

const STORAGE_KEY = 'currentPairingId';

export function CurrentPairingProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [currentPairingId, setCurrentPairingIdState] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const resolveInitialId = useCallback(
    (loadedPairings: Pairing[]) => {
      if (loadedPairings.length === 0) return '';

      const queryId = searchParams.get('pairingId');
      if (queryId && loadedPairings.some((p) => p.id === queryId)) {
        return queryId;
      }

      const storedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (storedId && loadedPairings.some((p) => p.id === storedId)) {
        return storedId;
      }

      return loadedPairings[0].id;
    },
    [searchParams]
  );

  useEffect(() => {
    fetchPairings()
      .then((loaded) => {
        setPairings(loaded);
        const initialId = resolveInitialId(loaded);
        if (initialId) {
          setCurrentPairingIdState(initialId);
          localStorage.setItem(STORAGE_KEY, initialId);
        }
      })
      .catch(() => {
        setPairings([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [resolveInitialId]);

  const setCurrentPairingId = useCallback((id: string) => {
    setCurrentPairingIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const refreshPairings = useCallback(async () => {
    const loaded = await fetchPairings();
    setPairings(loaded);
    if (currentPairingId && !loaded.some((p) => p.id === currentPairingId)) {
      const fallbackId = loaded[0]?.id || '';
      setCurrentPairingIdState(fallbackId);
      if (fallbackId) localStorage.setItem(STORAGE_KEY, fallbackId);
    }
  }, [currentPairingId]);

  const currentPairing = pairings.find((p) => p.id === currentPairingId) || pairings[0] || null;

  const effectivePairingId = currentPairing?.id || '';

  return (
    <CurrentPairingContext.Provider
      value={{
        currentPairingId: effectivePairingId,
        currentPairing,
        pairings,
        isLoading,
        setCurrentPairingId,
        refreshPairings,
      }}
    >
      {children}
    </CurrentPairingContext.Provider>
  );
}

export function useCurrentPairing() {
  const ctx = useContext(CurrentPairingContext);
  if (!ctx) throw new Error('useCurrentPairing must be used within CurrentPairingProvider');
  return ctx;
}
