import { describe, it, expect } from 'vitest';
import { getPlayStartUs, getPagedStartUs } from '../playbackWindow';
import type { TimelineViewport } from '../timelineViewport';

const HOUR_US = 3_600_000_000;

const viewportOf = (
  startHours: number,
  endHours: number,
): TimelineViewport => ({
  sessionDurationUs: 72 * HOUR_US,
  visibleStartUs: startHours * HOUR_US,
  visibleDurationUs: (endHours - startHours) * HOUR_US,
});

describe('getPlayStartUs', () => {
  it('starts at the visible window start when the playhead is outside it', () => {
    expect(getPlayStartUs(viewportOf(30, 42), 12 * HOUR_US, false)).toBe(
      30 * HOUR_US,
    );
  });

  it('keeps the playhead when it is inside the visible window', () => {
    expect(getPlayStartUs(viewportOf(30, 42), 35 * HOUR_US, false)).toBe(
      35 * HOUR_US,
    );
  });

  it('keeps the playhead when the timeline is not zoomed', () => {
    expect(getPlayStartUs(viewportOf(0, 72), 50 * HOUR_US, false)).toBe(
      50 * HOUR_US,
    );
  });

  it('restarts at the visible window start once playback has ended', () => {
    expect(getPlayStartUs(viewportOf(66, 72), 72 * HOUR_US, true)).toBe(
      66 * HOUR_US,
    );
  });
});

describe('getPagedStartUs', () => {
  it('pages to the playhead when it reaches the right edge', () => {
    expect(getPagedStartUs(viewportOf(30, 42), 42 * HOUR_US)).toBe(
      42 * HOUR_US,
    );
  });

  it('does not page while the playhead is inside the visible window', () => {
    expect(getPagedStartUs(viewportOf(30, 42), 41 * HOUR_US)).toBeNull();
  });

  it('does not page when the visible window already reaches the session end', () => {
    expect(getPagedStartUs(viewportOf(66, 72), 72 * HOUR_US)).toBeNull();
  });
});
