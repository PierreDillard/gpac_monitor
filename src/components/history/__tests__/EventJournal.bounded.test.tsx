import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { VirtuosoMockContext } from 'react-virtuoso';
import EventJournal from '../timeline/EventJournal';
import type { TimelineEvent } from '@/services/historyService/types';

const ROW_TITLE = 'Errors';

const buildEvents = (count: number): TimelineEvent[] =>
  Array.from({ length: count }, (_unused, index) => ({
    id: `error_${index}`,
    sessionTimeUs: index * 1_000_000,
    absoluteTimeUs: index * 1_000_000,
    type: 'error',
    title: ROW_TITLE,
  }));

const countMountedRows = (eventCount: number): number => {
  render(
    <VirtuosoMockContext.Provider
      value={{ viewportHeight: 300, itemHeight: 20 }}
    >
      <EventJournal
        events={buildEvents(eventCount)}
        sessionStartUs={0}
        onSeek={vi.fn()}
      />
    </VirtuosoMockContext.Provider>,
  );
  const mountedRows = screen.queryAllByText(ROW_TITLE).length;
  cleanup();
  return mountedRows;
};

describe('EventJournal bounded rendering', () => {
  it('keeps mounted rows independent of the number of events', () => {
    const smallSessionRows = countMountedRows(100);
    const largeSessionRows = countMountedRows(10_000);

    expect(smallSessionRows).toBeGreaterThan(0);
    expect(largeSessionRows).toBeLessThan(100);
    expect(largeSessionRows).toBe(smallSessionRows);
  });
});
