import { describe, it, expect, vi } from 'vitest';
import * as std from 'std';
import { ChunkStream } from './ChunkStream.js';

describe('ChunkStream open chunk visibility', () => {
  it('does not list the currently open chunk while recording', () => {
    const stream = new ChunkStream('logs', 'logs', 1000000);
    stream.write('{"a":1}', 1000);
    stream.write('{"a":2}', 2000);

    expect(stream.getAllChunks()).toEqual([]);
  });

  it('lists a chunk once it rotates', () => {
    const stream = new ChunkStream('logs', 'logs', 1000);
    stream.write('{"a":1}', 0);
    stream.write('{"a":2}', 1000);

    const chunks = stream.getAllChunks();
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ file: 'logs/logs_0000.jsonl', fromUs: 0, toUs: 1000, count: 2 });
  });

  it('finalizes the open chunk on close with its exact count', () => {
    const stream = new ChunkStream('logs', 'logs', 1000000);
    stream.write('{"a":1}', 1000);
    stream.write('{"a":2}', 2000);
    stream.write('{"a":3}', 3000);

    stream.close();

    const chunks = stream.getAllChunks();
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ file: 'logs/logs_0000.jsonl', fromUs: 1000, toUs: 3000, count: 3 });
  });

  it('does not add an entry on close when nothing was ever written to the open chunk', () => {
    const stream = new ChunkStream('logs', 'logs', 1000);
    stream.write('{"a":1}', 0);
    stream.write('{"a":2}', 1000);
    stream.close();

    expect(stream.getAllChunks()).toHaveLength(1);
  });

  it('getAllChunksIncludingOpen lists the open chunk while recording', () => {
    const stream = new ChunkStream('logs', 'logs', 1000000);
    stream.write('{"a":1}', 1000);
    stream.write('{"a":2}', 2000);

    expect(stream.getAllChunks()).toEqual([]);
    expect(stream.getAllChunksIncludingOpen()).toEqual([
      { file: 'logs/logs_0000.jsonl', fromUs: 1000, toUs: 2000, count: 2 },
    ]);
  });

  it('getAllChunksIncludingOpen matches getAllChunks after close (no duplicate)', () => {
    const stream = new ChunkStream('logs', 'logs', 1000000);
    stream.write('{"a":1}', 1000);
    stream.close();

    expect(stream.getAllChunksIncludingOpen()).toEqual(stream.getAllChunks());
    expect(stream.getAllChunks()).toHaveLength(1);
  });

  it('does not throw when the underlying directory cannot be opened (bad -rmt-log path)', () => {
    const openSpy = vi.spyOn(std, 'open').mockReturnValue(null);
    const stream = new ChunkStream('missing/dir', 'chunk', 1000);

    expect(() => stream.write('{"a":1}', 0)).not.toThrow();
    expect(stream.getAllChunks()).toEqual([]);

    openSpy.mockRestore();
  });
});
