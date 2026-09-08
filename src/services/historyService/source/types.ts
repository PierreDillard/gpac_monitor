import type {
  HistorySnapshot,
  HistoryEvent,
  LogEvent,
  TimelineEventType,
  JournalIndex,
} from '../types';
import type { SessionInfo } from '../sessionFileReader/types';

/** Base chunk — shared by event and log chunks. */
export interface HistoryManifestChunk {
  file: string;
  fromUs: number;
  toUs: number;
  count: number;
}

/** Event chunk — indexed, fixed duration, pilots the player. */
export interface HistoryManifestEventChunk extends HistoryManifestChunk {
  index: number;
  hasCheckpoint: boolean;
}

/** Checkpoint attached to an event chunk. */
export interface HistoryManifestCheckpoint {
  chunkIndex: number; // array position in eventChunks
  file: string;
}

export interface ManifestEventEntry {
  ts_us: number;
  type: TimelineEventType;
  count?: number;
}

/** Pointer to the columnar error/warning index — see JournalIndex in ../types. */
export interface JournalIndexPointer {
  file: string;
  format: string;
  eventCount: number;
  errorCount: number;
  warningCount: number;
}

export interface HistoryManifest {
  version: number;
  startUs: number;
  endUs: number;
  chunkDurationUs: number;
  chunkCount: number;
  snapshot?: string;
  eventChunks?: HistoryManifestChunk[];
  logChunks?: HistoryManifestChunk[];
  checkpoints?: HistoryManifestCheckpoint[];
  eventsIndex?: ManifestEventEntry[];
  journalIndex?: JournalIndexPointer;
}

/** Low-level chunk I/O — implemented by both File and Remote sources. */
export interface IChunkReader {
  readChunk(index: number, segmentDir?: string): Promise<HistoryEvent[]>;
  readLogChunk(index: number, segmentDir?: string): Promise<LogEvent[]>;
  readCheckpoint(chunkIndex: number, segmentDir?: string): Promise<unknown>;
}

export interface HistorySessionIndexSegment {
  index: number;
  fromUs: number | null;
  toUs?: number;
}

export interface HistorySessionIndex {
  version: number;
  startUs: number | null;
  endUs?: number;
  segmentDurationUs: number;
  retentionMaxSegments: number;
  segments: HistorySessionIndexSegment[];
}

/** Per-session data source (player side). */
export interface HistorySource extends IChunkReader {
  readonly sessionId: string;
  loadSnapshot(): Promise<HistorySnapshot>;
  getManifest(): Promise<HistoryManifest | null>;
  loadJournalIndex(): Promise<JournalIndex | null>;
}

/** Session listing (UI picker side)  */
export interface SessionBrowser {
  listSessions(): Promise<SessionInfo[]>;
}
