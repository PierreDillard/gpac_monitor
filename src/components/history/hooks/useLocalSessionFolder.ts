import { useState, useCallback } from 'react';
import { useDataSource } from '@/services/dataSource/DataSourceContext';
import { LocalFileSessionFileReader } from '@/services/historyService/sessionFileReader';
import { FileHistorySource } from '@/services/historyService/source/FileHistorySource';
import type { SessionInfo } from '@/services/historyService/sessionFileReader/types';

const isDirectoryEntry = (
  entry: FileSystemEntry,
): entry is FileSystemDirectoryEntry => entry.isDirectory;

export const useLocalSessionFolder = () => {
  const { loadFromSource } = useDataSource();
  const [browser, setBrowser] = useState<LocalFileSessionFileReader | null>(
    null,
  );
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const openReader = useCallback(
    async (fileBrowser: LocalFileSessionFileReader) => {
      try {
        const folderSessions = await fileBrowser.listSessions();
        if (folderSessions.length === 0) {
          setLoadError('No session found in this folder');
          return;
        }
        setSessions(folderSessions);
        setBrowser(fileBrowser);
        setLoadError(null);
      } catch (err) {
        console.error('[useLocalSessionFolder] list error:', err);
        setLoadError(err instanceof Error ? err.message : 'Cannot read folder');
      }
    },
    [],
  );

  const openFiles = useCallback(
    (files: FileList) =>
      openReader(new LocalFileSessionFileReader(Array.from(files))),
    [openReader],
  );

  const openDroppedItem = useCallback(
    (dataTransfer: DataTransfer) => {
      const entry = dataTransfer.items[0]?.webkitGetAsEntry();
      if (!entry || !isDirectoryEntry(entry)) {
        setLoadError('Drop a folder');
        return;
      }
      void openReader(new LocalFileSessionFileReader(entry));
    },
    [openReader],
  );

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
    openDroppedItem,
    selectSession,
  };
};
