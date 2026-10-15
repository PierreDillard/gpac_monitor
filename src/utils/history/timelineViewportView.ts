import type { TimelineViewport } from './timelineViewport';
import type { TimelineEvent } from '@/services/historyService/types';

export interface PositionedEvent {
  event: TimelineEvent;
  positionPercent: number;
}

export type TimelineItem =
  | { kind: 'event'; event: TimelineEvent; positionPercent: number }
  | {
      kind: 'cluster';
      count: number;
      fromUs: number;
      toUs: number;
      positionPercent: number;
    };

export const toPercent = (
  sessionTimeUs: number,
  viewport: TimelineViewport,
): number =>
  ((sessionTimeUs - viewport.visibleStartUs) / viewport.visibleDurationUs) *
  100;

export const pixelsToDurationUs = (
  pixels: number,
  barWidthPx: number,
  sessionDurationUs: number,
): number => (barWidthPx > 0 ? (pixels / barWidthPx) * sessionDurationUs : 0);

const firstIndexAfter = (
  events: TimelineEvent[],
  isBefore: (sessionTimeUs: number) => boolean,
): number => {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (isBefore(events[middle].sessionTimeUs)) low = middle + 1;
    else high = middle;
  }
  return low;
};

/** Keeps events inside the visible window and positions them relative to it. */
export function getVisibleEvents(
  viewport: TimelineViewport,
  events: TimelineEvent[],
): PositionedEvent[] {
  if (viewport.visibleDurationUs <= 0) return [];
  const visibleEndUs = viewport.visibleStartUs + viewport.visibleDurationUs;
  const startIndex = firstIndexAfter(
    events,
    (sessionTimeUs) => sessionTimeUs < viewport.visibleStartUs,
  );
  const endIndex = firstIndexAfter(
    events,
    (sessionTimeUs) => sessionTimeUs <= visibleEndUs,
  );
  const visible: PositionedEvent[] = [];
  for (let index = startIndex; index < endIndex; index++) {
    const event = events[index];
    visible.push({
      event,
      positionPercent: toPercent(event.sessionTimeUs, viewport),
    });
  }
  return visible;
}

/** Playhead position (0-100) inside the visible window, clamped to the edges. */
export function getCursorPercent(
  viewport: TimelineViewport,
  currentSessionTimeUs: number,
): number {
  if (viewport.visibleDurationUs <= 0) return 0;
  return Math.max(0, Math.min(100, toPercent(currentSessionTimeUs, viewport)));
}

/** Groups events closer than minGapPercent into clusters; others stay individual. */
export function clusterVisibleEvents(
  visible: PositionedEvent[],
  minGapPercent: number,
): TimelineItem[] {
  const items: TimelineItem[] = [];
  let run: PositionedEvent[] = [];

  const flush = () => {
    if (run.length === 0) return;
    if (run.length === 1) {
      items.push({ kind: 'event', ...run[0] });
    } else {
      let fromUs = run[0].event.sessionTimeUs;
      let toUs = fromUs;
      for (const entry of run) {
        if (entry.event.sessionTimeUs < fromUs)
          fromUs = entry.event.sessionTimeUs;
        if (entry.event.sessionTimeUs > toUs) toUs = entry.event.sessionTimeUs;
      }
      items.push({
        kind: 'cluster',
        count: run.length,
        fromUs,
        toUs,
        positionPercent:
          (run[0].positionPercent + run[run.length - 1].positionPercent) / 2,
      });
    }
    run = [];
  };

  for (const entry of visible) {
    if (
      run.length > 0 &&
      entry.positionPercent - run[run.length - 1].positionPercent >=
        minGapPercent
    ) {
      flush();
    }
    run.push(entry);
  }
  flush();
  return items;
}
