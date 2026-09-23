import { useState, useEffect, useCallback } from 'react';
import type { MonitoredFilterStats } from '@/types/domain/gpac';
import { gpacService } from '@/services/gpacService';
import { SubscriptionType } from '@/types/communication/subscription';
import { filterStatsEqual } from '../../utils/filterStatsEqual';
import type { FilterStatsResult } from './types';

export function useFilterStatsLive(
  filterId: number | undefined,
  enabled = true,
  interval = 1000,
): FilterStatsResult {
  const [stats, setStats] = useState<MonitoredFilterStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdate = useCallback((newStats: MonitoredFilterStats) => {
    setStats((prev) => (filterStatsEqual(prev, newStats) ? prev : newStats));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (filterId === undefined || !enabled || !gpacService.isConnected()) {
      setStats(null);
      setIsLoading(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    setStats(null);
    setIsLoading(true);

    const setup = async () => {
      try {
        const unsub = await gpacService.subscribe(
          {
            type: SubscriptionType.FILTER_STATS,
            filterIdx: filterId,
            interval,
          },
          (result) => {
            if (result.data && isMounted) {
              handleUpdate(result.data as MonitoredFilterStats);
            }
          },
        );
        if (isMounted) {
          unsubscribe = unsub;
        } else {
          unsub();
        }
      } catch {
        if (isMounted) {
          setStats(null);
          setIsLoading(false);
        }
      }
    };

    setup();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [filterId, enabled, interval, handleUpdate]);

  return { stats, isLoading, isSubscribed: !!stats };
}
