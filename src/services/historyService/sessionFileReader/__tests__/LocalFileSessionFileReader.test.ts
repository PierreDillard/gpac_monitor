import { describe, it, expect } from 'vitest';
import { LocalFileSessionFileReader } from '../LocalFileSessionFileReader';

function makeMockFile(path: string, content: string): File {
  return {
    webkitRelativePath: path,
    name: path.split('/').pop()!,
    size: content.length,
    text: () => Promise.resolve(content),
  } as unknown as File;
}

const SNAPSHOT_CONTENT = '{}';

describe('LocalFileSessionFileReader.listSessions', () => {
  it('populates startUs/endUs when manifest is present', async () => {
    const manifest = JSON.stringify({ startUs: 1_000_000, endUs: 5_000_000 });
    const reader = new LocalFileSessionFileReader([
      makeMockFile('history/1234567890/snapshot.json', SNAPSHOT_CONTENT),
      makeMockFile('history/1234567890/manifest.json', manifest),
    ]);

    const sessions = await reader.listSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].startUs).toBe(1_000_000);
    expect(sessions[0].endUs).toBe(5_000_000);
  });

  it('leaves startUs/endUs undefined when no manifest', async () => {
    const reader = new LocalFileSessionFileReader([
      makeMockFile('history/9999999999/snapshot.json', SNAPSHOT_CONTENT),
    ]);

    const sessions = await reader.listSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].startUs).toBeUndefined();
    expect(sessions[0].endUs).toBeUndefined();
  });

  it('leaves startUs/endUs undefined and keeps session when manifest is malformed', async () => {
    const reader = new LocalFileSessionFileReader([
      makeMockFile('history/5555555555/snapshot.json', SNAPSHOT_CONTENT),
      makeMockFile('history/5555555555/manifest.json', 'not valid json {{{'),
    ]);

    const sessions = await reader.listSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe('5555555555');
    expect(sessions[0].startUs).toBeUndefined();
    expect(sessions[0].endUs).toBeUndefined();
  });

  it('handles mixed sessions independently', async () => {
    const manifest = JSON.stringify({ startUs: 2_000_000, endUs: 8_000_000 });
    const reader = new LocalFileSessionFileReader([
      makeMockFile('history/1111111111/snapshot.json', SNAPSHOT_CONTENT),
      makeMockFile('history/1111111111/manifest.json', manifest),
      makeMockFile('history/2222222222/snapshot.json', SNAPSHOT_CONTENT),
    ]);

    const sessions = await reader.listSessions();

    expect(sessions).toHaveLength(2);
    const withManifest = sessions.find(
      (session) => session.sessionId === '1111111111',
    );
    const withoutManifest = sessions.find(
      (session) => session.sessionId === '2222222222',
    );

    expect(withManifest?.startUs).toBe(2_000_000);
    expect(withManifest?.endUs).toBe(8_000_000);
    expect(withoutManifest?.startUs).toBeUndefined();
    expect(withoutManifest?.endUs).toBeUndefined();
  });
});

const SESSION_ID = '2026-09-08_12-04-55';

function segmentedSessionFiles(): File[] {
  const sessionIndex = JSON.stringify({
    version: 1,
    startUs: 1_000_000,
    endUs: 30_000_000,
    segmentDurationUs: 86_400_000_000,
    retentionMaxSegments: 30,
    segments: [
      { index: 0, fromUs: 1_000_000 },
      { index: 1, fromUs: 20_000_000, toUs: 30_000_000 },
    ],
  });
  return [
    makeMockFile(`history/${SESSION_ID}/session.json`, sessionIndex),
    makeMockFile(`history/${SESSION_ID}/events_index.json`, '[]'),
    makeMockFile(
      `history/${SESSION_ID}/segments/0000/snapshot.json`,
      SNAPSHOT_CONTENT,
    ),
    makeMockFile(
      `history/${SESSION_ID}/segments/0000/manifest.json`,
      JSON.stringify({ startUs: 1_000_000, endUs: 20_000_000 }),
    ),
    makeMockFile(
      `history/${SESSION_ID}/segments/0000/chunks/chunk_0000.jsonl`,
      '{"message":"filters","ts_us":1000000}',
    ),
    makeMockFile(
      `history/${SESSION_ID}/segments/0000/checkpoints/cp_0000.json`,
      '{}',
    ),
    makeMockFile(
      `history/${SESSION_ID}/segments/0001/snapshot.json`,
      SNAPSHOT_CONTENT,
    ),
    makeMockFile(
      `history/${SESSION_ID}/segments/0001/chunks/chunk_0000.jsonl`,
      '{"message":"filters","ts_us":20000000}',
    ),
  ];
}

