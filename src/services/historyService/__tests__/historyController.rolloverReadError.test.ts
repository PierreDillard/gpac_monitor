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

const segmentManifest = (startUs: number): HistoryManifest => ({
  version: 1,
  startUs,
  endUs: startUs + 10_000_000,
  chunkDurationUs: 10_000_000,
  chunkCount: 1,
});

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

function makeSource(overrides: Partial<HistorySource> = {}): HistorySource {
  return {
    sessionId: 'test-session',
    getManifest: vi.fn(),
    loadSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
    loadJournalIndex: vi.fn().mockResolvedValue(null),
    getSessionIndex: vi.fn().mockResolvedValue(twoSegmentSessionIndex),
    getSegmentManifest: vi.fn((segmentDir: string) =>
      Promise.resolve(
        segmentManifest(segmentDir === 'segments/0001' ? 10_000_000 : 0),
      ),
    ),
    loadSegmentSnapshot: vi.fn((segmentDir: string) =>
      segmentDir === 'segments/0001'
        ? Promise.reject(new Error('snapshot unreadable'))
        : Promise.resolve(makeSnapshot()),
    ),
    loadGlobalEventsIndex: vi.fn().mockResolvedValue(null),
    readChunk: vi.fn((_index: number, segmentDir?: string) =>
      Promise.resolve(
        segmentDir === 'segments/0001' ? [] : [makeEvent(1_000_000)],
      ),
    ),
    readLogChunk: vi.fn().mockResolvedValue([]),
    readCheckpoint: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as HistorySource;
}

async function playPastSegmentEnd(source: HistorySource) {
  const controller = new HistoryController();
  const onChunkUnreadable = vi.fn();
  controller.setNotificationHandlers({ onChunkUnreadable });
  await controller.load(source as any, vi.fn() as any);
  await controller.play();
  (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(2_000);
  (controller as any).player.tick();
  return onChunkUnreadable;
}

describe('HistoryController — rollover when the next segment cannot be read', () => {
  beforeEach(() => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports an unreadable next-segment snapshot instead of rejecting', async () => {
    const onChunkUnreadable = await playPastSegmentEnd(makeSource());

    await vi.waitFor(() => expect(onChunkUnreadable).toHaveBeenCalled());
  });

  it('reports a missing next-segment manifest without reading its snapshot', async () => {
    const source = makeSource({
      getSegmentManifest: vi.fn((segmentDir: string) =>
        Promise.resolve(
          segmentDir === 'segments/0001' ? null : segmentManifest(0),
        ),
      ),
    });
    const onChunkUnreadable = await playPastSegmentEnd(source);

    await vi.waitFor(() => expect(onChunkUnreadable).toHaveBeenCalled());
    expect(source.loadSegmentSnapshot).not.toHaveBeenCalledWith(
      'segments/0001',
    );
  });
});
