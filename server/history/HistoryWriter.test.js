import { describe, it, expect, vi } from 'vitest';
import * as std from 'std';
import * as os from 'os';
import { HistoryWriter } from './HistoryWriter.js';

describe('HistoryWriter journal index', () => {
  it('has no journal pointer when no fact was ever recorded', () => {
    const writer = new HistoryWriter('test-history');

    expect(writer._getJournalPointer()).toBeUndefined();
  });

  it('summarizes recorded facts into a journal pointer with error/warning counts', () => {
    const writer = new HistoryWriter('test-history');

    writer.recordJournalFact(1523463, 1);
    writer.recordJournalFact(1523478, 2);
    writer.recordJournalFact(1527685, 1);

    expect(writer._getJournalPointer()).toEqual({
      file: 'journal_index.json',
      format: 'columnar-delta-v1',
      eventCount: 3,
      errorCount: 2,
      warningCount: 1,
    });
  });
});

describe('HistoryWriter close order', () => {
  it('closes event/log streams and writes the manifest before marking the session done', () => {
    const writer = new HistoryWriter('test-history');
    writer.writeEvent('{"a":1}', 1000);

    const order = [];
    const originalEventsClose = writer._events.close.bind(writer._events);
    const originalLogsClose = writer._logs.close.bind(writer._logs);
    const originalWriteManifest = writer._writeManifest.bind(writer);

    writer._events.close = () => { order.push('events.close'); originalEventsClose(); };
    writer._logs.close = () => { order.push('logs.close'); originalLogsClose(); };
    writer._writeManifest = () => { order.push('writeManifest'); originalWriteManifest(); };

    const openSpy = vi.spyOn(std, 'open');
    writer.close();

    expect(order).toEqual(['events.close', 'logs.close', 'writeManifest']);

    const donePathCalls = openSpy.mock.calls.filter(([path]) => path.endsWith('/done'));
    const manifestTmpPathCalls = openSpy.mock.calls.filter(([path]) => path.endsWith('/manifest.json.tmp'));
    expect(donePathCalls.length).toBe(1);
    expect(manifestTmpPathCalls.length).toBe(1);
    expect(openSpy.mock.invocationCallOrder[openSpy.mock.calls.indexOf(manifestTmpPathCalls[0])])
      .toBeLessThan(openSpy.mock.invocationCallOrder[openSpy.mock.calls.indexOf(donePathCalls[0])]);

    openSpy.mockRestore();
  });
});

describe('HistoryWriter torn-session manifest', () => {
  const countManifestWrites = (renameSpy) =>
    renameSpy.mock.calls.filter(([, dest]) => dest.endsWith('/manifest.json')).length;

  it('writes the manifest on the first event so a session killed before rotation stays loadable', () => {
    const renameSpy = vi.spyOn(os, 'rename');
    const writer = new HistoryWriter('test-history', 'torn1');

    writer.writeEvent('{"a":1}', 1000);

    expect(countManifestWrites(renameSpy)).toBe(1);
    renameSpy.mockRestore();
  });

  it('throttles manifest rewrites to MANIFEST_REFRESH_US between events', () => {
    const renameSpy = vi.spyOn(os, 'rename');
    const writer = new HistoryWriter('test-history', 'torn2');

    writer.writeEvent('{"a":1}', 1000);
    writer.writeEvent('{"a":2}', 500 * 1000);

    expect(countManifestWrites(renameSpy)).toBe(1);

    writer.writeEvent('{"a":3}', 3 * 1000 * 1000);

    expect(countManifestWrites(renameSpy)).toBe(2);
    renameSpy.mockRestore();
  });

  it('stops refreshing the manifest mid-chunk once the first rotation has happened', () => {
    const renameSpy = vi.spyOn(os, 'rename');
    const writer = new HistoryWriter('test-history', 'torn4');

    writer.writeEvent('{"a":1}', 1000);
    writer.writeEvent('{"a":2}', 10 * 1000 * 1000 + 1000);

    expect(writer.getCurrentChunkIndex()).toBe(1);
    expect(countManifestWrites(renameSpy)).toBe(2);

    writer.writeEvent('{"a":3}', 10 * 1000 * 1000 + 4 * 1000 * 1000);
    writer.writeEvent('{"a":4}', 10 * 1000 * 1000 + 8 * 1000 * 1000);

    expect(countManifestWrites(renameSpy)).toBe(2);
    renameSpy.mockRestore();
  });

  it('lists the open log chunk in a mid-session manifest', () => {
    const written = {};
    const openSpy = vi.spyOn(std, 'open').mockImplementation((path) => ({
      puts: (content) => { written[path] = (written[path] || '') + content; },
      close: () => {},
    }));
    const renameSpy = vi.spyOn(os, 'rename').mockReturnValue(0);
    const writer = new HistoryWriter('test-history', 'torn3');

    writer.writeLog('{"l":1}', 1000);

    const manifest = JSON.parse(written['test-history/torn3/manifest.json.tmp']);
    expect(manifest.logChunks).toEqual([
      { file: 'logs/logs_0000.jsonl', fromUs: 1000, toUs: 1000, count: 1 },
    ]);

    openSpy.mockRestore();
    renameSpy.mockRestore();
  });
});

describe('HistoryWriter event chunk ranges', () => {
  it('records real [fromUs, toUs] event chunk ranges in the manifest', () => {
    const written = {};
    const openSpy = vi.spyOn(std, 'open').mockImplementation((path) => {
      written[path] = '';
      return {
        puts: (content) => { written[path] += content; },
        close: () => {},
      };
    });
    const renameSpy = vi.spyOn(os, 'rename').mockReturnValue(0);
    const writer = new HistoryWriter('test-history', 'drift1');

    writer.writeEvent('{"a":1}', 1000);
    writer.writeEvent('{"a":2}', 10 * 1000 * 1000 + 500 * 1000);
    writer.writeEvent('{"a":3}', 11 * 1000 * 1000);
    writer.close();

    const manifest = JSON.parse(written['test-history/drift1/manifest.json.tmp']);
    expect(manifest.eventChunks).toEqual([
      { file: 'chunks/chunk_0000.jsonl', fromUs: 1000, toUs: 10 * 1000 * 1000 + 500 * 1000, count: 2 },
      { file: 'chunks/chunk_0001.jsonl', fromUs: 11 * 1000 * 1000, toUs: 11 * 1000 * 1000, count: 1 },
    ]);

    openSpy.mockRestore();
    renameSpy.mockRestore();
  });
});

describe('HistoryWriter atomic manifest writes', () => {
  it('writes the manifest to a .tmp file then renames it atomically', () => {
    const writer = new HistoryWriter('test-history', 'sess1');
    writer.writeEvent('{"a":1}', 1000);

    const openSpy = vi.spyOn(std, 'open');
    const renameSpy = vi.spyOn(os, 'rename');

    writer._writeManifest();

    const tmpOpenCall = openSpy.mock.calls.find(([path]) => path.endsWith('manifest.json.tmp'));
    expect(tmpOpenCall).toBeDefined();

    const renameCall = renameSpy.mock.calls.find(([, dest]) => dest.endsWith('manifest.json'));
    expect(renameCall).toBeDefined();
    expect(renameCall[0]).toBe(`${renameCall[1]}.tmp`);

    openSpy.mockRestore();
    renameSpy.mockRestore();
  });
});
