import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import EventJournalRow from '../timeline/EventJournalRow';
import type { TimelineEvent } from '@/services/historyService/types';

describe('EventJournal time formatting', () => {
  it('renders the same relative time format for every event type at the same sessionTimeUs', () => {
    // real bug report: an "error" event (loggerTimeUs-based) and an "args-change"
    // event (sessionTimeUs-based) at the same session instant showed different
    // labels ("1.160s" vs "00:01.16") because two different formatters/time bases
    // were mixed in the same list.
    const events: TimelineEvent[] = [
      {
        id: 'error_1160000',
        sessionTimeUs: 1_160_000,
        absoluteTimeUs: 5_000_160_000,
        type: 'error',
        title: 'Errors',
      },
      {
        id: 'args-change_1160000',
        sessionTimeUs: 1_160_000,
        absoluteTimeUs: 5_000_160_000,
        type: 'args-change',
        title: 'Args changed',
      },
    ];

    render(
      <TooltipProvider>
        {events.map((event) => (
          <EventJournalRow
            key={event.id}
            event={event}
            sessionStartUs={0}
            onSeek={vi.fn()}
          />
        ))}
      </TooltipProvider>,
    );

    const labels = screen.getAllByText('00:01.16');
    expect(labels).toHaveLength(2);
    expect(screen.queryByText(/^\d+\.\d{3}s$/)).not.toBeInTheDocument();
  });
});
