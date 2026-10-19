import { describe, it, expect } from 'vitest';
import {
  sliceVisibleEvents,
  getVisibleEvents,
  getCursorPercent,
  clusterVisibleEvents,
  pixelsToDurationUs,
  type PositionedEvent,
} from '../timelineViewportView';
import {
  zoomViewportAroundTime,
  type TimelineViewport,
} from '../timelineViewport';
import type { TimelineEvent } from '@/services/historyService/types';

const viewport: TimelineViewport = {
  sessionDurationUs: 100_000_000,
  visibleStartUs: 40_000_000,
  visibleDurationUs: 40_000_000, // window [40s, 80s]
};

const event = (id: string, sessionTimeUs: number): TimelineEvent => ({
  id,
  sessionTimeUs,
  absoluteTimeUs: sessionTimeUs,
  type: 'pid-reconfig',
  title: 'PID reconfigured',
});

describe('sliceVisibleEvents', () => {
  const sessionEvents = [
    event('before', 30_000_000),
    event('start', 40_000_000),
    event('inside', 60_000_000),
    event('end', 80_000_000),
    event('after', 90_000_000),
  ];

  it('keeps only the events of a zoomed window, bounds included', () => {
    const result = sliceVisibleEvents(viewport, sessionEvents);
    expect(result.map((entry) => entry.id)).toEqual(['start', 'inside', 'end']);
  });

  it('keeps the whole session when the view is not zoomed', () => {
    const fullViewport: TimelineViewport = {
      sessionDurationUs: 100_000_000,
      visibleStartUs: 0,
      visibleDurationUs: 100_000_000,
    };
    expect(sliceVisibleEvents(fullViewport, sessionEvents)).toEqual(
      sessionEvents,
    );
  });

  it('brings back the surrounding events after zooming out', () => {
    const zoomedOut = zoomViewportAroundTime(viewport, 60_000_000, 2);
    expect(sliceVisibleEvents(zoomedOut, sessionEvents)).toEqual(sessionEvents);
  });

  it('returns no event for a window without events', () => {
    const emptyViewport: TimelineViewport = {
      ...viewport,
      visibleStartUs: 81_000_000,
      visibleDurationUs: 5_000_000,
    };
    expect(sliceVisibleEvents(emptyViewport, sessionEvents)).toEqual([]);
  });
});

describe('getVisibleEvents', () => {
  it('excludes events outside the window', () => {
    const result = getVisibleEvents(viewport, [
      event('before', 30_000_000),
      event('inside', 60_000_000),
      event('after', 90_000_000),
    ]);
    expect(result.map((entry) => entry.event.id)).toEqual(['inside']);
  });

  it('maps the window bounds to 0% and 100%', () => {
    const result = getVisibleEvents(viewport, [
      event('start', 40_000_000),
      event('end', 80_000_000),
    ]);
    expect(result[0].positionPercent).toBe(0);
    expect(result[1].positionPercent).toBe(100);
  });
});

describe('getCursorPercent', () => {
  it('returns the ratio inside the window', () => {
    expect(getCursorPercent(viewport, 60_000_000)).toBe(50);
  });

  it('clamps a playhead outside the window', () => {
    expect(getCursorPercent(viewport, 10_000_000)).toBe(0);
    expect(getCursorPercent(viewport, 95_000_000)).toBe(100);
  });
});

describe('clusterVisibleEvents', () => {
  it('groups events closer than the gap into one cluster', () => {
    const visible: PositionedEvent[] = [
      { event: event('a', 50_000_000), positionPercent: 25 },
      { event: event('b', 50_400_000), positionPercent: 26 },
      { event: event('c', 50_800_000), positionPercent: 27 },
    ];
    const items = clusterVisibleEvents(visible, 5);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'cluster',
      count: 3,
      fromUs: 50_000_000,
      toUs: 50_800_000,
    });
  });

  it('keeps well-spaced events individual', () => {
    const visible: PositionedEvent[] = [
      { event: event('a', 44_000_000), positionPercent: 10 },
      { event: event('b', 72_000_000), positionPercent: 80 },
    ];
    const items = clusterVisibleEvents(visible, 5);
    expect(items.map((item) => item.kind)).toEqual(['event', 'event']);
  });

  it('does not throw on a run past the JS call-argument limit (RangeError regression)', () => {
    // Spread-based Math.min/max(...timestamps) hits V8's ~125k argument ceiling.
    const count = 200_000;
    const visible: PositionedEvent[] = Array.from(
      { length: count },
      (_, i) => ({
        event: event(`e${i}`, i * 100),
        positionPercent: i * 0.0001, // stays well under minGapPercent for every consecutive pair
      }),
    );
    const items = clusterVisibleEvents(visible, 5);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'cluster',
      count,
      fromUs: 0,
      toUs: (count - 1) * 100,
    });
  });
});

describe('pixelsToDurationUs', () => {
  const sessionDurationUs = 72 * 3600 * 1_000_000;

  it('maps a click in the middle of the bar to mid-session', () => {
    expect(pixelsToDurationUs(400, 800, sessionDurationUs)).toBe(
      36 * 3600 * 1_000_000,
    );
  });

  it('maps a drag of 10% of the width, in both directions', () => {
    expect(pixelsToDurationUs(80, 800, sessionDurationUs)).toBeCloseTo(
      7.2 * 3600 * 1_000_000,
    );
    expect(pixelsToDurationUs(-80, 800, sessionDurationUs)).toBeCloseTo(
      -7.2 * 3600 * 1_000_000,
    );
  });

  it('returns 0 when the bar has no width', () => {
    expect(pixelsToDurationUs(50, 0, sessionDurationUs)).toBe(0);
  });
});
