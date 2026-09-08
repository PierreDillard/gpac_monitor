import type {
  HistorySnapshot,
  HistoryEvent,
  LogEvent,
  JournalIndex,
} from '../types';
import type {
  HistorySource,
  HistoryManifest,
  HistorySessionIndex,
  ManifestEventEntry,
} from './types';
import type { LocalFileSessionFileReader } from '../sessionFileReader/LocalFileSessionFileReader';

export class FileHistorySource implements HistorySource {
  private cachedManifest: HistoryManifest | null | undefined = undefined;

  constructor(
    private reader: LocalFileSessionFileReader,
    readonly sessionId: string,
  ) {}

  async loadSnapshot(): Promise<HistorySnapshot> {
    return this.reader.readSnapshot(this.sessionId);
  }

  async getManifest(): Promise<HistoryManifest | null> {
    return this.loadManifest();
  }

  async readChunk(index: number): Promise<HistoryEvent[]> {
    return this.reader.readChunk(this.sessionId, index);
  }

  async readLogChunk(index: number): Promise<LogEvent[]> {
    return this.reader.readLogChunk(this.sessionId, index);
  }

  async readCheckpoint(chunkIndex: number): Promise<unknown> {
    return this.reader.readCheckpoint(this.sessionId, chunkIndex);
  }

  async loadJournalIndex(): Promise<JournalIndex | null> {
    return this.reader.readJournalIndex(this.sessionId);
  }

  async getSessionIndex(): Promise<HistorySessionIndex | null> {
    return this.reader.readSessionIndex(this.sessionId);
  }

  async getSegmentManifest(
    segmentDir: string,
  ): Promise<HistoryManifest | null> {
    return this.reader.readManifest(this.sessionId, segmentDir);
  }

  async loadSegmentSnapshot(segmentDir: string): Promise<HistorySnapshot> {
    return this.reader.readSnapshot(this.sessionId, segmentDir);
  }

  async loadGlobalEventsIndex(): Promise<ManifestEventEntry[] | null> {
    return this.reader.readEventsIndex(this.sessionId);
  }

  private async loadManifest(): Promise<HistoryManifest | null> {
    if (this.cachedManifest !== undefined) return this.cachedManifest;
    const manifest = await this.reader.readManifest(this.sessionId);
    this.cachedManifest = manifest;
    return manifest;
  }
}
