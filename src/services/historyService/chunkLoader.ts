import type { HistoryEvent, LogEvent, HistoryCheckpoint } from './types';
import type {
  HistoryManifest,
  HistoryManifestChunk,
  IChunkReader,
} from './source/types';
import { findLogChunksInRange, getEventChunkRange } from './manifestParser';
import { chunkIndexFromPath } from './source/chunkUtils';

export type EventChunk = {
  index: number;
  fromUs: number;
  toUs: number;
  events: HistoryEvent[];
};

export type LogChunk = {
  fromUs: number;
  toUs: number;
  logs: LogEvent[];
};

const MAX_LOG_CHUNKS = 10;

export class ChunkLoader {
  // Events: 2 slots per segmentDir (current + next). Purged on each load.
  private eventCache = new Map<string, EventChunk>();
  // Logs: keyed by file path. Purged when exceeding MAX_LOG_CHUNKS or via clearCache().
  private logCache = new Map<string, LogChunk>();

  constructor(
    private readonly reader: IChunkReader,
    private readonly manifest: HistoryManifest,
    private readonly segmentDir?: string,
  ) {}

  async loadEventChunk(
    position: number,
    segmentDir: string | undefined = this.segmentDir,
  ): Promise<EventChunk> {
    const key = this.eventCacheKey(segmentDir, position);
    const cached = this.eventCache.get(key);
    if (cached) return cached;

    if (position < 0 || position >= this.manifest.chunkCount) {
      throw new Error(`[ChunkLoader] no eventChunk at position ${position}`);
    }

    const { fromUs, toUs } = getEventChunkRange(this.manifest, position);
    const events = await this.reader.readChunk(position, segmentDir);
    const chunk: EventChunk = { index: position, fromUs, toUs, events };

    this.eventCache.set(key, chunk);
    this.purgeEventCache(segmentDir, position);

    return chunk;
  }

  async preloadEventChunk(position: number): Promise<void> {
    if (this.eventCache.has(this.eventCacheKey(this.segmentDir, position)))
      return;
    if (position < 0 || position >= this.manifest.chunkCount) return;
    try {
      await this.loadEventChunk(position);
    } catch (error) {
      console.warn('[ChunkLoader] preloadEventChunk failed:', error);
    }
  }

  async loadCheckpoint(
    cpFile: string,
    segmentDir: string | undefined = this.segmentDir,
  ): Promise<HistoryCheckpoint | null> {
    const chunkIndex = chunkIndexFromPath(cpFile);
    const raw = await this.reader.readCheckpoint(chunkIndex, segmentDir);
    if (!raw || typeof raw !== 'object') return null;
    return raw as HistoryCheckpoint;
  }

  async loadLogChunksInRange(
    fromUs: number,
    toUs: number,
    segmentDir: string | undefined = this.segmentDir,
  ): Promise<LogChunk[]> {
    const entries = findLogChunksInRange(this.manifest, fromUs, toUs);
    return Promise.all(
      entries.map((entry) => this.loadLogChunk(entry, segmentDir)),
    );
  }

  clearCache(): void {
    this.eventCache.clear();
    this.logCache.clear();
  }

  // --- private ---

  private async loadLogChunk(
    entry: HistoryManifestChunk,
    segmentDir: string | undefined,
  ): Promise<LogChunk> {
    const cached = this.logCache.get(entry.file);
    if (cached) return cached;

    const logIndex = chunkIndexFromPath(entry.file);
    const logs = await this.reader.readLogChunk(logIndex, segmentDir);
    const chunk: LogChunk = { fromUs: entry.fromUs, toUs: entry.toUs, logs };

    this.logCache.set(entry.file, chunk);
    this.purgeLogCache();

    return chunk;
  }

  private eventCacheKey(
    segmentDir: string | undefined,
    position: number,
  ): string {
    return `${segmentDir ?? ''}::${position}`;
  }

  /** Keep only current position and next (position + 1), scoped to segmentDir. */
  private purgeEventCache(
    segmentDir: string | undefined,
    currentPosition: number,
  ): void {
    const prefix = `${segmentDir ?? ''}::`;
    const currentKey = this.eventCacheKey(segmentDir, currentPosition);
    const nextKey = this.eventCacheKey(segmentDir, currentPosition + 1);
    for (const key of this.eventCache.keys()) {
      if (key.startsWith(prefix) && key !== currentKey && key !== nextKey) {
        this.eventCache.delete(key);
      }
    }
  }

  /** Delete oldest entry when log cache exceeds MAX_LOG_CHUNKS. */
  private purgeLogCache(): void {
    if (this.logCache.size > MAX_LOG_CHUNKS) {
      const oldest = this.logCache.keys().next().value;
      if (oldest !== undefined) this.logCache.delete(oldest);
    }
  }
}
