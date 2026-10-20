import { useCallback, useEffect, useState } from 'react';
import type { Game, Stats } from '../types';
import { getInProgressGame, getRecentGames, getStats } from '../services/statsService';

interface UseStatsResult {
  stats: Stats | null;
  resumeGame: Game | null;
  recentGames: Game[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

export function useStats(): UseStatsResult {
  const [stats, setStats] = useState<Stats | null>(null);
  const [resumeGame, setResumeGame] = useState<Game | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    Promise.all([getStats(), getInProgressGame(), getRecentGames(5)])
      .then(([s, g, r]) => {
        if (cancelled) return;
        setStats(s);
        setResumeGame(g);
        setRecentGames(r);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your dashboard. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { stats, resumeGame, recentGames, isLoading, error, reload };
}
