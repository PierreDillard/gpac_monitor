import { useState, useCallback } from 'react';
import { useDataSource } from '@/services/dataSource/DataSourceContext';
import { LocalFileSessionFileReader } from '@/services/historyService/sessionFileReader';
import { FileHistorySource } from '@/services/historyService/source/FileHistorySource';
import type { SessionInfo } from '@/services/historyService/sessionFileReader/types';

export const useLocalSessionFolder = () => {
  const { loadFromSource } = useDataSource();
  const [browser, setBrowser] = useState<LocalFileSessionFileReader | null>(
    null,
  );
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const openFiles = useCallback(async (files: FileList) => {
    const fileBrowser = new LocalFileSessionFileReader(Array.from(files));
    setSessions(await fileBrowser.listSessions());
    setBrowser(fileBrowser);
    setLoadError(null);
  }, []);

  const selectSession = useCallback(
    async (sessionId: string) => {
      if (!browser) return;
      setLoadingSession(true);
      setLoadError(null);
      try {
        const source = new FileHistorySource(browser, sessionId);
        await loadFromSource(source);
      } catch (err) {
        console.error('[useLocalSessionFolder] load error:', err);
        const message = err instanceof Error ? err.message : 'Load failed';
        const session = sessions.find(
          (candidate) => candidate.sessionId === sessionId,
        );
        setLoadError(
          message.includes('No manifest for session') &&
            session?.isComplete === false
            ? 'Session still starting — try again in a moment'
            : message,
        );
        setLoadingSession(false);
      }
    },
    [browser, loadFromSource, sessions],
  );

  return {
    hasFolder: browser !== null,
    sessions,
    loadingSession,
    loadError,
    openFiles,
    selectSession,
  };
};
