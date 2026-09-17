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

describe('HistoryController — sessionTimeUs continuity across 2+ segment boundaries (task 15 E3)', () => {
  beforeEach(() => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const threeSegmentSessionIndex: HistorySessionIndex = {
    version: 1,
    startUs: 0,
    segmentDurationUs: 10_000_000,
    retentionMaxSegments: 3,
    segments: [
      { index: 0, fromUs: 0 },
      { index: 1, fromUs: 10_000_000 },
      { index: 2, fromUs: 20_000_000 },
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
    'segments/0002': {
      version: 1,
      startUs: 20_000_000,
      endUs: 30_000_000,
      chunkDurationUs: 10_000_000,
      chunkCount: 1,
    },
  };

  // One event per segment, each timestamped inside that segment's own [startUs, endUs).
  const segmentEventUs: Record<string, number> = {
    'segments/0000': 1_000_000,
    'segments/0001': 11_000_000,
    'segments/0002': 21_000_000,
  };

  function makeThreeSegmentSource(): HistorySource {
    return {
      sessionId: 'test-session',
      getManifest: vi.fn(),
      loadSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
      loadJournalIndex: vi.fn().mockResolvedValue(null),
      getSessionIndex: vi.fn().mockResolvedValue(threeSegmentSessionIndex),
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

  it('keeps sessionStartUs rooted at sessionIndex.startUs, never the crossed segment startUs', async () => {
    const controller = new HistoryController();
    const source = makeThreeSegmentSource();

    await controller.load(source as any, vi.fn() as any);
    const rootSessionStartUs = controller.getSessionStartUs();
    expect(rootSessionStartUs).toBe(threeSegmentSessionIndex.startUs);

    await controller.play();

    // Cross boundary 0 -> 1: past segment 0's only event.
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(2_000);
    (controller as any).player.tick();
    await vi.waitFor(() =>
      expect(source.getSegmentManifest).toHaveBeenCalledWith('segments/0001'),
    );
    await vi.waitFor(() =>
      expect(source.readChunk).toHaveBeenCalledWith(0, 'segments/0001'),
    );
    expect(controller.getSessionStartUs()).toBe(rootSessionStartUs);
    expect(controller.getSessionStartUs()).not.toBe(
      segmentManifests['segments/0001'].startUs,
    );

    // Cross boundary 1 -> 2: past segment 1's only event.
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(10_000);
    (controller as any).player.tick();
    await vi.waitFor(() =>
      expect(source.getSegmentManifest).toHaveBeenCalledWith('segments/0002'),
    );
    await vi.waitFor(() =>
      expect(source.readChunk).toHaveBeenCalledWith(0, 'segments/0002'),
    );
    expect(controller.getSessionStartUs()).toBe(rootSessionStartUs);
    expect(controller.getSessionStartUs()).not.toBe(
      segmentManifests['segments/0002'].startUs,
    );
  });

  it('advances currentTimeUs monotonically, without any backward jump, across 2 boundaries', async () => {
    const controller = new HistoryController();
    const source = makeThreeSegmentSource();

    await controller.load(source as any, vi.fn() as any);
    await controller.play();

    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(2_000);
    (controller as any).player.tick();
    await vi.waitFor(() =>
      expect(source.readChunk).toHaveBeenCalledWith(0, 'segments/0001'),
    );
    const timeAtBoundary1 = controller.currentTimeUs();

    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(10_000);
    (controller as any).player.tick();
    await vi.waitFor(() =>
      expect(source.readChunk).toHaveBeenCalledWith(0, 'segments/0002'),
    );
    const timeAtBoundary2 = controller.currentTimeUs();

    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(20_000);
    (controller as any).player.tick();
    const timeAfterSegment2Event = controller.currentTimeUs();

    expect(timeAtBoundary1).toBe(segmentEventUs['segments/0000'] + 2_000_000);
    expect(timeAtBoundary2).toBeGreaterThan(timeAtBoundary1);
    expect(timeAfterSegment2Event).toBeGreaterThan(timeAtBoundary2);
    expect(timeAfterSegment2Event).toBe(segmentEventUs['segments/0002']);
  });
});
