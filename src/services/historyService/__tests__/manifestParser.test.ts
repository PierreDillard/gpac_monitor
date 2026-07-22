import { describe, it, expect } from 'vitest';
import {
  parseManifest,
  getDuration,
  findEventChunkIndex,
  getEventChunkRange,
  getChunkFile,
  findLogChunksInRange,
  findNearestCheckpoint,
} from '../manifestParser';
import type { HistoryManifest } from '../source/types';

const manifest: HistoryManifest = {
  version: 1,
  startUs: 0,
  endUs: 30_000_000,
  chunkDurationUs: 10_000_000,
  chunkCount: 3,
  logChunks: [
    { fromUs: 0, toUs: 5_000_000, file: 'logs/logs_0000.jsonl', count: 50 },
    {
      fromUs: 4_000_000,
      toUs: 9_000_000,
      file: 'logs/logs_0001.jsonl',
      count: 200,
    },
    {
      fromUs: 15_000_000,
      toUs: 25_000_000,
      file: 'logs/logs_0002.jsonl',
      count: 300,
    },
  ],
  checkpoints: [{ chunkIndex: 1, file: 'checkpoints/cp_0001.json' }],
};

// --- getDuration ---

describe('getDuration', () => {
  it('returns endUs - startUs', () => {
    expect(getDuration(manifest)).toBe(30_000_000);
  });
});

// --- findEventChunkIndex ---

describe('findEventChunkIndex', () => {
  it.each([
    [0, 0],
    [5_000_000, 0],
    [9_999_999, 0],
    [10_000_000, 1],
    [19_999_999, 1],
    [20_000_000, 2],
    [35_000_000, 2], // après la fin → clamp au dernier chunk
  ])('ts=%i → index %i', (tsUs, expected) => {
    expect(findEventChunkIndex(manifest, tsUs)).toBe(expected);
  });

  it('clamps negative timestamps to 0', () => {
    expect(findEventChunkIndex(manifest, -1_000_000)).toBe(0);
  });
});

// --- findEventChunkIndex avec eventChunks (régression dérive seek, tâche 20) ---

describe('findEventChunkIndex with recorded eventChunks', () => {
  const driftedManifest: HistoryManifest = {
    ...manifest,
    endUs: 42_000_000,
    chunkCount: 4,
    eventChunks: [
      { fromUs: 0, toUs: 10_500_000, file: 'chunks/chunk_0000.jsonl', count: 21 },
      { fromUs: 11_000_000, toUs: 21_500_000, file: 'chunks/chunk_0001.jsonl', count: 21 },
      { fromUs: 22_000_000, toUs: 32_500_000, file: 'chunks/chunk_0002.jsonl', count: 21 },
      { fromUs: 33_000_000, toUs: 42_000_000, file: 'chunks/chunk_0003.jsonl', count: 18 },
    ],
  };

  it('uses real ranges where the arithmetic grid is already wrong', () => {
    expect(findEventChunkIndex(driftedManifest, 21_000_000)).toBe(1);
    expect(Math.floor(21_000_000 / driftedManifest.chunkDurationUs)).toBe(2);
  });

  it.each([
    [0, 0],
    [10_500_000, 0],
    [11_000_000, 1],
    [21_500_000, 1],
    [32_999_999, 2],
    [42_000_000, 3],
  ])('ts=%i → index %i', (timestampUs, expectedIndex) => {
    expect(findEventChunkIndex(driftedManifest, timestampUs)).toBe(
      expectedIndex,
    );
  });

  it('maps a timestamp inside a gap to the previous chunk', () => {
    expect(findEventChunkIndex(driftedManifest, 10_800_000)).toBe(0);
  });

  it('clamps a timestamp before the first chunk to 0', () => {
    expect(findEventChunkIndex(driftedManifest, -5_000_000)).toBe(0);
  });

  it('clamps a timestamp after the last chunk to the last index', () => {
    expect(findEventChunkIndex(driftedManifest, 99_000_000)).toBe(3);
  });

  it('keeps the arithmetic fallback when eventChunks is absent', () => {
    expect(findEventChunkIndex(manifest, 25_000_000)).toBe(2);
  });
});

// --- getEventChunkRange ---

describe('getEventChunkRange', () => {
  it('returns correct range for each index', () => {
    expect(getEventChunkRange(manifest, 0)).toEqual({
      fromUs: 0,
      toUs: 10_000_000,
    });
    expect(getEventChunkRange(manifest, 1)).toEqual({
      fromUs: 10_000_000,
      toUs: 20_000_000,
    });
    expect(getEventChunkRange(manifest, 2)).toEqual({
      fromUs: 20_000_000,
      toUs: 30_000_000,
    });
  });

  it('clamps toUs to endUs for the last chunk', () => {
    const m: HistoryManifest = { ...manifest, endUs: 28_000_000 };
    expect(getEventChunkRange(m, 2).toUs).toBe(28_000_000);
  });

  it('returns the recorded range when eventChunks is present', () => {
    const withRanges: HistoryManifest = {
      ...manifest,
      eventChunks: [
        { fromUs: 0, toUs: 10_500_000, file: 'chunks/chunk_0000.jsonl', count: 21 },
        { fromUs: 11_000_000, toUs: 21_500_000, file: 'chunks/chunk_0001.jsonl', count: 21 },
      ],
    };
    expect(getEventChunkRange(withRanges, 1)).toEqual({
      fromUs: 11_000_000,
      toUs: 21_500_000,
    });
  });
});

// --- getChunkFile ---

