import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HistoryController } from '../historyController';
import type {
  HistorySource,
  HistoryManifest,
  HistorySessionIndex,
} from '../source/types';
import type { HistoryEvent, HistorySnapshot } from '../types';

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

const twoSegmentSessionIndex: HistorySessionIndex = {
  version: 1,
  startUs: 0,
  segmentDurationUs: 10_000_000,
  retentionMaxSegments: 3,
  segments: [
    { index: 0, fromUs: 0 },
    { index: 1, fromUs: 10_000_000 },
  ],
};

const segmentManifests: Record<string, HistoryManifest> = {
  'segments/0000': {
    version: 1,
    startUs: 0,
    endUs: 10_000_000,
    chunkDurationUs: 10_000_000,
    chunkCount: 1,
  },
  'segments/0001': {
    version: 1,
    startUs: 10_000_000,
    endUs: 20_000_000,
    chunkDurationUs: 10_000_000,
    chunkCount: 1,
  },
};

const segmentEventUs: Record<string, number> = {
  'segments/0000': 1_000_000,
  'segments/0001': 11_000_000,
};

function makeTwoSegmentSource(): HistorySource {
  return {
    sessionId: 'test-session',
    getManifest: vi.fn(),
    loadSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
    loadJournalIndex: vi.fn().mockResolvedValue(null),
    getSessionIndex: vi.fn().mockResolvedValue(twoSegmentSessionIndex),
    getSegmentManifest: vi.fn((segmentDir: string) =>
      Promise.resolve(segmentManifests[segmentDir]),
    ),
    loadSegmentSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
    loadGlobalEventsIndex: vi.fn().mockResolvedValue(null),
    readChunk: vi.fn((_index: number, segmentDir = 'segments/0000') =>
      Promise.resolve([makeEvent(segmentEventUs[segmentDir])]),
    ),
    readLogChunk: vi.fn().mockResolvedValue([]),
    readCheckpoint: vi.fn().mockResolvedValue(null),
  };
}

function advanceWallClockTo(milliseconds: number): void {
  (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(milliseconds);
}

describe('HistoryController — play after done restarts from session start (task 15 E4)', () => {
  beforeEach(() => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replays the first segment event after a rollover played to done', async () => {
    const controller = new HistoryController();
    const source = makeTwoSegmentSource();
    await controller.load(source as any, vi.fn() as any);
    await controller.play();

    advanceWallClockTo(2_000);
    (controller as any).player.tick();
    await vi.waitFor(() => expect(controller.getState()).toBe('playing'));

    advanceWallClockTo(20_000);
    (controller as any).player.tick();
    expect(controller.getState()).toBe('done');

    const handleEventSpy = vi.spyOn((controller as any).adapter, 'handleEvent');
    await controller.play();
    advanceWallClockTo(22_000);
    (controller as any).player.tick();

    const replayedTimestamps = handleEventSpy.mock.calls.map(
      ([event]) => (event as HistoryEvent).ts_us,
    );
    expect(replayedTimestamps).toEqual([segmentEventUs['segments/0000']]);
  });
});
