import { memo, useRef, useEffect, useState } from 'react';
import { LuFolderDown } from 'react-icons/lu';
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
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.setAttribute('webkitdirectory', '');
      }
    }, []);

    return (
      <div className="border-b border-monitor-line">
        <div className="px-4 py-3">
          <div
            className={`flex flex-col items-center gap-1 rounded-lg border-2 px-4 py-6 text-center transition-colors ${
              isDraggingOver
                ? 'border-solid border-red-400 bg-red-400/10'
                : 'border-dashed border-gray-600'
            }`}
            onDragEnter={() => setIsDraggingOver(true)}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setIsDraggingOver(false);
              }
            }}
            onDrop={() => setIsDraggingOver(false)}
          >
            <LuFolderDown className="w-6 h-6 text-gray-400" />
            <p className="text-sm text-gray-400">
              {isDraggingOver ? 'Release to open' : 'Drop a history folder'}
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
              variant="link"
              size="sm"
              onClick={() => inputRef.current?.click()}
              className="text-gray-400"
            >
              or Browse folder…
            </Button>
          </div>
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
          <p className="text-xs text-red-400 text-center px-3 pb-3">
            {loadError}
          </p>
        )}
      </div>
    );
  },
);

export default LocalFilePicker;
