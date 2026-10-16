import { describe, it, expect, vi, afterEach } from 'vitest';
import * as std from 'std';
import * as os from 'os';
import { HistorySessionWriter } from './HistorySessionWriter.js';

const DAY_US = 24 * 60 * 60 * 1000 * 1000;

function captureWrites() {
  const written = {};
  const flushCounts = {};
  vi.spyOn(std, 'open').mockImplementation((path) => {
    written[path] = '';
    flushCounts[path] = 0;
    return {
      puts: (content) => { written[path] += content; },
      flush: () => { flushCounts[path]++; },
      close: () => {},
    };
  });
  vi.spyOn(os, 'rename').mockReturnValue(0);
  return { written, flushCounts };
}

function openCount(path) {
  return std.open.mock.calls.filter(([openedPath]) => openedPath === path).length;
}

describe('HistorySessionWriter torn session (no close, no rollover)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes session.json listing segment 0 from the first event', () => {
    const { written } = captureWrites();
    const writer = new HistorySessionWriter('test-history', 'tornA');

    writer.writeEvent('{"a":1}', 5000);
    writer.writeEvent('{"a":2}', 6000);

    const sessionIndex = JSON.parse(written['test-history/tornA/session.json.tmp']);
    expect(sessionIndex.startUs).toBe(5000);
    expect(sessionIndex.segments).toEqual([{ index: 0, fromUs: 5000 }]);
    expect(sessionIndex).not.toHaveProperty('endUs');
  });

  it('writes each marker to its root JSONL index without close, and session.json only once', () => {
    const { written } = captureWrites();
    const writer = new HistorySessionWriter('test-history', 'tornB');

    writer.addEventIndex(1000, 'graph-change');
    writer.recordJournalFact(1000, 1);
    for (let second = 0; second < 60; second++) writer.writeLog('{"l":1}', second * 1000 * 1000);

    expect(openCount('test-history/tornB/session.json.tmp')).toBe(1);
    expect(written['test-history/tornB/events_index.jsonl']).toBe('{"ts_us":1000,"type":"graph-change"}\n');
    expect(written['test-history/tornB/journal_index.jsonl']).toBe('{"ts_us":1000,"type":1}\n');
  });

  it('flushes a burst of markers once, at the next writeLog', () => {
    const { written, flushCounts } = captureWrites();
    const writer = new HistorySessionWriter('test-history', 'tornC');

    for (let index = 0; index < 50; index++) writer.addEventIndex(1000 + index, 'pid-reconfig');
    writer.writeLog('{"l":1}', 2000);
    writer.writeLog('{"l":2}', 3000);

    const lines = written['test-history/tornC/events_index.jsonl'].trim().split('\n');
    expect(lines).toHaveLength(50);
    expect(flushCounts['test-history/tornC/events_index.jsonl']).toBe(1);
  });

  it('neither reopens nor rewrites a root index at rollover', () => {
    const { written } = captureWrites();
    const writer = new HistorySessionWriter('test-history', 'tornD');

    writer.addEventIndex(0, 'graph-change');
    writer.writeEvent('{"a":1}', 0);
    writer.writeEvent('{"a":2}', DAY_US);
    writer.addEventIndex(DAY_US, 'args-change');

    expect(writer._segments).toHaveLength(2);
    expect(openCount('test-history/tornD/events_index.jsonl')).toBe(1);
    expect(written['test-history/tornD/events_index.jsonl'].trim().split('\n')).toHaveLength(2);
  });
});
