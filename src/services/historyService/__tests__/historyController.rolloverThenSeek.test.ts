import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HistoryController } from '../historyController';
import type {
  HistorySource,
  HistoryManifest,
  HistorySessionIndex,
} from '../source/types';
import type { HistoryEvent, HistorySnapshot } from '../types';

const makeSnapshot = (tsUs: number): HistorySnapshot => ({
  ts_us: tsUs,
  command_line: null,
  graph_v: 1,
  filters: [],
});

const segmentSnapshots: Record<string, HistorySnapshot> = {
  'segments/0000': makeSnapshot(0),
  'segments/0001': makeSnapshot(10_000_000),
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

const makeEvent = (tsUs: number): HistoryEvent =>
  ({
    version: 1,
    ts_us: tsUs,
    message: 'cpu_stats',
    stats: {} as any,
  }) as HistoryEvent;

function makeSegmentedSource(): HistorySource {
  return {
    sessionId: 'test-session',
    getManifest: vi.fn(),
    loadSnapshot: vi.fn().mockResolvedValue(segmentSnapshots['segments/0000']),
    loadJournalIndex: vi.fn().mockResolvedValue(null),
    getSessionIndex: vi.fn().mockResolvedValue(twoSegmentSessionIndex),
    getSegmentManifest: vi.fn((segmentDir: string) =>
      Promise.resolve(segmentManifests[segmentDir]),
    ),
    loadSegmentSnapshot: vi.fn((segmentDir: string) =>
      Promise.resolve(segmentSnapshots[segmentDir]),
    ),
    loadGlobalEventsIndex: vi.fn().mockResolvedValue(null),
    readChunk: vi.fn((_index: number, segmentDir?: string) =>
      Promise.resolve(
        segmentDir === 'segments/0001' ? [] : [makeEvent(1_000_000)],
      ),
    ),
    readLogChunk: vi.fn().mockResolvedValue([]),
    readCheckpoint: vi.fn().mockResolvedValue(null),
  };
}

describe('HistoryController — seek without checkpoint after a playback rollover (task 27)', () => {
  beforeEach(() => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates from the crossed segment snapshot, not segment 0', async () => {
    const controller = new HistoryController();
    const source = makeSegmentedSource();

    await controller.load(source as any, vi.fn() as any);
    await controller.play();

    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(2_000);
    (controller as any).player.tick();
    await vi.waitFor(() =>
      expect((controller as any).segmentDir).toBe('segments/0001'),
    );

    const hydrateSpy = vi.spyOn((controller as any).adapter, 'hydrate');
    await controller.seek(15_000_000);

    expect(hydrateSpy).toHaveBeenCalledWith(
      segmentSnapshots['segments/0001'],
      twoSegmentSessionIndex.startUs,
    );
  });
});
