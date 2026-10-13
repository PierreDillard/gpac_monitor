import { describe, it, expect, vi } from 'vitest';
import * as std from 'std';
import * as os from 'os';
import { HistoryFileReader } from './HistoryFileReader.js';

describe('HistoryFileReader segmented session whitelist', () => {
  it('allows reading session.json and both JSONL root indexes at the session root', () => {
    const reader = new HistoryFileReader('test-history');
    vi.spyOn(std, 'open').mockReturnValue({ readAsString: () => '{}', close: () => {} });

    expect(reader.readFile('2026-01-01_00-00-00', 'session.json').ok).toBe(true);
    expect(reader.readFile('2026-01-01_00-00-00', 'events_index.jsonl').ok).toBe(true);
    expect(reader.readFile('2026-01-01_00-00-00', 'journal_index.jsonl').ok).toBe(true);

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

  it('probes snapshot/manifest/checkpoints in the first listed segment, closed or torn', () => {
    const reader = new HistoryFileReader('test-history');
    const closedId = '2026-01-03_00-00-00';
    const tornId = '2026-01-04_00-00-00';
    const sessionIndexes = {
      [closedId]: { version: 1, startUs: 0, segments: [{ index: 2, fromUs: 0 }, { index: 3, fromUs: 9 }], endUs: 20 },
      [tornId]: { version: 1, startUs: 0, segments: [{ index: 0, fromUs: 0 }] },
    };
    const segmentDirs = [`test-history/${closedId}/segments/0002`, `test-history/${tornId}/segments/0000`];

    vi.spyOn(os, 'readdir').mockImplementation((path) => {
      if (path === 'test-history') return [[closedId, tornId], 0];
      if (segmentDirs.some((segmentDir) => path === `${segmentDir}/checkpoints`)) return [['cp_0000.json'], 0];
      return [[], 0];
    });
    vi.spyOn(std, 'open').mockImplementation((path) => {
      const sessionId = Object.keys(sessionIndexes).find((id) => path === `test-history/${id}/session.json`);
      if (sessionId) return { readAsString: () => JSON.stringify(sessionIndexes[sessionId]), close: () => {} };
      const inSegment = segmentDirs.some((segmentDir) =>
        path === `${segmentDir}/snapshot.json` || path === `${segmentDir}/manifest.json`);
      return inSegment ? { close: () => {} } : null;
    });

    const sessions = reader.listSessions();

    const valid = { hasSnapshot: true, hasManifest: true, hasCheckpoints: true, hasSessionIndex: true };
    expect(sessions.find((session) => session.sessionId === closedId)).toMatchObject({ ...valid, isComplete: true });
    expect(sessions.find((session) => session.sessionId === tornId)).toMatchObject({ ...valid, isComplete: false });

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
