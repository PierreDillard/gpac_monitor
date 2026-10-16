import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HistoryController } from '../historyController';
import type {
  HistorySource,
  HistoryManifest,
  HistorySessionIndex,
} from '../source/types';
import type { HistoryEvent, HistorySnapshot } from '../types';

const SEGMENT_DURATION_US = 10_000_000;
const SEGMENT_COUNT = 3;
const EVENTS_PER_SEGMENT = 3;

const makeSnapshot = (): HistorySnapshot => ({
  ts_us: 0,
  command_line: null,
  graph_v: 1,
  filters: [],
});

const makeEvent = (tsUs: number): HistoryEvent =>
  ({
    version: 1,
    ts_us: tsUs,
    message: 'cpu_stats',
    stats: {} as any,
  }) as HistoryEvent;

const segmentDirOf = (segmentIndex: number): string =>
  `segments/${String(segmentIndex).padStart(4, '0')}`;

const segmentIndexOf = (segmentDir: string): number =>
  Number(segmentDir.split('/')[1]);

const eventTimestampsOf = (segmentIndex: number): number[] =>
  Array.from(
    { length: EVENTS_PER_SEGMENT },
    (_unused, position) =>
      segmentIndex * SEGMENT_DURATION_US + (position + 1) * 1_000_000,
  );

const sessionIndex: HistorySessionIndex = {
  version: 1,
  startUs: 0,
  segmentDurationUs: SEGMENT_DURATION_US,
  retentionMaxSegments: SEGMENT_COUNT,
  segments: Array.from({ length: SEGMENT_COUNT }, (_unused, segmentIndex) => ({
    index: segmentIndex,
    fromUs: segmentIndex * SEGMENT_DURATION_US,
  })),
};

const makeManifest = (segmentIndex: number): HistoryManifest => ({
  version: 1,
  startUs: segmentIndex * SEGMENT_DURATION_US,
  endUs: (segmentIndex + 1) * SEGMENT_DURATION_US,
  chunkDurationUs: SEGMENT_DURATION_US,
  chunkCount: 1,
});

function makeSource(): HistorySource {
  return {
    sessionId: 'test-session',
    getManifest: vi.fn(),
    loadSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
    loadJournalIndex: vi.fn().mockResolvedValue(null),
    getSessionIndex: vi.fn().mockResolvedValue(sessionIndex),
    getSegmentManifest: vi.fn((segmentDir: string) =>
      Promise.resolve(makeManifest(segmentIndexOf(segmentDir))),
    ),
    loadSegmentSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
    loadGlobalEventsIndex: vi.fn().mockResolvedValue(null),
    readChunk: vi.fn((_index: number, segmentDir = segmentDirOf(0)) =>
      Promise.resolve(
        eventTimestampsOf(segmentIndexOf(segmentDir)).map(makeEvent),
      ),
    ),
    readLogChunk: vi.fn().mockResolvedValue([]),
    readCheckpoint: vi.fn().mockResolvedValue(null),
  };
}

function advanceWallClockTo(milliseconds: number): void {
  (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(milliseconds);
}

describe('HistoryController — rollover overflow proof across 2 segment boundaries (task 15 E4)', () => {
  beforeEach(() => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replays every event once, in order, with a bounded player timeline', async () => {
    const controller = new HistoryController();
    const source = makeSource();
    await controller.load(source as any, vi.fn() as any);
    const handleEventSpy = vi.spyOn((controller as any).adapter, 'handleEvent');
    await controller.play();

    let largestTimelineLength = 0;
    for (let boundary = 1; boundary < SEGMENT_COUNT; boundary++) {
      advanceWallClockTo((boundary * SEGMENT_DURATION_US) / 1000 - 5_000);
      (controller as any).player.tick();
      await vi.waitFor(() =>
        expect(source.readChunk).toHaveBeenCalledWith(
          0,
          segmentDirOf(boundary),
        ),
      );
      await vi.waitFor(() => expect(controller.getState()).toBe('playing'));
      largestTimelineLength = Math.max(
        largestTimelineLength,
        (controller as any).player.timelineEvents.length,
      );
    }
    advanceWallClockTo((SEGMENT_COUNT * SEGMENT_DURATION_US) / 1000);
    (controller as any).player.tick();

    const replayedTimestamps = handleEventSpy.mock.calls.map(
      ([event]) => (event as HistoryEvent).ts_us,
    );
    const expectedTimestamps = Array.from(
      { length: SEGMENT_COUNT },
      (_unused, segmentIndex) => eventTimestampsOf(segmentIndex),
    ).flat();
    expect(replayedTimestamps).toEqual(expectedTimestamps);
    expect(largestTimelineLength).toBeLessThanOrEqual(2 * EVENTS_PER_SEGMENT);
    expect(controller.getState()).toBe('done');
  });
});