describe('getChunkFile', () => {
  it.each([
    [0, 'chunks/chunk_0000.jsonl'],
    [3, 'chunks/chunk_0003.jsonl'],
    [42, 'chunks/chunk_0042.jsonl'],
    [1000, 'chunks/chunk_1000.jsonl'],
  ])('index %i → %s', (index, expected) => {
    expect(getChunkFile(index)).toBe(expected);
  });
});

// --- findLogChunksInRange ---

describe('findLogChunksInRange', () => {
  it('returns chunks intersecting the range', () => {
    expect(findLogChunksInRange(manifest, 0, 5_000_000)).toHaveLength(2);
  });

  it('returns empty when no log covers the range', () => {
    expect(findLogChunksInRange(manifest, 10_000_000, 14_000_000)).toHaveLength(
      0,
    );
  });

  it('returns [] when logChunks is undefined', () => {
    expect(
      findLogChunksInRange(
        { ...manifest, logChunks: undefined },
        0,
        30_000_000,
      ),
    ).toEqual([]);
  });

  it('handles multiple chunks covering the same time range', () => {
    expect(findLogChunksInRange(manifest, 4_500_000, 5_500_000)).toHaveLength(
      2,
    );
  });
});

// --- findNearestCheckpoint ---

describe('findNearestCheckpoint', () => {
  it('returns null if no checkpoint exists at or before position', () => {
    expect(findNearestCheckpoint(manifest, 0)).toBeNull();
  });

  it('returns checkpoint at exact position', () => {
    expect(findNearestCheckpoint(manifest, 1)?.chunkIndex).toBe(1);
  });

  it('returns the nearest checkpoint before position', () => {
    expect(findNearestCheckpoint(manifest, 2)?.chunkIndex).toBe(1);
  });

  it('returns null when checkpoints is empty', () => {
    expect(
      findNearestCheckpoint({ ...manifest, checkpoints: [] }, 5),
    ).toBeNull();
  });
});

// --- parseManifest ---

describe('parseManifest', () => {
  const validRaw = {
    version: 1,
    startUs: 0,
    endUs: 30_000_000,
    chunkDurationUs: 10_000_000,
    chunkCount: 3,
  };

  it('parses a valid manifest', () => {
    const parsed = parseManifest(validRaw);
    expect(parsed.chunkDurationUs).toBe(10_000_000);
    expect(parsed.chunkCount).toBe(3);
    expect(parsed.logChunks).toEqual([]);
    expect(parsed.checkpoints).toEqual([]);
  });

  it('throws if not an object', () => {
    expect(() => parseManifest(null)).toThrow();
    expect(() => parseManifest('string')).toThrow();
  });

  it('throws on unsupported version', () => {
    expect(() => parseManifest({ ...validRaw, version: 2 })).toThrow();
  });

  it('throws if startUs is not a number', () => {
    expect(() => parseManifest({ ...validRaw, startUs: '0' })).toThrow();
  });

  it('throws if chunkDurationUs is missing', () => {
    const { chunkDurationUs: _, ...raw } = validRaw;
    expect(() => parseManifest(raw)).toThrow(/chunkDurationUs/);
  });

  it('throws if chunkDurationUs <= 0', () => {
    expect(() => parseManifest({ ...validRaw, chunkDurationUs: 0 })).toThrow(
      /chunkDurationUs/,
    );
  });

  it('throws if chunkCount is missing', () => {
    const { chunkCount: _, ...raw } = validRaw;
    expect(() => parseManifest(raw)).toThrow(/chunkCount/);
  });

  it('silently drops invalid logChunks', () => {
    const raw = {
      ...validRaw,
      logChunks: [
        { fromUs: 0, toUs: 5_000_000, file: 'logs.jsonl', count: 1 },
        { fromUs: 0, toUs: 5_000_000, file: 123, count: 1 }, // file invalide
        { fromUs: 5_000_000, toUs: 3_000_000, file: 'b.jsonl', count: 1 }, // fromUs >= toUs
      ],
    };
    expect(parseManifest(raw).logChunks).toHaveLength(1);
  });

  it('parses eventChunks and accepts fromUs === toUs (single-event chunk)', () => {
    const raw = {
      ...validRaw,
      eventChunks: [
        { fromUs: 0, toUs: 10_500_000, file: 'chunks/chunk_0000.jsonl', count: 21 },
        { fromUs: 11_000_000, toUs: 11_000_000, file: 'chunks/chunk_0001.jsonl', count: 1 },
      ],
    };
    expect(parseManifest(raw).eventChunks).toHaveLength(2);
  });

  it('drops eventChunks entirely if any entry is invalid (positions are chunk indexes)', () => {
    const raw = {
      ...validRaw,
      eventChunks: [
        { fromUs: 0, toUs: 10_500_000, file: 'chunks/chunk_0000.jsonl', count: 21 },
        { fromUs: 11_000_000, toUs: 21_500_000, file: 123, count: 21 },
      ],
    };
    expect(parseManifest(raw).eventChunks).toBeUndefined();
  });

  it('leaves eventChunks undefined for a legacy manifest', () => {
    expect(parseManifest(validRaw).eventChunks).toBeUndefined();
  });

  it('silently drops invalid checkpoints', () => {
    const raw = {
      ...validRaw,
      checkpoints: [
        { chunkIndex: 0, file: 'cp_0000.json' },
        { chunkIndex: '0', file: 'cp_bad.json' },
        { file: 'cp_noindex.json' },
      ],
    };
    expect(parseManifest(raw).checkpoints).toHaveLength(1);
  });
});
