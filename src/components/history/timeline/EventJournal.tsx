import { memo, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { TooltipProvider } from '@/components/ui/tooltip';
import EventJournalRow from './EventJournalRow';
import type { TimelineEvent } from '@/services/historyService/types';

interface EventJournalProps {
  events: TimelineEvent[];
  sessionStartUs: number;
  onSeek: (absoluteUs: number) => void;
}

const EventJournal = memo(
  ({ events, sessionStartUs, onSeek }: EventJournalProps) => {
    const renderEvent = useCallback(
      (_index: number, event: TimelineEvent) => (
        <EventJournalRow
          event={event}
          sessionStartUs={sessionStartUs}
          onSeek={onSeek}
        />
      ),
      [sessionStartUs, onSeek],
    );

    if (events.length === 0) return null;

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-3 pt-1 pb-0.5 text-[0.688rem] font-medium uppercase tracking-wide text-gray-500 shrink-0">
          Event Journal
        </div>
        <TooltipProvider delayDuration={200}>
          <div className="flex-1 min-h-0">
            <Virtuoso
              data={events}
              computeItemKey={(_index, event) => event.id}
              itemContent={renderEvent}
              style={{ height: '100%' }}
              overscan={20}
              increaseViewportBy={200}
            />
          </div>
        </TooltipProvider>
      </div>
    );
  },
);

EventJournal.displayName = 'EventJournal';

export default EventJournal;
