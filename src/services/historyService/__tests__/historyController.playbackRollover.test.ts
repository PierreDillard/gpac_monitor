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

const segment0OneChunk: HistoryManifest = {
  version: 1,
  startUs: 0,
  endUs: 10_000_000,
  chunkDurationUs: 10_000_000,
  chunkCount: 1,
};

const segment1OneChunk: HistoryManifest = {
  version: 1,
  startUs: 10_000_000,
  endUs: 20_000_000,
  chunkDurationUs: 10_000_000,
  chunkCount: 1,
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

function makeSegmentedSource(): HistorySource {
  return {
    sessionId: 'test-session',
    getManifest: vi.fn(),
    loadSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
    loadJournalIndex: vi.fn().mockResolvedValue(null),
    getSessionIndex: vi.fn().mockResolvedValue(twoSegmentSessionIndex),
    getSegmentManifest: vi.fn((segmentDir: string) =>
      Promise.resolve(
        segmentDir === 'segments/0001' ? segment1OneChunk : segment0OneChunk,
      ),
    ),
    loadSegmentSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
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

describe('HistoryController — playback rollover across a segment boundary (task 15 E2)', () => {
  beforeEach(() => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rolls over to segment 1 on waiting, without hydrating baseState', async () => {
    const controller = new HistoryController();
    const source = makeSegmentedSource();

    await controller.load(source as any, vi.fn() as any);
    const adapter = (controller as any).adapter;
    const hydrateSpy = vi.spyOn(adapter, 'hydrate');
    const clearSpy = vi.spyOn(adapter, 'clearTimeSeriesData');

    // Initial play() restarts from idle and hydrates once — not part of what E2 asserts.
    await controller.play();
    hydrateSpy.mockClear();

    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(2_000); // past the only event
    (controller as any).player.tick();

    await vi.waitFor(() =>
      expect(source.getSegmentManifest).toHaveBeenCalledWith('segments/0001'),
    );
    await vi.waitFor(() =>
      expect(source.readChunk).toHaveBeenCalledWith(0, 'segments/0001'),
    );

    expect(hydrateSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('does not roll over on a mid-segment waiting (chunk still preloading)', async () => {
    const twoChunkSegment0: HistoryManifest = {
      version: 1,
      startUs: 0,
      endUs: 10_000_000,
      chunkDurationUs: 5_000_000,
      chunkCount: 2,
    };
    const source: HistorySource = {
      ...makeSegmentedSource(),
      getSegmentManifest: vi.fn((segmentDir: string) =>
        Promise.resolve(
          segmentDir === 'segments/0001' ? segment1OneChunk : twoChunkSegment0,
        ),
      ),
      readChunk: vi.fn((index: number, segmentDir?: string) => {
        if (segmentDir === 'segments/0001') return Promise.resolve([]);
        return Promise.resolve(index === 0 ? [makeEvent(1_000_000)] : []);
      }),
    };

    const controller = new HistoryController();
    await controller.load(source as any, vi.fn() as any);
    await controller.play();

    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(6_000); // past chunk 0's only event
    (controller as any).player.tick();

    // Let the in-flight chunk-1 preload (same segment) settle.
    await vi.waitFor(() =>
      expect(source.readChunk).toHaveBeenCalledWith(1, 'segments/0000'),
    );

    expect(source.getSegmentManifest).not.toHaveBeenCalledWith('segments/0001');
  });
});
