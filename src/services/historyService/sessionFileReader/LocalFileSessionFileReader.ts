import type { HistorySnapshot, LogEvent, JournalIndex } from '../types';
import type { SessionInfo } from './types';
import type {
  HistoryManifest,
  HistorySessionIndex,
  ManifestEventEntry,
} from '../source/types';
import { parseEventsJsonl } from '../loader/eventLoader';
import { parseManifest } from '../manifestParser';
import { parseJournalIndex } from '../journalIndexParser';
import { parseSessionIndex, parseEventsIndex } from '../sessionIndexParser';
import {
  directoryEntryLookup,
  fileListLookup,
  type SessionFileLookup,
} from './sessionFileLookup';

const padded = (index: number) => String(index).padStart(4, '0');

/**
 * LocalFileSessionFileReader — reads history sessions from a FileList or a dropped
 * folder. Paths are session-relative, the same string WsSessionFileReader sends as
 * `file`, so both readers address segmented sessions identically.
 */
export class LocalFileSessionFileReader {
  private lookup: SessionFileLookup;

  constructor(source: File[] | FileSystemDirectoryEntry) {
    this.lookup = Array.isArray(source)
      ? fileListLookup(source)
      : directoryEntryLookup(source);
  }

  async listSessions(): Promise<SessionInfo[]> {
    const sessionIds = await this.lookup.sessionIds();
    return Promise.all(
      sessionIds
        .sort((first, second) => (first < second ? 1 : first > second ? -1 : 0))
        .map((sessionId) => this.buildSessionInfo(sessionId)),
    );
  }

  private async buildSessionInfo(sessionId: string): Promise<SessionInfo> {
    const has = (path: string) => this.lookup.has(sessionId, path);
    const isSegmented = await has('session.json');
    let range: { startUs?: number | null; endUs?: number } = {};
    let dataDir = '';

    try {
      if (isSegmented) {
        const sessionIndex = await this.readSessionIndex(sessionId);
        range = sessionIndex ?? {};
        const firstSegment = sessionIndex?.segments[0];
        if (firstSegment) dataDir = `segments/${padded(firstSegment.index)}/`;
      } else {
        range =
          (await this.readJson<typeof range>(sessionId, 'manifest.json')) ?? {};
      }
    } catch {
      console.error(`[LocalFileSessionFileReader] ${sessionId}: bad index`);
    }

    const [snapshot, chunks, checkpoints] = await Promise.all(
      ['snapshot.json', 'chunks', 'checkpoints'].map((name) =>
        has(dataDir + name),
      ),
    );
    const [eventsFile, manifest, done] = await Promise.all(
      ['events.jsonl', 'manifest.json', 'done'].map(has),
    );
    return {
      sessionId,
      hasSnapshot: snapshot,
      hasEvents: eventsFile || chunks,
      hasManifest: manifest || isSegmented,
      hasCheckpoints: checkpoints,
      isComplete: isSegmented ? range.endUs !== undefined : done,
      startUs: range.startUs ?? undefined,
      endUs: range.endUs,
    };
  }

  private file(sessionId: string, name: string, segmentDir?: string) {
    const path = segmentDir ? `${segmentDir}/${name}` : name;
    return this.lookup.file(sessionId, path);
  }

  private async readJson<T>(
    sessionId: string,
    name: string,
    segmentDir?: string,
  ): Promise<T | null> {
    const file = await this.file(sessionId, name, segmentDir);
    if (!file) return null;
    try {
      return JSON.parse(await file.text()) as T;
    } catch {
      return null;
    }
  }

  private async readJsonl(sessionId: string, name: string, dir?: string) {
    const file = await this.file(sessionId, name, dir);
    return file ? parseEventsJsonl(await file.text()) : [];
  }

  async readSnapshot(sessionId: string, segmentDir?: string) {
    const file = await this.file(sessionId, 'snapshot.json', segmentDir);
    if (!file) throw new Error(`No snapshot for session ${sessionId}`);
    return JSON.parse(await file.text()) as HistorySnapshot;
  }

  async readManifest(
    sessionId: string,
    segmentDir?: string,
  ): Promise<HistoryManifest | null> {
    const raw = await this.readJson(sessionId, 'manifest.json', segmentDir);
    return raw ? parseManifest(raw) : null;
  }

  async readSessionIndex(
    sessionId: string,
  ): Promise<HistorySessionIndex | null> {
    const file = await this.file(sessionId, 'session.json');
    if (!file) return null;
    return parseSessionIndex(JSON.parse(await file.text()));
  }

  async readEventsIndex(
    sessionId: string,
  ): Promise<ManifestEventEntry[] | null> {
    const raw = await this.readJson(sessionId, 'events_index.json');
    return raw ? parseEventsIndex(raw) : null;
  }

  async readJournalIndex(sessionId: string): Promise<JournalIndex | null> {
    const raw = await this.readJson(sessionId, 'journal_index.json');
    return raw ? parseJournalIndex(raw) : null;
  }

  async readCheckpoint(
    sessionId: string,
    chunkIndex: number,
    segmentDir?: string,
  ): Promise<unknown> {
    const name = `checkpoints/cp_${padded(chunkIndex)}.json`;
    return this.readJson(sessionId, name, segmentDir);
  }

  async readChunk(sessionId: string, chunkIndex: number, segmentDir?: string) {
    const name = `chunks/chunk_${padded(chunkIndex)}.jsonl`;
    return this.readJsonl(sessionId, name, segmentDir);
  }

  async readLogChunk(
    sessionId: string,
    chunkIndex: number,
    segmentDir?: string,
  ): Promise<LogEvent[]> {
    const name = `logs/logs_${padded(chunkIndex)}.jsonl`;
    return (await this.readJsonl(
      sessionId,
      name,
      segmentDir,
    )) as unknown as LogEvent[];
  }
}
