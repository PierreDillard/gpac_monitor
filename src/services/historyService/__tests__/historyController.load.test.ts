import { describe, it, expect, vi } from 'vitest';
import { HistoryController } from '../historyController';
import type { HistorySource, HistoryManifest } from '../source/types';
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
});
