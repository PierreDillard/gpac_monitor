import {
  MIN_VISIBLE_DURATION_US,
  type TimelineViewport,
} from './timelineViewport';

export interface TimeRange {
  startUs: number;
  durationUs: number;
}

/** Keeps the range inside the visible window, at least MIN_VISIBLE_DURATION_US long. */
export function clampRangeToViewport(
  viewport: TimelineViewport,
  range: TimeRange,
): TimeRange {
  const durationUs = Math.max(
    MIN_VISIBLE_DURATION_US,
    Math.min(range.durationUs, viewport.visibleDurationUs),
  );
  const maxStartUs =
    viewport.visibleStartUs + viewport.visibleDurationUs - durationUs;
  const startUs = Math.max(
    viewport.visibleStartUs,
    Math.min(range.startUs, maxStartUs),
  );
  return { startUs, durationUs };
}

/** Default zoom target: the middle half of the visible window. */
export function centeredHalfRange(viewport: TimelineViewport): TimeRange {
  return clampRangeToViewport(viewport, {
    startUs: viewport.visibleStartUs + viewport.visibleDurationUs / 4,
    durationUs: viewport.visibleDurationUs / 2,
  });
}

/** Moves one edge of the range to timeUs; the other edge stays fixed. */
export function resizeRangeEdge(
  viewport: TimelineViewport,
  range: TimeRange,
  edge: 'start' | 'end',
  timeUs: number,
): TimeRange {
  const rangeEndUs = range.startUs + range.durationUs;
  if (edge === 'start') {
    const startUs = Math.max(
      viewport.visibleStartUs,
      Math.min(timeUs, rangeEndUs - MIN_VISIBLE_DURATION_US),
    );
    return { startUs, durationUs: rangeEndUs - startUs };
  }
  const visibleEndUs = viewport.visibleStartUs + viewport.visibleDurationUs;
  const endUs = Math.min(
    visibleEndUs,
    Math.max(timeUs, range.startUs + MIN_VISIBLE_DURATION_US),
  );
  return { startUs: range.startUs, durationUs: endUs - range.startUs };
}
