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

const SESSION_ROOT_ENTRIES = new Set(
  `snapshot.json manifest.json journal_index.json session.json
   events_index.json events.jsonl done chunks logs checkpoints segments`.split(
    /\s+/,
  ),
);

const padded = (index: number) => String(index).padStart(4, '0');

/**
 * LocalFileSessionFileReader — reads history sessions from browser File objects.
 * Files are keyed by their session-relative path, the same string WsSessionFileReader
 * sends as `file`, so both readers address segmented sessions identically.
 */
export class LocalFileSessionFileReader {
  private sessionMap = new Map<string, Map<string, File>>();

  constructor(files: File[]) {
    for (const file of files) {
      const parts = file.webkitRelativePath.split('/');
      const rootIndex = parts.findIndex((part) =>
        SESSION_ROOT_ENTRIES.has(part),
      );
      if (rootIndex < 1) continue;

      const sessionId = parts[rootIndex - 1];
      if (!this.sessionMap.has(sessionId))
        this.sessionMap.set(sessionId, new Map());
      this.sessionMap
        .get(sessionId)!
        .set(parts.slice(rootIndex).join('/'), file);
    }
  }

  async listSessions(): Promise<SessionInfo[]> {
    return Promise.all(
      Array.from(this.sessionMap.entries())
        .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
        .map(([sessionId, files]) => this.buildSessionInfo(sessionId, files)),
    );
  }

  private async buildSessionInfo(
    sessionId: string,
    files: Map<string, File>,
  ): Promise<SessionInfo> {
    const paths = Array.from(files.keys()).join('\n');
    const isSegmented = files.has('session.json');
    let range: { startUs?: number | null; endUs?: number } = {};

    try {
      range = isSegmented
        ? ((await this.readSessionIndex(sessionId)) ?? {})
        : ((await this.readJson<typeof range>(sessionId, 'manifest.json')) ??
          {});
    } catch {
      console.error(`[LocalFileSessionFileReader] ${sessionId}: bad index`);
    }

    let sizeBytes = 0;
    for (const file of files.values()) sizeBytes += file.size;

    return {
      sessionId,
      hasSnapshot: paths.includes('snapshot.json'),
      hasEvents: files.has('events.jsonl') || paths.includes('chunks/'),
      hasManifest: paths.includes('manifest.json') || isSegmented,
      hasCheckpoints: paths.includes('checkpoints/'),
      sizeBytes,
      isComplete: isSegmented ? range.endUs !== undefined : files.has('done'),
      startUs: range.startUs ?? undefined,
      endUs: range.endUs,
    };
  }

  private file(sessionId: string, name: string, segmentDir?: string) {
    const path = segmentDir ? `${segmentDir}/${name}` : name;
    return this.sessionMap.get(sessionId)?.get(path);
  }

  private async readJson<T>(
    sessionId: string,
    name: string,
    segmentDir?: string,
  ): Promise<T | null> {
    const file = this.file(sessionId, name, segmentDir);
    if (!file) return null;
    try {
      return JSON.parse(await file.text()) as T;
    } catch {
      return null;
    }
  }

  private async readJsonl(sessionId: string, name: string, dir?: string) {
    const file = this.file(sessionId, name, dir);
    return file ? parseEventsJsonl(await file.text()) : [];
  }

  async readSnapshot(sessionId: string, segmentDir?: string) {
    const file = this.file(sessionId, 'snapshot.json', segmentDir);
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
    const file = this.file(sessionId, 'session.json');
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
