import { memo, useRef, useEffect } from 'react';
import { LuFolderOpen } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import SessionRow from './SessionRow';
import type { SessionInfo } from '@/services/historyService/sessionFileReader/types';

interface LocalFilePickerProps {
  sessions: SessionInfo[];
  loadingSession: boolean;
  loadError: string | null;
  onFiles: (files: FileList) => void;
  onSelect: (sessionId: string) => void;
}

const LocalFilePicker = memo(
  ({
    sessions,
    loadingSession,
    loadError,
    onFiles,
    onSelect,
  }: LocalFilePickerProps) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.setAttribute('webkitdirectory', '');
      }
    }, []);

    return (
      <div className=" border-monitor-line">
        <div className="px-4 py-3">
          <p className="text-xs text-gray-500 mb-2">
            Load from local files — or drop the history folder here
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.length) onFiles(event.target.files);
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => inputRef.current?.click()}
          >
            <LuFolderOpen className="w-3.5 h-3.5 mr-1.5" />
            Browse history folder
          </Button>
        </div>

        {sessions.length > 0 && (
          <div className="px-3 pb-3">
            {sessions.map((session) => (
              <SessionRow
                key={session.sessionId}
                session={session}
                onSelect={onSelect}
                disabled={loadingSession}
                isRecording={false}
              />
            ))}
            {loadingSession && (
              <div className="flex items-center justify-center py-2 gap-2 text-gray-400">
                <Spinner className="w-4 h-4" />
                <span className="text-sm">Loading session…</span>
              </div>
            )}
          </div>
        )}
        {loadError && (
          <p className="text-xs text-center px-3 pb-3">{loadError}</p>
        )}
      </div>
    );
  },
);

export default LocalFilePicker;
