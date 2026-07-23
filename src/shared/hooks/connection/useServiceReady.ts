import { useEffect, useState } from 'react';
import { gpacService } from '@/services/gpacService';
import { useAppSelector } from '../redux';
import { selectActiveConnection } from '@/shared/store/selectors';
import { useDataSource } from '@/services/dataSource/DataSourceContext';

type UseServiceReadyOptions = { enabled?: boolean; timeoutMs?: number };
type UseServiceReadyResult = {
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;
};

export function useServiceReady({
  enabled = true,
  timeoutMs = 5000,
}: UseServiceReadyOptions = {}): UseServiceReadyResult {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const activeConnection = useAppSelector(selectActiveConnection);
  const { mode } = useDataSource();

  const connectionId = activeConnection?.id;
  const connectionAddress = activeConnection?.address;
  // History mode must never open the live WS: the server registers every
  // client in all_clients and broadcasts live graph updates to all of them.
  const liveEnabled = enabled && mode !== 'history';

  useEffect(() => {
    if (!liveEnabled || !connectionAddress) {
      setIsReady(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Service timeout')), timeoutMs),
    );

    Promise.race([gpacService.ready(connectionAddress), timeout])
      .then(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error('Service failed'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [liveEnabled, timeoutMs, connectionId, connectionAddress]);

  return { isReady, isLoading, error };
}
