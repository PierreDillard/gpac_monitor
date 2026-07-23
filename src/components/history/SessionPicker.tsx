import { useState, useCallback } from 'react';
import { LuClapperboard, LuRefreshCw, LuLoaderCircle } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useDataSource } from '@/services/dataSource/DataSourceContext';
import { useDataMode } from '@/shared/hooks/data/useDataMode';
import { useSessionList } from '@/services/historyService/sessionFileReader/useSessionList';
import { RemoteHistorySource } from '@/services/historyService/source/RemoteHistorySource';
import { useAppSelector } from '@/shared/hooks/redux';
import { selectActiveConnection } from '@/shared/store/selectors';
import SessionRow from './SessionRow';
import LocalFilePicker from './LocalFilePicker';

const SessionPicker = () => {
  const { isHistory } = useDataMode();
  const { sessionLoaded, loadFromSource } = useDataSource();
  const activeConnection = useAppSelector(selectActiveConnection);
  const { sessions, loading, error, browser, retry } = useSessionList(
    activeConnection?.address,
  );
  const [isLocal, setIsLocal] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSession = useCallback(
    async (sessionId: string) => {
      if (!browser) return;
      setLoadingSession(true);
      setLoadError(null);
      try {
        const source = new RemoteHistorySource(browser, sessionId);
        await loadFromSource(source);
      } catch (err) {
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

  const handleSelect = useCallback(
    (sessionId: string) => loadSession(sessionId),
    [loadSession],
  );

  const recordingSessionId = activeConnection
    ? sessions.find((session) => !session.isComplete)?.sessionId
    : undefined;

  if (!isHistory || sessionLoaded) return null;

  return (
    <div className="fixed inset-0 top-16 z-30 flex items-center justify-center bg-gray-950/80">
      <div className="bg-monitor-selection border-0 rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-monitor-line">
          <LuClapperboard className="w-4 h-4 text-red-400" />
          <span className="text-sm font-semibold text-white">
            Select a session
          </span>
        </div>

        <div className="px-3 py-3 ">
          <>
            {!isLocal && loading && (
              <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                <Spinner className="w-4 h-4" />
                <span className="text-sm">Loading sessions…</span>
              </div>
            )}
            {!isLocal && !loading && error && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <LuLoaderCircle className="w-6 h-6 text-red-400" />
                <p className="text-sm text-gray-400">{error}</p>
                <Button variant="outline" size="sm" onClick={retry}>
                  <LuRefreshCw className="w-3 h-3 mr-1.5" /> Retry
                </Button>
              </div>
            )}
            {!isLocal && !loading && !error && sessions.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-sm text-gray-400">No sessions found.</p>
                <Button variant="outline" size="sm" onClick={retry}>
                  <LuRefreshCw className="w-3 h-3 mr-1.5" /> Refresh
                </Button>
              </div>
            )}
            {!loading &&
              !error &&
              sessions.map((session) => (
                <SessionRow
                  key={session.sessionId}
                  session={session}
                  onSelect={handleSelect}
                  disabled={loadingSession}
                  isRecording={session.sessionId === recordingSessionId}
                />
              ))}
            {loadError && (
              <p className="text-xs text-red-400 text-center mt-2">
                {loadError}
              </p>
            )}
            {loadingSession && (
              <div className="flex items-center justify-center py-2 gap-2 text-gray-400">
                <Spinner className="w-4 h-4" />
                <span className="text-sm">Loading session…</span>
              </div>
            )}
          </>
        </div>

        <LocalFilePicker onLocalFilesLoaded={() => setIsLocal(true)} />
      </div>
    </div>
  );
};

export default SessionPicker;
