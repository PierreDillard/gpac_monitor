import { describe, it, expect } from 'vitest';
import { LocalFileSessionFileReader } from '../LocalFileSessionFileReader';
import {
  fakeDirectoryEntry,
  makeMockFile,
  type FakeTree,
} from './fakeDirectoryEntry';

const SESSION_ID = '2026-09-08_12-04-55';

const SEGMENTED: FakeTree = {
  'session.json': JSON.stringify({
    version: 1,
    startUs: 1_000_000,
    endUs: 30_000_000,
    segmentDurationUs: 86_400_000_000,
    retentionMaxSegments: 30,
    segments: [
      { index: 0, fromUs: 1_000_000 },
      { index: 1, fromUs: 20_000_000, toUs: 30_000_000 },
    ],
  }),
  'segments/0000/snapshot.json': '{}',
  'segments/0000/chunks/chunk_0000.jsonl': '{"message":"filters","ts_us":1}',
  'segments/0000/checkpoints/cp_0000.json': '{}',
  'segments/0001/snapshot.json': '{}',
  'segments/0001/chunks/chunk_0000.jsonl':
    '{"message":"filters","ts_us":20000000}',
};

const LEGACY: FakeTree = {
  'snapshot.json': '{}',
  'manifest.json': JSON.stringify({ startUs: 2_000_000, endUs: 8_000_000 }),
  'chunks/chunk_0000.jsonl': '{"message":"filters","ts_us":2000000}',
  done: '',
};

/** Prefixes every path of `tree` with `dir/`. */
const under = (dir: string, tree: FakeTree): FakeTree =>
  Object.fromEntries(
    Object.entries(tree).map(([path, content]) => [`${dir}/${path}`, content]),
  );

const fileListReader = (tree: FakeTree) =>
  new LocalFileSessionFileReader(
    Object.entries(tree).map(([path, content]) =>
      makeMockFile(`history/${path}`, content),
    ),
  );

describe('LocalFileSessionFileReader — dropped folder', () => {
  it('lists a dropped session folder like the FileList variant', async () => {
    const listedDirs: string[] = [];
    const entry = fakeDirectoryEntry(SESSION_ID, SEGMENTED, listedDirs);

    const sessions = await new LocalFileSessionFileReader(entry).listSessions();

    expect(sessions).toEqual(
      await fileListReader(under(SESSION_ID, SEGMENTED)).listSessions(),
    );
    expect(listedDirs).toEqual([]);
  });

  it('lists sessions of a dropped parent folder, one level only', async () => {
    const parentTree = {
      ...under(SESSION_ID, SEGMENTED),
      ...under('legacy-session', LEGACY),
    };
    const listedDirs: string[] = [];
    const entry = fakeDirectoryEntry('history', parentTree, listedDirs);

    const sessions = await new LocalFileSessionFileReader(entry).listSessions();

    expect(sessions).toEqual(await fileListReader(parentTree).listSessions());
    expect(listedDirs.every((dir) => dir === '')).toBe(true);
  });

  it('reads a chunk from another segment without listing any directory', async () => {
    const listedDirs: string[] = [];
    const entry = fakeDirectoryEntry(SESSION_ID, SEGMENTED, listedDirs);
    const reader = new LocalFileSessionFileReader(entry);
    await reader.listSessions();

    const events = await reader.readChunk(SESSION_ID, 0, 'segments/0001');

    expect(events[0].ts_us).toBe(20_000_000);
    expect(listedDirs).toEqual([]);
  });
});