describe('LocalFileSessionFileReader — segmented sessions', () => {
  it('lists one entry with the real sessionId, never a ghost segment entry', async () => {
    const reader = new LocalFileSessionFileReader(segmentedSessionFiles());

    const sessions = await reader.listSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe(SESSION_ID);
    expect(sessions.some((session) => session.sessionId === '0000')).toBe(
      false,
    );
  });

  it('reports duration but no size for a segmented session', async () => {
    const reader = new LocalFileSessionFileReader(segmentedSessionFiles());

    const [session] = await reader.listSessions();

    expect(session.sizeBytes).toBeUndefined();
    expect(session.startUs).toBe(1_000_000);
    expect(session.endUs).toBe(30_000_000);
    expect(session.hasSnapshot).toBe(true);
    expect(session.hasManifest).toBe(true);
    expect(session.hasCheckpoints).toBe(true);
    expect(session.isComplete).toBe(true);
  });

  it('lists sessions without reading any file size', async () => {
    const files = segmentedSessionFiles().map((file) =>
      Object.defineProperty(file, 'size', {
        get: () => {
          throw new Error('file.size read during listSessions');
        },
      }),
    );
    const reader = new LocalFileSessionFileReader(files);

    const [session] = await reader.listSessions();

    expect(session.sessionId).toBe(SESSION_ID);
    expect(session.endUs).toBe(30_000_000);
  });

  it('reads same-index chunks from different segments without collision', async () => {
    const reader = new LocalFileSessionFileReader(segmentedSessionFiles());

    const first = await reader.readChunk(SESSION_ID, 0, 'segments/0000');
    const second = await reader.readChunk(SESSION_ID, 0, 'segments/0001');

    expect(first[0].ts_us).toBe(1_000_000);
    expect(second[0].ts_us).toBe(20_000_000);
  });

  it('scopes snapshot and checkpoint reads to their segment', async () => {
    const reader = new LocalFileSessionFileReader(segmentedSessionFiles());

    await expect(
      reader.readSnapshot(SESSION_ID, 'segments/0000'),
    ).resolves.toEqual({});
    await expect(
      reader.readCheckpoint(SESSION_ID, 0, 'segments/0000'),
    ).resolves.toEqual({});
    await expect(
      reader.readCheckpoint(SESSION_ID, 0, 'segments/0001'),
    ).resolves.toBeNull();
  });

  it('parses the root session index and throws on an unsupported version', async () => {
    const reader = new LocalFileSessionFileReader(segmentedSessionFiles());
    const sessionIndex = await reader.readSessionIndex(SESSION_ID);

    expect(sessionIndex?.segments).toHaveLength(2);
    expect(sessionIndex?.startUs).toBe(1_000_000);

    const futureReader = new LocalFileSessionFileReader([
      makeMockFile(
        `history/${SESSION_ID}/session.json`,
        JSON.stringify({ version: 2, segments: [] }),
      ),
    ]);
    await expect(futureReader.readSessionIndex(SESSION_ID)).rejects.toThrow(
      /unsupported version/,
    );
  });

  it('returns null for a session index that is absent', async () => {
    const reader = new LocalFileSessionFileReader([
      makeMockFile('history/legacy-session/snapshot.json', SNAPSHOT_CONTENT),
    ]);

    await expect(reader.readSessionIndex('legacy-session')).resolves.toBeNull();
  });

  it('keeps legacy reads unscoped by segment', async () => {
    const reader = new LocalFileSessionFileReader([
      makeMockFile('history/legacy-session/snapshot.json', SNAPSHOT_CONTENT),
      makeMockFile(
        'history/legacy-session/chunks/chunk_0002.jsonl',
        '{"message":"filters","ts_us":7000000}',
      ),
    ]);

    const events = await reader.readChunk('legacy-session', 2);

    expect(events[0].ts_us).toBe(7_000_000);
    await expect(reader.readSnapshot('legacy-session')).resolves.toEqual({});
  });
});
