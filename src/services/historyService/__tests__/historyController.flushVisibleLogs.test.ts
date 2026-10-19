import { describe, it, expect, vi } from 'vitest';
import { HistoryController } from '../historyController';
import type { HistorySource, HistoryManifest } from '../source/types';
import type { HistorySnapshot, LogEvent } from '../types';

const makeSnapshot = (): HistorySnapshot => ({
  ts_us: 0,
  command_line: null,
  graph_v: 1,
  filters: [],
});

function makeSource(manifest: HistoryManifest): HistorySource {
  return {
    sessionId: 'test-session',
    getManifest: vi.fn().mockResolvedValue(manifest),
    loadSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
    loadJournalIndex: vi.fn().mockResolvedValue(null),
    getSessionIndex: vi.fn().mockResolvedValue(null),
    getSegmentManifest: vi.fn(),
    loadSegmentSnapshot: vi.fn(),
    loadGlobalEventsIndex: vi.fn().mockResolvedValue(null),
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

function makeLogEvent(ts_us: number): LogEvent {
  return {
    message: 'log_batch',
    ts_us,
    logs: [
      {
        timestamp: ts_us,
        tool: 'core',
        level: 1,
        message: `line at ${ts_us}`,
        thread_id: -1,
        caller: null,
      },
    ],
  };
}

describe('HistoryController.flushVisibleLogs — no dispatch-count cap', () => {
  it('dispatches every due log line in a single handleLogEvents call, however many are due', async () => {
    const controller = new HistoryController();
    const source = makeSource(oneChunk);
    await controller.load(source as any, vi.fn() as any);

    const dueCount = 120; // well above the old 50-per-tick cap
    const sessionLogs = Array.from({ length: dueCount }, (_, index) =>
      makeLogEvent(index * 1000),
    );
    (controller as any).sessionLogs = sessionLogs;
    (controller as any).nextLogIndex = 0;

    const adapter = (controller as any).adapter;
    const handleLogEventsSpy = vi.spyOn(adapter, 'handleLogEvents');

    (controller as any).flushVisibleLogs(sessionLogs[dueCount - 1].ts_us);

    expect(handleLogEventsSpy).toHaveBeenCalledOnce();
    expect(handleLogEventsSpy.mock.calls[0][0]).toHaveLength(dueCount);
    expect((controller as any).nextLogIndex).toBe(dueCount);
  });

  it('does not call handleLogEvents when no log is due yet', async () => {
    const controller = new HistoryController();
    const source = makeSource(oneChunk);
    await controller.load(source as any, vi.fn() as any);

    (controller as any).sessionLogs = [makeLogEvent(5_000_000)];
    (controller as any).nextLogIndex = 0;

    const adapter = (controller as any).adapter;
    const handleLogEventsSpy = vi.spyOn(adapter, 'handleLogEvents');

    (controller as any).flushVisibleLogs(1_000_000);

    expect(handleLogEventsSpy).not.toHaveBeenCalled();
  });
});
