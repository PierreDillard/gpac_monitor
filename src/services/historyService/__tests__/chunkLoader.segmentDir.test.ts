import { describe, it, expect, vi } from 'vitest';
import { ChunkLoader } from '../chunkLoader';
import type { HistoryManifest, IChunkReader } from '../source/types';

const manifest: HistoryManifest = {
  version: 1,
  startUs: 0,
  endUs: 40_000_000,
  chunkDurationUs: 10_000_000,
  chunkCount: 4,
  logChunks: [
    { file: 'logs/logs_0001.jsonl', fromUs: 0, toUs: 40_000_000, count: 1 },
  ],
};

function makeReader(): IChunkReader {
  return {
    readChunk: vi.fn().mockResolvedValue([]),
    readLogChunk: vi.fn().mockResolvedValue([]),
    readCheckpoint: vi.fn().mockResolvedValue(null),
  };
}

describe('ChunkLoader — segmentDir propagation', () => {
  it('passes segmentDir to every reader call', async () => {
    const reader = makeReader();
    const loader = new ChunkLoader(reader, manifest, 'segments/0002');

    await loader.loadEventChunk(3);
    await loader.loadCheckpoint('checkpoints/cp_0003.json');
    await loader.loadLogChunksInRange(0, 40_000_000);

    expect(reader.readChunk).toHaveBeenCalledWith(3, 'segments/0002');
    expect(reader.readCheckpoint).toHaveBeenCalledWith(3, 'segments/0002');
    expect(reader.readLogChunk).toHaveBeenCalledWith(1, 'segments/0002');
  });

  it('passes undefined when constructed without segmentDir (legacy path)', async () => {
    const reader = makeReader();
    const loader = new ChunkLoader(reader, manifest);

    await loader.loadEventChunk(3);
    await loader.loadCheckpoint('checkpoints/cp_0003.json');
    await loader.loadLogChunksInRange(0, 40_000_000);

    expect(reader.readChunk).toHaveBeenCalledWith(3, undefined);
    expect(reader.readCheckpoint).toHaveBeenCalledWith(3, undefined);
    expect(reader.readLogChunk).toHaveBeenCalledWith(1, undefined);
  });

  it('accepts a per-call segmentDir override that caches independently from the constructor segmentDir', async () => {
    const reader = makeReader();
    const loader = new ChunkLoader(reader, manifest, 'segments/0002');

    const current = await loader.loadEventChunk(3);
    const fromPrevious = await loader.loadEventChunk(3, 'segments/0001');

    expect(reader.readChunk).toHaveBeenCalledWith(3, 'segments/0002');
    expect(reader.readChunk).toHaveBeenCalledWith(3, 'segments/0001');
    expect(reader.readChunk).toHaveBeenCalledTimes(2);
    expect(current).not.toBe(fromPrevious);

    await loader.loadEventChunk(3);
    await loader.loadEventChunk(3, 'segments/0001');
    expect(reader.readChunk).toHaveBeenCalledTimes(2);
  });
});
