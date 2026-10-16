import { describe, it, expect, vi } from 'vitest';
import { HistoryController } from '../historyController';
import type {
  HistorySource,
  HistoryManifest,
  HistorySessionIndex,
} from '../source/types';
import type { HistorySnapshot, JournalIndex } from '../types';

const snapshot: HistorySnapshot = {
  ts_us: 10_000_000,
  command_line: null,
  graph_v: 1,
  filters: [],
};

const retainedSegmentManifest: HistoryManifest = {
  version: 1,
  startUs: 10_000_000,
  endUs: 20_000_000,
  chunkDurationUs: 10_000_000,
  chunkCount: 1,
};

const sessionIndexAfterPurge: HistorySessionIndex = {
  version: 1,
  startUs: 0,
  endUs: 20_000_000,
  segmentDurationUs: 10_000_000,
  retentionMaxSegments: 1,
  segments: [{ index: 1, fromUs: 10_000_000 }],
};

const journalIndex: JournalIndex = {
  baseTsUs: 0,
  tsDeltaUs: [4_000_000, 14_000_000],
  types: [1, 2],
};

function makeSource(): HistorySource {
  return {
    sessionId: 'test-session',
    getManifest: vi.fn(),
    loadSnapshot: vi.fn().mockResolvedValue(snapshot),
    loadJournalIndex: vi.fn().mockResolvedValue(journalIndex),
    getSessionIndex: vi.fn().mockResolvedValue(sessionIndexAfterPurge),
    getSegmentManifest: vi.fn().mockResolvedValue(retainedSegmentManifest),
    loadSegmentSnapshot: vi.fn().mockResolvedValue(snapshot),
    loadGlobalEventsIndex: vi.fn().mockResolvedValue([
      { ts_us: 5_000_000, type: 'graph-change' },
      { ts_us: 15_000_000, type: 'pid-reconfig' },
    ]),
    readChunk: vi.fn().mockResolvedValue([]),
    readLogChunk: vi.fn().mockResolvedValue([]),
    readCheckpoint: vi.fn().mockResolvedValue(null),
  } as HistorySource;
}

describe('HistoryController — timeline markers after segment retention', () => {
  it('drops markers that belong to purged segments', async () => {
    const controller = new HistoryController();

    await controller.load(makeSource(), vi.fn() as any);

    const markerTimesUs = controller
      .getTimelineEvents()
      .map((event) => event.absoluteTimeUs);
    expect(markerTimesUs).toEqual([14_000_000, 15_000_000]);
  });
});
