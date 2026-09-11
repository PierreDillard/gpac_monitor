import { memo } from 'react';
import { formatCompactTime } from '@/utils/formatting/time';
import { EVENT_TYPE_COLOR } from './utils/eventTypeColors';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import type { TimelineEvent } from '@/services/historyService/types';

interface EventJournalRowProps {
  event: TimelineEvent;
  sessionStartUs: number;
  onSeek: (absoluteUs: number) => void;
}

const EventJournalRow = memo(
  ({ event, sessionStartUs, onSeek }: EventJournalRowProps) => {
    const color = EVENT_TYPE_COLOR[event.type];
    return (
      <div className="flex items-center gap-2 px-3 py-0.5 hover:bg-white/5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onSeek(sessionStartUs + event.sessionTimeUs)}
              className="text-monitor-meta font-mono tabular-nums text-xs shrink-0 hover:brightness-125"
            >
              {formatCompactTime(event.sessionTimeUs, true)}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Absolute: {formatCompactTime(event.absoluteTimeUs, true)}
          </TooltipContent>
        </Tooltip>
        <span className={`${color} w-3 h-0.5 rounded-sm shrink-0`} />
        <span className="text-xs text-gray-300 truncate">{event.title}</span>
      </div>
    );
  },
);

EventJournalRow.displayName = 'EventJournalRow';

export default EventJournalRow;
