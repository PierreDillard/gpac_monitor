import { describe, it, expect } from 'vitest';
import {
  parseSessionIndex,
  parseEventsIndex,
  getSegmentDir,
  getSegmentToUs,
  isSegmentDone,
  findSegmentForTimestamp,
} from '../sessionIndexParser';
import type { HistorySessionIndex } from '../source/types';

describe('parseSessionIndex', () => {
  it('parses an open session (no endUs, last segment without toUs)', () => {
    const raw = {
      version: 1,
      startUs: 0,
      segmentDurationUs: 60_000_000,
      retentionMaxSegments: 30,
      segments: [
        { index: 0, fromUs: 0, toUs: 60_000_000 },
        { index: 1, fromUs: 60_000_000 },
      ],
    };

    expect(parseSessionIndex(raw)).toEqual({
      version: 1,
      startUs: 0,
      endUs: undefined,
      segmentDurationUs: 60_000_000,
      retentionMaxSegments: 30,
      segments: [
        { index: 0, fromUs: 0, toUs: 60_000_000 },
        { index: 1, fromUs: 60_000_000, toUs: undefined },
      ],
    });
  });

  it('parses a closed session (endUs present, last segment has toUs)', () => {
    const raw = {
      version: 1,
      startUs: 0,
      endUs: 120_000_000,
      segmentDurationUs: 60_000_000,
      retentionMaxSegments: 30,
      segments: [
        { index: 0, fromUs: 0, toUs: 60_000_000 },
        { index: 1, fromUs: 60_000_000, toUs: 120_000_000 },
      ],
    };

    expect(parseSessionIndex(raw)).toEqual(raw);
  });

  it('throws on unsupported version', () => {
    expect(() => parseSessionIndex({ version: 2, segments: [] })).toThrow();
  });

  it('returns null for non-object input (file absent)', () => {
    expect(parseSessionIndex(null)).toBeNull();
  });
});

describe('getSegmentToUs', () => {
  it("falls back to the next segment's fromUs when toUs is missing", () => {
    const sessionIndex: HistorySessionIndex = {
      version: 1,
      startUs: 0,
      segmentDurationUs: 60_000_000,
      retentionMaxSegments: 30,
      segments: [
        { index: 0, fromUs: 0 },
        { index: 1, fromUs: 60_000_000 },
      ],
    };

    expect(getSegmentToUs(sessionIndex, 0)).toBe(60_000_000);
  });

  it('falls back to sessionIndex.endUs on the last segment of a closed session', () => {
    const sessionIndex: HistorySessionIndex = {
      version: 1,
      startUs: 0,
      endUs: 60_000_000,
      segmentDurationUs: 60_000_000,
      retentionMaxSegments: 30,
      segments: [{ index: 0, fromUs: 0 }],
    };

    expect(getSegmentToUs(sessionIndex, 0)).toBe(60_000_000);
  });
});

describe('getSegmentDir', () => {
  it('derives from segment.index, never from array position (after retention purge)', () => {
    const segment = { index: 5, fromUs: 300_000_000, toUs: 360_000_000 };

    expect(getSegmentDir(segment)).toBe('segments/0005');
  });
});

describe('isSegmentDone', () => {
  it('is false for the last segment of an open session', () => {
    const sessionIndex: HistorySessionIndex = {
      version: 1,
      startUs: 0,
      segmentDurationUs: 60_000_000,
      retentionMaxSegments: 30,
      segments: [{ index: 0, fromUs: 0 }],
    };

    expect(isSegmentDone(sessionIndex, 0)).toBe(false);
  });

  it('is true for the last segment of a closed session', () => {
    const sessionIndex: HistorySessionIndex = {
      version: 1,
      startUs: 0,
      endUs: 60_000_000,
      segmentDurationUs: 60_000_000,
      retentionMaxSegments: 30,
      segments: [{ index: 0, fromUs: 0, toUs: 60_000_000 }],
    };

    expect(isSegmentDone(sessionIndex, 0)).toBe(true);
  });
});

describe('findSegmentForTimestamp', () => {
  const sessionIndex: HistorySessionIndex = {
    version: 1,
    startUs: 0,
    segmentDurationUs: 60_000_000,
    retentionMaxSegments: 30,
    segments: [
      { index: 0, fromUs: 0, toUs: 60_000_000 },
      { index: 1, fromUs: 60_000_000, toUs: 120_000_000 },
      { index: 2, fromUs: 130_000_000 },
    ],
  };

  it('returns the segment containing tsUs', () => {
    expect(findSegmentForTimestamp(sessionIndex, 90_000_000)).toEqual(
      sessionIndex.segments[1],
    );
  });

  it('falls back to the first segment when tsUs is before the earliest fromUs', () => {
    expect(findSegmentForTimestamp(sessionIndex, -1)).toEqual(
      sessionIndex.segments[0],
    );
  });

  it('returns the last segment when tsUs is after it started', () => {
    expect(findSegmentForTimestamp(sessionIndex, 500_000_000)).toEqual(
      sessionIndex.segments[2],
    );
  });

  it('returns the previous segment when tsUs falls in a gap between segments', () => {
    expect(findSegmentForTimestamp(sessionIndex, 125_000_000)).toEqual(
      sessionIndex.segments[1],
    );
  });

  it('returns null when there are no segments at all', () => {
    const empty: HistorySessionIndex = { ...sessionIndex, segments: [] };
    expect(findSegmentForTimestamp(empty, 0)).toBeNull();
  });
});

describe('parseEventsIndex', () => {
  it('drops malformed entries (missing type)', () => {
    const raw = [{ ts_us: 0 }, { ts_us: 60_000_000, type: 'filters' }];

    expect(parseEventsIndex(raw)).toEqual([
      { ts_us: 60_000_000, type: 'filters' },
    ]);
  });

  it('returns an empty array for non-array input', () => {
    expect(parseEventsIndex(null)).toEqual([]);
  });
});
