import { describe, it, expect, vi } from 'vitest';
import { HistoryController } from '../historyController';
import type { HistorySource, HistoryManifest } from '../source/types';
import type { HistorySnapshot, SessionStatsEvent } from '../types';

const makeSnapshot = (): HistorySnapshot => ({
  ts_us: 0,
  command_line: null,
  graph_v: 1,
  filters: [],
});

const makeStatsEvent = (ts_us: number): SessionStatsEvent => ({
  ts_us,
  message: 'session_stats',
  all_packets_done: false,
  stats: [],
});

function makeSource(manifest: HistoryManifest): HistorySource {
  return {
    sessionId: 'test-session',
    getManifest: vi.fn().mockResolvedValue(manifest),
    loadSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
    loadJournalIndex: vi.fn().mockResolvedValue(null),
    readChunk: vi.fn().mockResolvedValue([]),
    readLogChunk: vi.fn().mockResolvedValue([]),
    readCheckpoint: vi.fn().mockResolvedValue(null),
  };
}

const oneChunk: HistoryManifest = {
  version: 1,
  startUs: 0,
  endUs: 10_000_000,
  chunkDurationUs: 10_000_000,
  chunkCount: 1,
};

const twoChunks: HistoryManifest = {
  version: 1,
  startUs: 0,
  endUs: 20_000_000,
  chunkDurationUs: 10_000_000,
  chunkCount: 2,
};

describe('HistoryController.seek — stale seek does not clear store', () => {
  it('does not call clearTimeSeriesData when checkpoint seek is superseded (cp path)', async () => {
    const manifest = {
      ...oneChunk,
      checkpoints: [{ chunkIndex: 0, file: 'checkpoints/cp_0000.json' }],
    };
    const controller = new HistoryController();
    const source = makeSource(manifest);
    await controller.load(source as any, vi.fn() as any);

    const adapter = (controller as any).adapter;
    const clearSpy = vi.spyOn(adapter, 'clearTimeSeriesData');

    source.readCheckpoint.mockImplementation(async () => {
      (controller as any).preloader?.invalidate();
      return null;
    });

    await controller.seek(5_000_000);

    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('does not call clearTimeSeriesData when no-checkpoint seek is superseded (!cp path)', async () => {
    const controller = new HistoryController();
    const source = makeSource(oneChunk);
    await controller.load(source as any, vi.fn() as any);

    const adapter = (controller as any).adapter;
    const clearSpy = vi.spyOn(adapter, 'clearTimeSeriesData');

    source.readChunk.mockImplementation(async () => {
      (controller as any).preloader?.invalidate();
      return [];
    });

    await controller.seek(5_000_000);

    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('calls clearTimeSeriesData when seek is not superseded', async () => {
    const controller = new HistoryController();
    const source = makeSource(oneChunk);
    await controller.load(source as any, vi.fn() as any);

    const adapter = (controller as any).adapter;
    const clearSpy = vi.spyOn(adapter, 'clearTimeSeriesData');

    await controller.seek(5_000_000);

    expect(clearSpy).toHaveBeenCalledOnce();
  });
});

describe('HistoryController.seek — chart context at chunk boundary', () => {
  it('flushes prev chunk stats when seeking to exact chunk start (no events before tsUs in current chunk)', async () => {
    const controller = new HistoryController();
    const source = makeSource(twoChunks);
    await controller.load(source as any, vi.fn() as any);

    source.readChunk.mockImplementation(async (index: number) => {
      if (index === 0) return [makeStatsEvent(9_000_000)];
      return []; // chunk 1 has no events at or before its boundary
    });

    const adapter = (controller as any).adapter;
    const flushSpy = vi.spyOn(adapter, 'flush');

    await controller.seek(10_000_000);

    expect(flushSpy).toHaveBeenCalledOnce();
  });

  it('includes event AT tsUs in silent replay, not in player', async () => {
    const controller = new HistoryController();
    const source = makeSource(twoChunks);
    await controller.load(source as any, vi.fn() as any);

    const eventAtBoundary = makeStatsEvent(10_000_000);
    source.readChunk.mockImplementation(async (index: number) => {
      if (index === 1) return [eventAtBoundary];
      return [];
    });

    const adapter = (controller as any).adapter;
    const flushSpy = vi.spyOn(adapter, 'flush');

    await controller.seek(10_000_000);

    expect(flushSpy).toHaveBeenCalledOnce();
  });
});
