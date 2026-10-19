import { describe, it, expect, vi } from 'vitest';
import { SegmentSwitchController } from '../segmentSwitchController';
import type {
  HistoryManifest,
  HistorySessionIndexSegment,
  HistorySource,
} from '../../source/types';
import type { HistorySnapshot } from '../../types';

const targetSegment: HistorySessionIndexSegment = {
  index: 2,
  fromUs: 200_000_000,
};

const manifest: HistoryManifest = {
  version: 1,
  startUs: 200_000_000,
  endUs: 260_000_000,
  chunkDurationUs: 10_000_000,
  chunkCount: 6,
};

const snapshot = {} as HistorySnapshot;

function makeSource(): HistorySource {
  return {
    sessionId: 'session-1',
    loadSnapshot: vi.fn(),
    getManifest: vi.fn(),
    loadJournalIndex: vi.fn(),
    getSessionIndex: vi.fn(),
    getSegmentManifest: vi.fn().mockResolvedValue(manifest),
    loadSegmentSnapshot: vi.fn().mockResolvedValue(snapshot),
    loadGlobalEventsIndex: vi.fn(),
    readChunk: vi.fn(),
    readLogChunk: vi.fn(),
    readCheckpoint: vi.fn(),
  };
}

describe('SegmentSwitchController', () => {
  it('returns a no-op outcome without fetching when the target is already the current segment', async () => {
    const source = makeSource();
    const controller = new SegmentSwitchController(source, () => 0);

    const result = await controller.switchTo(targetSegment, 'segments/0002');

    expect(result).toEqual({ stale: false, changed: false });
    expect(source.getSegmentManifest).not.toHaveBeenCalled();
    expect(source.loadSegmentSnapshot).not.toHaveBeenCalled();
  });

  it('fetches the target manifest and snapshot once when switching segment', async () => {
    const source = makeSource();
    const controller = new SegmentSwitchController(source, () => 0);

    const result = await controller.switchTo(targetSegment, 'segments/0001');

    expect(source.getSegmentManifest).toHaveBeenCalledTimes(1);
    expect(source.getSegmentManifest).toHaveBeenCalledWith('segments/0002');
    expect(source.loadSegmentSnapshot).toHaveBeenCalledTimes(1);
    expect(source.loadSegmentSnapshot).toHaveBeenCalledWith('segments/0002');
    expect(result).toEqual({
      stale: false,
      changed: true,
      manifest,
      snapshot,
      segmentDir: 'segments/0002',
    });
  });

  it('returns stale without rewiring when the version goes stale during the await', async () => {
    let version = 0;
    const source = makeSource();
    (source.getSegmentManifest as ReturnType<typeof vi.fn>).mockImplementation(
      async () => {
        version++;
        return manifest;
      },
    );
    const controller = new SegmentSwitchController(source, () => version);

    const result = await controller.switchTo(targetSegment, 'segments/0001');

    expect(result).toEqual({ stale: true });
    expect(source.loadSegmentSnapshot).not.toHaveBeenCalled();
  });

  it('returns a distinct failed outcome (not a no-op) when getSegmentManifest resolves null', async () => {
    const source = makeSource();
    (source.getSegmentManifest as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );
    const controller = new SegmentSwitchController(source, () => 0);

    const result = await controller.switchTo(targetSegment, 'segments/0001');

    expect(result).toEqual({ stale: false, changed: false, failed: true });
    expect(source.loadSegmentSnapshot).not.toHaveBeenCalled();
  });
});
