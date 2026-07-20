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
