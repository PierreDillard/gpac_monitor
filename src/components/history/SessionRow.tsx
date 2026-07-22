import { memo } from 'react';
import { LuClapperboard, LuTriangleAlert } from 'react-icons/lu';
import { formatBytes, formatSessionId, formatTime } from '@/utils/formatting';
import type { SessionInfo } from '@/services/historyService/sessionFileReader/types';

interface SessionRowProps {
  session: SessionInfo;
  onSelect: (sessionId: string) => void;
  disabled: boolean;
  connected: boolean;
}

const SessionRow = memo(
  ({ session, onSelect, disabled, connected }: SessionRowProps) => {
    const isValid =
      (session.hasSnapshot && (session.hasEvents || session.hasManifest)) ||
      (session.hasManifest && session.hasCheckpoints);
    const inProgress = !session.isComplete && connected;
    const isBroken = session.isComplete && !isValid;
    return (
      <button
        onClick={() => onSelect(session.sessionId)}
        disabled={disabled || !isValid}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg
        text-left transition-colors hover:bg-white/5 disabled:opacity-40
        disabled:cursor-not-allowed border border-transparent hover:border-white/10"
      >
        <div>
          <div className="text-sm text-white font-medium">
            {formatSessionId(session.sessionId)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {session.isComplete && !session.hasSnapshot && (
              <span className="text-red-400">missing snapshot · </span>
            )}
            {session.isComplete &&
              !session.hasEvents &&
              !session.hasManifest && (
                <span className="text-red-400">missing events · </span>
              )}
            {inProgress && (
              <span className="text-green-400">in progress · </span>
            )}
            {formatBytes(session.sizeBytes)}
            {session.startUs !== undefined && session.endUs !== undefined && (
              <span className="text-gray-400">
                {' '}
                · {formatTime(session.endUs - session.startUs)}
              </span>
            )}
          </div>
        </div>
        {inProgress ? (
          <LuClapperboard className="w-4 h-4 text-green-400 shrink-0" />
        ) : isBroken ? (
          <LuTriangleAlert className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <LuClapperboard className="w-4 h-4 text-gray-500 shrink-0" />
        )}
      </button>
    );
  },
);

export default SessionRow;
