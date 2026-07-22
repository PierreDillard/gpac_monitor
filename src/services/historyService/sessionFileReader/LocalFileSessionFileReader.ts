import type { HistorySnapshot, LogEvent, JournalIndex } from '../types';
import type { SessionInfo } from './types';
import type { HistoryManifest } from '../source/types';
import { parseEventsJsonl } from '../loader/eventLoader';
import { parseManifest } from '../manifestParser';
import { parseJournalIndex } from '../journalIndexParser';

const emptyEntry = (): SessionEntry => ({
  done: false,
  chunks: new Map(),
  logChunks: new Map(),
  checkpoints: new Map(),
});

interface SessionEntry {
  snapshot?: File;
  events?: File;
  manifest?: File;
  journalIndex?: File;
  chunks: Map<number, File>;
  logChunks: Map<number, File>;
  checkpoints: Map<number, File>;
  done: boolean;
}

/**
 * LocalFileSessionFileReader — reads history sessions from browser File objects .
 * No server involved: all data comes from the File API (webkitRelativePath).
 * Same interface as WsSessionFileReader so ChunkLoader works with either.
 */
export class LocalFileSessionFileReader {
  private sessionMap = new Map<string, SessionEntry>();

  /** Indexes all files by session, routing chunks/logs/checkpoints by parent folder name. */
  constructor(files: File[]) {
    for (const file of files) {
      const parts = file.webkitRelativePath.split('/');
      if (parts.length < 2) continue;

      const fileName = parts[parts.length - 1];
      const parentFolder = parts[parts.length - 2];

      if (parentFolder === 'chunks') {
        if (parts.length < 3) continue;
        const sessionId = parts[parts.length - 3];
        const chunkMatch = fileName.match(/^chunk_(\d+)\.jsonl$/);
        if (!chunkMatch) continue;
        const chunkIndex = parseInt(chunkMatch[1], 10);
        if (!this.sessionMap.has(sessionId))
          this.sessionMap.set(sessionId, emptyEntry());
        this.sessionMap.get(sessionId)!.chunks.set(chunkIndex, file);
      } else if (parentFolder === 'logs') {
        if (parts.length < 3) continue;
        const sessionId = parts[parts.length - 3];
        const logMatch = fileName.match(/^logs_(\d+)\.jsonl$/);
        if (!logMatch) continue;
        const logIndex = parseInt(logMatch[1], 10);
        if (!this.sessionMap.has(sessionId))
          this.sessionMap.set(sessionId, emptyEntry());
        this.sessionMap.get(sessionId)!.logChunks.set(logIndex, file);
      } else if (parentFolder === 'checkpoints') {
        if (parts.length < 3) continue;
        const sessionId = parts[parts.length - 3];
        const cpMatch = fileName.match(/^cp_(\d+)\.json$/);
        if (!cpMatch) continue;
        const cpIndex = parseInt(cpMatch[1], 10);
        if (!this.sessionMap.has(sessionId))
          this.sessionMap.set(sessionId, emptyEntry());
        this.sessionMap.get(sessionId)!.checkpoints.set(cpIndex, file);
      } else {
        const sessionId = parentFolder;
        if (!this.sessionMap.has(sessionId))
          this.sessionMap.set(sessionId, emptyEntry());
        const entry = this.sessionMap.get(sessionId)!;
        if (fileName === 'snapshot.json') entry.snapshot = file;
        else if (fileName === 'events.jsonl') entry.events = file;
        else if (fileName === 'manifest.json') entry.manifest = file;
        else if (fileName === 'journal_index.json') entry.journalIndex = file;
        else if (fileName === 'done') entry.done = true;
      }
    }
  }

  async listSessions(): Promise<SessionInfo[]> {
    return Promise.all(
      Array.from(this.sessionMap.entries())
        .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
        .map(async ([sessionId, entry]) => {
          let startUs: number | undefined;
          let endUs: number | undefined;
          if (entry.manifest) {
            try {
              const manifest = JSON.parse(await entry.manifest.text());
              startUs = manifest.startUs;
              endUs = manifest.endUs;
            } catch {
              console.error(`startUs and endUs undefined`);
            }
          }
          return {
            sessionId,
            hasSnapshot: !!entry.snapshot,
            hasEvents: !!entry.events,
            hasManifest: !!entry.manifest,
            hasCheckpoints: entry.checkpoints.size > 0,
            sizeBytes: (entry.snapshot?.size ?? 0) + (entry.events?.size ?? 0),
            isComplete: entry.done,
            startUs,
            endUs,
          };
        }),
    );
  }

  async readSnapshot(sessionId: string): Promise<HistorySnapshot> {
    const file = this.sessionMap.get(sessionId)?.snapshot;
    if (!file) throw new Error(`No snapshot for session ${sessionId}`);
    return JSON.parse(await file.text()) as HistorySnapshot;
  }

  async readManifest(sessionId: string): Promise<HistoryManifest | null> {
    const file = this.sessionMap.get(sessionId)?.manifest;
    if (!file) return null;
    try {
      return parseManifest(JSON.parse(await file.text()));
    } catch {
      return null;
    }
  }

  async readJournalIndex(sessionId: string): Promise<JournalIndex | null> {
    const file = this.sessionMap.get(sessionId)?.journalIndex;
    if (!file) return null;
    try {
      return parseJournalIndex(JSON.parse(await file.text()));
    } catch {
      return null;
    }
  }

  async readCheckpoint(
    sessionId: string,
    chunkIndex: number,
  ): Promise<unknown> {
    const file = this.sessionMap.get(sessionId)?.checkpoints.get(chunkIndex);
    if (!file) return null;
    try {
      return JSON.parse(await file.text());
    } catch {
      return null;
    }
  }

  async readChunk(sessionId: string, chunkIndex: number) {
    const file = this.sessionMap.get(sessionId)?.chunks.get(chunkIndex);
    if (!file) return [];
    return parseEventsJsonl(await file.text());
  }

  async readLogChunk(
    sessionId: string,
    chunkIndex: number,
  ): Promise<LogEvent[]> {
    const file = this.sessionMap.get(sessionId)?.logChunks.get(chunkIndex);
    if (!file) return [];
    return parseEventsJsonl(await file.text()) as unknown as LogEvent[];
  }
}
