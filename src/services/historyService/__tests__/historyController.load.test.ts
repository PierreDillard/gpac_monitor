import { describe, it, expect, vi } from 'vitest';
import { HistoryController } from '../historyController';
import type {
  HistorySource,
  HistoryManifest,
  HistorySessionIndex,
} from '../source/types';
import type { HistorySnapshot } from '../types';

const makeManifest = (): HistoryManifest => ({
  version: 1,
  startUs: 0,
  endUs: 10_000_000,
  chunkDurationUs: 10_000_000,
  chunkCount: 1,
});

const makeSnapshot = (): HistorySnapshot => ({
  ts_us: 0,
  command_line: null,
  graph_v: 1,
  filters: [],
});

function makeSource(): HistorySource {
  return {
    sessionId: 'test-session',
    getManifest: vi.fn().mockResolvedValue(makeManifest()),
    loadSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
    loadJournalIndex: vi.fn().mockResolvedValue(null),
    getSessionIndex: vi.fn().mockResolvedValue(null),
    getSegmentManifest: vi.fn(),
    loadSegmentSnapshot: vi.fn(),
    loadGlobalEventsIndex: vi.fn().mockResolvedValue(null),
    readChunk: vi.fn(),
    readLogChunk: vi.fn(),
    readCheckpoint: vi.fn(),
  };
}

describe('HistoryController.load', () => {
  it('reads manifest and snapshot, never reads chunks or logs', async () => {
    const controller = new HistoryController();
    const source = makeSource();
    const dispatch = vi.fn();

    await controller.load(source, dispatch as any);

    expect(source.getManifest).toHaveBeenCalledOnce();
    expect(source.loadSnapshot).toHaveBeenCalledOnce();

    expect(source.readChunk).not.toHaveBeenCalled();
    expect(source.readLogChunk).not.toHaveBeenCalled();
    expect(source.readCheckpoint).not.toHaveBeenCalled();
  });

  it('segmented session loads the first segment manifest and snapshot', async () => {
    const controller = new HistoryController();
    const source = makeSource();
    const sessionIndex: HistorySessionIndex = {
      version: 1,
      startUs: 0,
      segmentDurationUs: 10_000_000,
      retentionMaxSegments: 3,
      segments: [{ index: 0, fromUs: 0 }],
    };
    source.getSessionIndex = vi.fn().mockResolvedValue(sessionIndex);
    source.getSegmentManifest = vi.fn().mockResolvedValue(makeManifest());
    source.loadSegmentSnapshot = vi.fn().mockResolvedValue(makeSnapshot());
    const dispatch = vi.fn();

    await controller.load(source, dispatch as any);

    expect(source.getSegmentManifest).toHaveBeenCalledOnce();
    expect(source.getSegmentManifest).toHaveBeenCalledWith('segments/0000');
    expect(source.loadSegmentSnapshot).toHaveBeenCalledOnce();
    expect(source.loadSegmentSnapshot).toHaveBeenCalledWith('segments/0000');
    expect(source.getManifest).not.toHaveBeenCalled();
    expect(source.loadSnapshot).not.toHaveBeenCalled();
  });
});

describe('HistoryController.durationUs', () => {
  it('legacy session: endUs - startUs from the manifest', async () => {
    const controller = new HistoryController();
    const source = makeSource();

    await controller.load(source, vi.fn() as any);

    expect(controller.durationUs()).toBe(10_000_000);
  });

  it('closed segmented session: total duration across segments', async () => {
    const controller = new HistoryController();
    const source = makeSource();
    const sessionIndex: HistorySessionIndex = {
      version: 1,
      startUs: 0,
      endUs: 25_000_000,
      segmentDurationUs: 10_000_000,
      retentionMaxSegments: 3,
      segments: [
        { index: 0, fromUs: 0, toUs: 10_000_000 },
        { index: 1, fromUs: 10_000_000 },
      ],
    };
    source.getSessionIndex = vi.fn().mockResolvedValue(sessionIndex);
    source.getSegmentManifest = vi.fn().mockResolvedValue(makeManifest());
    source.loadSegmentSnapshot = vi.fn().mockResolvedValue(makeSnapshot());

    await controller.load(source, vi.fn() as any);

    expect(controller.durationUs()).toBe(25_000_000);
  });

  it('open segmented session: finite bound from last segment + segmentDurationUs', async () => {
    const controller = new HistoryController();
    const source = makeSource();
    const sessionIndex: HistorySessionIndex = {
      version: 1,
      startUs: 0,
      segmentDurationUs: 10_000_000,
      retentionMaxSegments: 3,
      segments: [
        { index: 0, fromUs: 0, toUs: 10_000_000 },
        { index: 1, fromUs: 10_000_000 },
      ],
    };
    source.getSessionIndex = vi.fn().mockResolvedValue(sessionIndex);
    source.getSegmentManifest = vi.fn().mockResolvedValue(makeManifest());
    source.loadSegmentSnapshot = vi.fn().mockResolvedValue(makeSnapshot());

    await controller.load(source, vi.fn() as any);

    expect(controller.durationUs()).toBe(20_000_000);
  });
});
