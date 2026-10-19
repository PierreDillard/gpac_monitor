import { describe, it, expect, vi } from 'vitest';
import { ChunkLoader } from '../chunkLoader';
import type { HistoryManifest, IChunkReader } from '../source/types';
import type { HistoryEvent } from '../types';

const manifest: HistoryManifest = {
  version: 1,
  startUs: 0,
  endUs: 20_000_000,
  chunkDurationUs: 10_000_000,
  chunkCount: 2,
};

const cpuEvent = {
  version: 1,
  ts_us: 1_000_000,
  message: 'cpu_stats',
  stats: {},
} as unknown as HistoryEvent;

describe('ChunkLoader.loadEventChunk — failed read', () => {
  it('rereads the source after a failed read instead of serving a cached empty chunk', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reader: IChunkReader = {
      readChunk: vi
        .fn()
        .mockRejectedValueOnce(new Error('transient WS failure'))
        .mockResolvedValueOnce([cpuEvent]),
      readLogChunk: vi.fn().mockResolvedValue([]),
      readCheckpoint: vi.fn().mockResolvedValue(null),
    };
    const loader = new ChunkLoader(reader, manifest);

    await loader.loadEventChunk(0);
    const retried = await loader.loadEventChunk(0);

    expect(retried.events).toEqual([cpuEvent]);
    expect(reader.readChunk).toHaveBeenCalledTimes(2);
  });
});
