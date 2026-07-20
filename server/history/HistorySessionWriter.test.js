import { describe, it, expect, vi } from 'vitest';
import * as std from 'std';
import * as os from 'os';
import { HistorySessionWriter } from './HistorySessionWriter.js';

describe('HistorySessionWriter proxy delegation', () => {
  it('delegates writeSnapshot/writeEvent/writeLog/writeCheckpoint to segment 0000', () => {
    const writer = new HistorySessionWriter('test-history', 'sessA');
    const openSpy = vi.spyOn(std, 'open');

    writer.writeSnapshot({ a: 1 });
    writer.writeEvent('{"a":1}', 1000);
    writer.writeLog('{"a":1}', 1000);
    writer.writeCheckpoint(0, { a: 1 });

    const paths = openSpy.mock.calls.map(([path]) => path);
    expect(paths.some((path) => path.endsWith('segments/0000/snapshot.json'))).toBe(true);
    expect(paths.some((path) => path.includes('segments/0000/chunks/chunk_0000.jsonl'))).toBe(true);
    expect(paths.some((path) => path.includes('segments/0000/logs/logs_0000.jsonl'))).toBe(true);
    expect(paths.some((path) => path.includes('segments/0000/checkpoints/cp_0000.json'))).toBe(true);

    openSpy.mockRestore();
  });

  it('exposes the current segment writer chunk/log indexes via delegation', () => {
    const writer = new HistorySessionWriter('test-history', 'sessB');
    writer.writeEvent('{"a":1}', 1000);

    expect(writer.getCurrentChunkIndex()).toBe(writer._segmentWriter.getCurrentChunkIndex());
    expect(writer.getCurrentLogChunkIndex()).toBe(writer._segmentWriter.getCurrentLogChunkIndex());
  });
});

describe('HistorySessionWriter root-level event/journal index', () => {
  it('accumulates addEventIndex/recordJournalFact at the root without touching the segment writer', () => {
    const writer = new HistorySessionWriter('test-history', 'sessC');
    const openSpy = vi.spyOn(std, 'open');

    writer.addEventIndex(1000, 'graph-change');
    writer.recordJournalFact(1000, 1);

    expect(openSpy).not.toHaveBeenCalled();
    expect(writer._eventsIndex).toEqual([{ ts_us: 1000, type: 'graph-change' }]);
    expect(writer._journalTsUs).toEqual([1000]);
    expect(writer._journalTypes).toEqual([1]);
    expect(writer._segmentWriter).toBeNull();

    openSpy.mockRestore();
  });
});

describe('HistorySessionWriter session.json', () => {
  it('describes segment 0 as open (toUs null, done false) while the session is still recording', () => {
    const writer = new HistorySessionWriter('test-history', 'sessD');
    writer.writeEvent('{"a":1}', 1000);

    writer.writeSessionIndex();

    expect(writer._segments).toEqual([
      { index: 0, dir: 'segments/0000', fromUs: 1000, toUs: null, pinned: false, done: false },
    ]);
  });

  it('writes session.json atomically via .tmp + rename', () => {
    const writer = new HistorySessionWriter('test-history', 'sessE');
    writer.writeEvent('{"a":1}', 1000);

    const openSpy = vi.spyOn(std, 'open');
    const renameSpy = vi.spyOn(os, 'rename');

    writer.writeSessionIndex();

    const tmpOpenCall = openSpy.mock.calls.find(([path]) => path.endsWith('session.json.tmp'));
    expect(tmpOpenCall).toBeDefined();

    const renameCall = renameSpy.mock.calls.find(([, dest]) => dest.endsWith('session.json'));
    expect(renameCall).toBeDefined();
    expect(renameCall[0]).toBe(`${renameCall[1]}.tmp`);

    openSpy.mockRestore();
    renameSpy.mockRestore();
  });

  it('marks the current segment done and sets toUs at close', () => {
    const writer = new HistorySessionWriter('test-history', 'sessF');
    writer.writeEvent('{"a":1}', 1000);
    writer.writeEvent('{"a":2}', 2000);

    writer.close();

    expect(writer._segments[0]).toMatchObject({ toUs: 2000, done: true });
  });

  it('does not write events_index.json/journal_index.json when nothing was recorded', () => {
    const writer = new HistorySessionWriter('test-history', 'sessG');
    writer.writeEvent('{"a":1}', 1000);

    const openSpy = vi.spyOn(std, 'open');
    writer.writeSessionIndex();

    const paths = openSpy.mock.calls.map(([path]) => path);
    expect(paths.some((path) => path.endsWith('events_index.json.tmp'))).toBe(false);
    expect(paths.some((path) => path.endsWith('journal_index.json.tmp'))).toBe(false);

    openSpy.mockRestore();
  });
});

