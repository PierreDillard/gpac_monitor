import { useState, useEffect, useCallback, useRef } from 'react';
import type { CPUStats } from '@/types/domain/system';
import { gpacService } from '@/services/gpacService';
import { SubscriptionType } from '@/types/communication/subscription';
import { useServiceReady } from '@/shared/hooks/connection/useServiceReady';
import type { CPUStatsResult } from './useCPUStatsHistory';

export function useCPUStatsLive(
  enabled: boolean,
  interval: number,
): CPUStatsResult {
  const [stats, setStats] = useState<CPUStats[]>([]);
  const [currentCPU, setCurrentCPU] = useState(0);
  const [currentMemory, setCurrentMemory] = useState(0);
  const [totalCores, setTotalCores] = useState(0);
  const { isReady } = useServiceReady({ enabled });

  const stableCallback = useRef((newStats: CPUStats) => {
    setStats((prev) => [...prev.slice(-299), newStats]);

    const cpu = newStats.process_cpu_usage || 0;
    const memory = newStats.process_memory || 0;
    const cores = newStats.nb_cores || 0;

    setCurrentCPU((prev) => (prev !== cpu ? cpu : prev));
    setCurrentMemory((prev) => (prev !== memory ? memory : prev));
    setTotalCores((prev) => (prev !== cores ? cores : prev));
  });

  const handleUpdate = useCallback((newStats: CPUStats) => {
    stableCallback.current(newStats);
  }, []);

  useEffect(() => {
    if (!enabled || !isReady) {
      setStats((prev) => (prev.length > 0 ? [] : prev));
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    const setup = async () => {
      try {
        const unsub = await gpacService.subscribe(
          { type: SubscriptionType.CPU_STATS, interval },
          (result) => {
            if (result.data && isMounted) {
              handleUpdate(result.data as CPUStats);
            }
          },
        );
        if (isMounted) {
          unsubscribe = unsub;
        } else {
          unsub();
        }
      } catch {
        if (isMounted) setStats([]);
      }
    };

    setup();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [enabled, isReady, interval, handleUpdate]);

  return {
    stats,
    isSubscribed: stats.length > 0,
    currentCPU,
    currentMemory,
    totalCores,
  };
}
