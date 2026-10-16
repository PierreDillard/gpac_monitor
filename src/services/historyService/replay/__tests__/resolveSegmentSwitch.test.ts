import { describe, it, expect, vi } from 'vitest';
import { resolveSegmentSwitch } from '../resolveSegmentSwitch';
import { ChunkPreloadController } from '../chunkPreloadController';
import type {
  AppendLogsCallback,
  PlayerInterface,
} from '../chunkPreloadController';
import type {
  HistoryManifest,
  HistorySessionIndex,
  HistorySource,
} from '../../source/types';
import type { HistorySnapshot } from '../../types';

const fakeManifest: HistoryManifest = {
  version: 1,
  startUs: 0,
  endUs: 60_000_000,
  chunkDurationUs: 10_000_000,
  chunkCount: 6,
};

const targetManifest: HistoryManifest = {
  version: 1,
  startUs: 60_000_000,
  endUs: 120_000_000,
  chunkDurationUs: 10_000_000,
  chunkCount: 6,
};

const snapshot = {} as HistorySnapshot;

const player: PlayerInterface = {
  append: vi.fn(),
  setAwaitingMoreEvents: vi.fn(),
};
const appendLogs: AppendLogsCallback = vi.fn().mockResolvedValue(undefined);

function makePreloader(): ChunkPreloadController {
  return new ChunkPreloadController(
    { loadEventChunk: vi.fn() } as any,
    fakeManifest,
    player,
    appendLogs,
  );
}

function makeSource(): HistorySource {
  return {
    sessionId: 'session-1',
    loadSnapshot: vi.fn(),
    getManifest: vi.fn(),
    loadJournalIndex: vi.fn(),
    getSessionIndex: vi.fn(),
    getSegmentManifest: vi.fn().mockResolvedValue(targetManifest),
    loadSegmentSnapshot: vi.fn().mockResolvedValue(snapshot),
    loadGlobalEventsIndex: vi.fn(),
    readChunk: vi.fn(),
    readLogChunk: vi.fn(),
    readCheckpoint: vi.fn(),
  };
}

const sessionIndex: HistorySessionIndex = {
  version: 1,
  startUs: 0,
  segmentDurationUs: 60_000_000,
  retentionMaxSegments: 30,
  segments: [
    { index: 0, fromUs: 0, toUs: 60_000_000 },
    { index: 1, fromUs: 60_000_000 },
  ],
};

describe('resolveSegmentSwitch', () => {
  it('returns unchanged without fetching when there is no sessionIndex (legacy)', async () => {
    const source = makeSource();
    const preloader = makePreloader();

    const result = await resolveSegmentSwitch({
      sessionIndex: null,
      source,
      tsUs: 5_000_000,
      segmentDir: undefined,
      preloader,
      player,
      appendLogs,
    });

    expect(result).toEqual({ stale: false, changed: false });
    expect(source.getSegmentManifest).not.toHaveBeenCalled();
  });

  it('returns unchanged without fetching when tsUs stays in the current segment', async () => {
    const source = makeSource();
    const preloader = makePreloader();

    const result = await resolveSegmentSwitch({
      sessionIndex,
      source,
      tsUs: 5_000_000,
      segmentDir: 'segments/0000',
      preloader,
      player,
      appendLogs,
    });

    expect(result).toEqual({ stale: false, changed: false });
    expect(source.getSegmentManifest).not.toHaveBeenCalled();
  });

  it('returns the new manifest/loader/preloader/snapshot when crossing into another segment', async () => {
    const source = makeSource();
    const preloader = makePreloader();

    const result = await resolveSegmentSwitch({
      sessionIndex,
      source,
      tsUs: 65_000_000,
      segmentDir: 'segments/0000',
      preloader,
      player,
      appendLogs,
    });

    expect(source.getSegmentManifest).toHaveBeenCalledWith('segments/0001');
    expect(source.loadSegmentSnapshot).toHaveBeenCalledWith('segments/0001');
    expect(result.stale).toBe(false);
    if (!result.stale && result.changed) {
      expect(result.manifest).toBe(targetManifest);
      expect(result.snapshot).toBe(snapshot);
      expect(result.segmentDir).toBe('segments/0001');
      expect(result.preloader).toBeInstanceOf(ChunkPreloadController);
    } else {
      throw new Error('expected a changed result');
    }
  });

  it('reports stale when the preloader version moves during the switch', async () => {
    const source = makeSource();
    const preloader = makePreloader();
    (source.getSegmentManifest as ReturnType<typeof vi.fn>).mockImplementation(
      async () => {
        preloader.invalidate();
        return targetManifest;
      },
    );

    const result = await resolveSegmentSwitch({
      sessionIndex,
      source,
      tsUs: 65_000_000,
      segmentDir: 'segments/0000',
      preloader,
      player,
      appendLogs,
    });

    expect(result).toEqual({ stale: true });
    expect(source.loadSegmentSnapshot).not.toHaveBeenCalled();
  });
});