describe('HistorySessionWriter segment rollover', () => {
  const DAY_US = 24 * 60 * 60 * 1000 * 1000;

  it('rolls over to segment 1 once 24h have elapsed since segment 0 started, sealing segment 0', () => {
    const writer = new HistorySessionWriter('test-history', 'sessI');

    writer.writeEvent('{"a":1}', 0);
    writer.writeEvent('{"a":2}', DAY_US);

    expect(writer._segments).toEqual([
      { index: 0, dir: 'segments/0000', fromUs: 0, toUs: DAY_US, pinned: false, done: true },
      { index: 1, dir: 'segments/0001', fromUs: DAY_US, toUs: null, pinned: false, done: false },
    ]);
  });

  it('closes segment 0 (manifest + done marker) before creating segment 1', () => {
    const writer = new HistorySessionWriter('test-history', 'sessJ');
    writer.writeEvent('{"a":1}', 0);

    const openSpy = vi.spyOn(std, 'open');
    writer.writeEvent('{"a":2}', DAY_US);

    const paths = openSpy.mock.calls.map(([path]) => path);
    expect(paths.some((path) => path.endsWith('segments/0000/manifest.json.tmp'))).toBe(true);
    expect(paths.some((path) => path.endsWith('segments/0000/done'))).toBe(true);

    openSpy.mockRestore();
  });

  it('writes session.json during rollover', () => {
    const writer = new HistorySessionWriter('test-history', 'sessK');
    writer.writeEvent('{"a":1}', 0);

    const writeSessionIndexSpy = vi.spyOn(writer, 'writeSessionIndex');
    writer.writeEvent('{"a":2}', DAY_US);

    expect(writeSessionIndexSpy).toHaveBeenCalled();
  });

  it('purges the oldest unpinned segment beyond retention.maxSegments, never reusing indices', () => {
    const writer = new HistorySessionWriter('test-history', 'sessL', { retentionMaxSegments: 2 });

    writer.writeEvent('{"a":1}', 0);
    writer.writeEvent('{"a":2}', DAY_US);
    writer.writeEvent('{"a":3}', DAY_US * 2);
    writer.writeEvent('{"a":4}', DAY_US * 3);

    expect(writer._segments.map((segment) => segment.index)).toEqual([2, 3]);
  });

  it('skips retention purge entirely when maxSegments is HISTORY_RETENTION_UNLIMITED', () => {
    const writer = new HistorySessionWriter('test-history', 'sessM', { retentionMaxSegments: -1 });

    writer.writeEvent('{"a":1}', 0);
    writer.writeEvent('{"a":2}', DAY_US);
    writer.writeEvent('{"a":3}', DAY_US * 2);

    expect(writer._segments.map((segment) => segment.index)).toEqual([0, 1, 2]);
  });

  it('rolls over fine with no buildSegmentSnapshot provider (optional)', () => {
    const writer = new HistorySessionWriter('test-history', 'sessN');

    expect(() => {
      writer.writeEvent('{"a":1}', 0);
      writer.writeEvent('{"a":2}', DAY_US);
    }).not.toThrow();
  });

  it('writes the segment snapshot returned by buildSegmentSnapshot into the new segment', () => {
    const buildSegmentSnapshot = vi.fn((rolloverTsUs) => ({ version: 1, ts_us: rolloverTsUs, filters: [] }));
    const writer = new HistorySessionWriter('test-history', 'sessO', { buildSegmentSnapshot });
    writer.writeEvent('{"a":1}', 0);

    const openSpy = vi.spyOn(std, 'open');
    writer.writeEvent('{"a":2}', DAY_US);

    expect(buildSegmentSnapshot).toHaveBeenCalledWith(DAY_US);
    const paths = openSpy.mock.calls.map(([path]) => path);
    expect(paths.some((path) => path.endsWith('segments/0001/snapshot.json'))).toBe(true);

    openSpy.mockRestore();
  });

  it('writes the new segment snapshot before publishing session.json', () => {
    const order = [];
    const buildSegmentSnapshot = vi.fn((rolloverTsUs) => {
      order.push('buildSegmentSnapshot');
      return { version: 1, ts_us: rolloverTsUs, filters: [] };
    });
    const writer = new HistorySessionWriter('test-history', 'sessP', { buildSegmentSnapshot });
    writer.writeEvent('{"a":1}', 0);

    const originalWriteSessionIndex = writer.writeSessionIndex.bind(writer);
    writer.writeSessionIndex = () => { order.push('writeSessionIndex'); originalWriteSessionIndex(); };

    writer.writeEvent('{"a":2}', DAY_US);

    expect(order).toEqual(['buildSegmentSnapshot', 'writeSessionIndex']);
  });
});
