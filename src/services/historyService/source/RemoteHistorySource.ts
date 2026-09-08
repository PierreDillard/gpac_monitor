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
import { WsSessionFileReader } from '../sessionFileReader/WsSessionFileReader';

export class RemoteHistorySource implements HistorySource {
  private cachedManifest: HistoryManifest | null | undefined = undefined;
  private manifestPromise: Promise<HistoryManifest | null> | null = null;

  constructor(
    private reader: WsSessionFileReader,
    readonly sessionId: string,
  ) {}

  async loadSnapshot(): Promise<HistorySnapshot> {
    return this.reader.readSnapshot(this.sessionId);
  }

  getManifest(): Promise<HistoryManifest | null> {
    return this.loadManifest();
  }

  async readChunk(index: number, segmentDir?: string): Promise<HistoryEvent[]> {
    return this.reader.readChunk(this.sessionId, index, segmentDir);
  }

  async readLogChunk(index: number, segmentDir?: string): Promise<LogEvent[]> {
    return this.reader.readLogChunk(this.sessionId, index, segmentDir);
  }

  async readCheckpoint(
    chunkIndex: number,
    segmentDir?: string,
  ): Promise<unknown> {
    return this.reader.readCheckpoint(this.sessionId, chunkIndex, segmentDir);
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

  private loadManifest(): Promise<HistoryManifest | null> {
    if (this.cachedManifest !== undefined)
      return Promise.resolve(this.cachedManifest);
    if (!this.manifestPromise) {
      this.manifestPromise = this.reader
        .readManifest(this.sessionId)
        .then((manifest) => {
          this.cachedManifest = manifest;
          return manifest;
        });
    }
    return this.manifestPromise;
  }
}
