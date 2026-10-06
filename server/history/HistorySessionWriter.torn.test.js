import { describe, it, expect, vi, afterEach } from 'vitest';
import * as std from 'std';
import * as os from 'os';
import { HistorySessionWriter } from './HistorySessionWriter.js';

function captureWrites() {
  const written = {};
  vi.spyOn(std, 'open').mockImplementation((path) => {
    written[path] = '';
    return { puts: (content) => { written[path] += content; }, close: () => {} };
  });
  vi.spyOn(os, 'rename').mockReturnValue(0);
  return written;
}

describe('HistorySessionWriter torn session (no close, no rollover)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes session.json listing segment 0 from the first event', () => {
    const written = captureWrites();
    const writer = new HistorySessionWriter('test-history', 'tornA');

    writer.writeEvent('{"a":1}', 5000);
    writer.writeEvent('{"a":2}', 6000);

    const sessionIndex = JSON.parse(written['test-history/tornA/session.json.tmp']);
    expect(sessionIndex.startUs).toBe(5000);
    expect(sessionIndex.segments).toEqual([{ index: 0, fromUs: 5000 }]);
    expect(sessionIndex).not.toHaveProperty('endUs');
  });

  it('writes session.json once and never rewrites the growing root indexes before rollover/close', () => {
    captureWrites();
    const writer = new HistorySessionWriter('test-history', 'tornB');
    const openedPaths = () => std.open.mock.calls.map(([path]) => path);

    writer.addEventIndex(1000, 'graph-change');
    writer.recordJournalFact(1000, 1);
    for (let second = 0; second < 60; second++) writer.writeLog('{"l":1}', second * 1000 * 1000);

    const paths = openedPaths();
    expect(paths.filter((path) => path === 'test-history/tornB/session.json.tmp')).toHaveLength(1);
    expect(paths).not.toContain('test-history/tornB/events_index.json.tmp');
    expect(paths).not.toContain('test-history/tornB/journal_index.json.tmp');
  });
});
