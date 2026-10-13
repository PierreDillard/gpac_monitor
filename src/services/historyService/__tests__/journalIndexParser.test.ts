import { describe, it, expect } from 'vitest';
import {
  parseJournalIndexPointer,
  parseJournalIndex,
  parseJournalJsonl,
} from '../journalIndexParser';

describe('parseJournalIndexPointer', () => {
  it('parses a well-formed pointer', () => {
    const data = {
      journalIndex: {
        file: 'journal_index.json',
        format: 'columnar-delta-v1',
        eventCount: 3,
        errorCount: 2,
        warningCount: 1,
      },
    };

    expect(parseJournalIndexPointer(data)).toEqual(data.journalIndex);
  });

  it('returns undefined when absent (no errors ever recorded)', () => {
    expect(parseJournalIndexPointer({})).toBeUndefined();
  });

  it('returns undefined when malformed (missing errorCount)', () => {
    const data = {
      journalIndex: {
        file: 'journal_index.json',
        format: 'columnar-delta-v1',
        eventCount: 3,
        warningCount: 1,
      },
    };

    expect(parseJournalIndexPointer(data)).toBeUndefined();
  });
});

describe('parseJournalIndex', () => {
  it('parses a well-formed columnar index', () => {
    const raw = {
      baseTsUs: 1523463,
      tsDeltaUs: [0, 15, 4222],
      types: [1, 2, 1],
    };

    expect(parseJournalIndex(raw)).toEqual(raw);
  });

  it('returns null when a column is missing', () => {
    const raw = { baseTsUs: 1523463, tsDeltaUs: [0] };

    expect(parseJournalIndex(raw)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(parseJournalIndex(null)).toBeNull();
  });

  it('still parses a legacy 6-column recording, ignoring the retired extra fields', () => {
    const raw = {
      baseTsUs: 1523463,
      tsDeltaUs: [0, 15],
      types: [1, 2],
      levels: [1, 2],
      chunkIndexes: [0, 0],
      batchTsUs: [1533744, 1533744],
      indexInBatch: [0, 1],
    };

    expect(parseJournalIndex(raw)).toEqual({
      baseTsUs: 1523463,
      tsDeltaUs: [0, 15],
      types: [1, 2],
    });
  });
});

describe('parseJournalJsonl', () => {
  it('converts one line per fact into the columnar index', () => {
    const text = '{"ts_us":1523463,"type":1}\n{"ts_us":1523478,"type":2}\n';

    expect(parseJournalJsonl(text)).toEqual({
      baseTsUs: 1523463,
      tsDeltaUs: [0, 15],
      types: [1, 2],
    });
  });

  it('skips an invalid line and a truncated last line', () => {
    const text =
      '{"ts_us":1523463,"type":1}\n{"ts_us":1523470,"type":"error"}\n{"ts_us":1527685,"type":1}\n{"ts_us":15';

    expect(parseJournalJsonl(text)).toEqual({
      baseTsUs: 1523463,
      tsDeltaUs: [0, 4222],
      types: [1, 1],
    });
  });

  it('returns null when no line is usable', () => {
    expect(parseJournalJsonl('')).toBeNull();
  });
});
