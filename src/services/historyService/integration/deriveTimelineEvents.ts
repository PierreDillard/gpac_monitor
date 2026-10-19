import type { ManifestEventEntry } from '../source/types';
import type { JournalIndex, TimelineEvent, TimelineEventType } from '../types';

const TITLES: Record<TimelineEventType, string> = {
  'graph-change': 'Graph changed',
  'pid-reconfig': 'PID reconfigured',
  'args-change': 'Args changed',
  error: 'Errors',
  warning: 'Warnings',
};

const JOURNAL_TYPE_CODES: Record<number, TimelineEventType> = {
  1: 'error',
  2: 'warning',
};

export function deriveTimelineEvents(
  eventsIndex: ManifestEventEntry[],
  startUs: number,
): TimelineEvent[] {
  return eventsIndex.map((entry) => ({
    id: `${entry.type}_${entry.ts_us}`,
    sessionTimeUs: entry.ts_us - startUs,
    absoluteTimeUs: entry.ts_us,
    type: entry.type,
    title: TITLES[entry.type],
  }));
}

/** Decodes error/warning facts from the columnar journal index (see journal_index.json). */
export function deriveErrorWarningEvents(
  journalIndex: JournalIndex | null,
  startUs: number,
): TimelineEvent[] {
  if (!journalIndex) return [];
  return journalIndex.tsDeltaUs.map((deltaUs, index) => {
    const tsUs = journalIndex.baseTsUs + deltaUs;
    const type = JOURNAL_TYPE_CODES[journalIndex.types[index]];
    return {
      id: `${type}_${tsUs}_${index}`,
      sessionTimeUs: tsUs - startUs,
      absoluteTimeUs: tsUs,
      type,
      title: TITLES[type],
    };
  });
}
