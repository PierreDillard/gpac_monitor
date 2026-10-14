import { describe, it, expect } from 'vitest';
import {
  centeredHalfRange,
  clampRangeToViewport,
  resizeRangeEdge,
} from '../zoomTargetRange';
import {
  MIN_VISIBLE_DURATION_US,
  type TimelineViewport,
} from '../timelineViewport';

const viewport: TimelineViewport = {
  sessionDurationUs: 100_000_000,
  visibleStartUs: 20_000_000,
  visibleDurationUs: 40_000_000,
};

describe('centeredHalfRange', () => {
  it('covers the middle half of the visible window', () => {
    expect(centeredHalfRange(viewport)).toEqual({
      startUs: 30_000_000,
      durationUs: 20_000_000,
    });
  });
});

describe('clampRangeToViewport', () => {
  it('stops a range moved past the visible end', () => {
    expect(
      clampRangeToViewport(viewport, {
        startUs: 55_000_000,
        durationUs: 20_000_000,
      }),
    ).toEqual({ startUs: 40_000_000, durationUs: 20_000_000 });
  });

  it('stops a range moved before the visible start', () => {
    expect(
      clampRangeToViewport(viewport, {
        startUs: 5_000_000,
        durationUs: 20_000_000,
      }),
    ).toEqual({ startUs: 20_000_000, durationUs: 20_000_000 });
  });
});

describe('resizeRangeEdge', () => {
  const range = { startUs: 30_000_000, durationUs: 20_000_000 };

  it('moves the start and keeps the end fixed', () => {
    expect(resizeRangeEdge(viewport, range, 'start', 25_000_000)).toEqual({
      startUs: 25_000_000,
      durationUs: 25_000_000,
    });
  });

  it('stops the end at the visible end', () => {
    expect(resizeRangeEdge(viewport, range, 'end', 90_000_000)).toEqual({
      startUs: 30_000_000,
      durationUs: 30_000_000,
    });
  });

  it('keeps the minimum duration when an edge crosses the other', () => {
    expect(resizeRangeEdge(viewport, range, 'start', 55_000_000)).toEqual({
      startUs: 50_000_000 - MIN_VISIBLE_DURATION_US,
      durationUs: MIN_VISIBLE_DURATION_US,
    });
  });
});
