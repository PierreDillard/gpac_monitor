import React, { createContext, useContext, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { clearAllSessionData } from '@/shared/store/actions/globalActions';
import { historyController } from '@/services/historyService/historyController';
import type { AppDispatch } from '@/shared/store';
import type {
  HistorySource,
  HistoryManifest,
} from '@/services/historyService/source/types';
import { formatSessionId } from '@/utils/formatting';

export type DataSourceMode = 'live' | 'history';

const getInitialMode = (): DataSourceMode => {
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') === 'history' ? 'history' : 'live';
};

interface DataSourceContextValue {
  mode: DataSourceMode;
  sessionLoaded: boolean;
  sessionName: string | null;
  manifest: HistoryManifest | null;
  switchToLive: () => void;
  loadFromSource: (source: HistorySource) => Promise<void>;
}

const DataSourceContext = createContext<DataSourceContextValue>({
  mode: 'live',
  sessionLoaded: false,
  sessionName: null,
  manifest: null,
  switchToLive: () => {},
  loadFromSource: async () => {},
});

export function DataSourceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const [mode, setMode] = useState<DataSourceMode>(getInitialMode);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [manifest, setManifest] = useState<HistoryManifest | null>(null);

  const loadFromSource = useCallback(
    async (source: HistorySource) => {
      await historyController.load(source, dispatch);
      setManifest(await source.getManifest());
      setSessionName(formatSessionId(source.sessionId));
      setSessionLoaded(true);
      setMode('history');
    },
    [dispatch],
  );

  const switchToLive = useCallback(() => {
    historyController.stop();
    dispatch(clearAllSessionData());
    setSessionLoaded(false);
    setSessionName(null);
    setManifest(null);
    setMode('live');
  }, [dispatch]);

  return (
    <DataSourceContext.Provider
      value={{
        mode,
        sessionLoaded,
        sessionName,
        manifest,
        switchToLive,
        loadFromSource,
      }}
    >
      {children}
    </DataSourceContext.Provider>
  );
}

export const useDataSource = () => useContext(DataSourceContext);
