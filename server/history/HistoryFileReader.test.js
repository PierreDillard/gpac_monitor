import { describe, it, expect, vi } from 'vitest';
import * as std from 'std';
import * as os from 'os';
import { HistoryFileReader } from './HistoryFileReader.js';

describe('HistoryFileReader segmented session whitelist', () => {
  it('allows reading session.json and events_index.json at the session root', () => {
    const reader = new HistoryFileReader('test-history');
    vi.spyOn(std, 'open').mockReturnValue({ readAsString: () => '{}', close: () => {} });

    expect(reader.readFile('2026-01-01_00-00-00', 'session.json').ok).toBe(true);
    expect(reader.readFile('2026-01-01_00-00-00', 'events_index.json').ok).toBe(true);

    vi.restoreAllMocks();
  });

  it('allows a chunk file nested under segments/NNNN/ but rejects path traversal through segments/', () => {
    const reader = new HistoryFileReader('test-history');
    vi.spyOn(std, 'open').mockReturnValue({ readAsString: () => '{}', close: () => {} });

    expect(reader.readFile('2026-01-01_00-00-00', 'segments/0000/chunks/chunk_0001.jsonl').ok).toBe(true);
    expect(reader.readFile('2026-01-01_00-00-00', 'segments/../../etc/passwd').ok).toBe(false);

    vi.restoreAllMocks();
  });
});

describe('HistoryFileReader listSessions', () => {
  it('lists a segmented session (session.json only) alongside a legacy session, without regressing the legacy fields', () => {
    const reader = new HistoryFileReader('test-history');
    const legacyId = '2026-01-01_00-00-00';
    const segmentedId = '2026-01-02_00-00-00';

    vi.spyOn(os, 'readdir').mockImplementation((path) => {
      if (path === 'test-history') return [[legacyId, segmentedId], 0];
      return [[], 0];
    });
    vi.spyOn(std, 'open').mockImplementation((path) => {
      const exists = path === `test-history/${legacyId}/snapshot.json`
        || path === `test-history/${legacyId}/manifest.json`
        || path === `test-history/${segmentedId}/session.json`;
      return exists ? { close: () => {} } : null;
    });

    const sessions = reader.listSessions();

    const legacy = sessions.find((session) => session.sessionId === legacyId);
    const segmented = sessions.find((session) => session.sessionId === segmentedId);
    expect(legacy).toMatchObject({ hasSnapshot: true, hasManifest: true, hasSessionIndex: false });
    expect(segmented).toMatchObject({ hasSnapshot: false, hasManifest: false, hasSessionIndex: true });

    vi.restoreAllMocks();
  });
});

describe('HistoryFileReader readEventsRange', () => {
  it('returns an empty array when the manifest is truncated/invalid JSON', () => {
    const reader = new HistoryFileReader('test-history');
    vi.spyOn(std, 'open').mockReturnValue({
      readAsString: () => '{"version":1,"startUs":0,"chunkCount":2',
      close: () => {},
    });

    const events = reader.readEventsRange('123', 0, 1000);

    expect(events).toEqual([]);

    vi.restoreAllMocks();
  });
});
