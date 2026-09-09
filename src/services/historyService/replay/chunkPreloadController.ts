import type { HistoryEvent } from '../types';
import type { HistoryManifest } from '../source/types';
import type { ChunkLoader, EventChunk } from '../chunkLoader';
import { findEventChunkIndex } from '../manifestParser';

export type AppendLogsCallback = (
  chunk: EventChunk,
  isStale: () => boolean,
) => Promise<void>;

export type PlayerInterface = {
  append: (events: HistoryEvent[]) => void;
  setAwaitingMoreEvents: (value: boolean) => void;
};

export class ChunkPreloadController {
  private lastAppendedChunkIndex = 0;
  private playingChunkIndex = 0;
  private isPreloadingNextChunk = false;
  private version = 0;

  constructor(
    private readonly loader: ChunkLoader,
    private readonly manifest: HistoryManifest,
    private readonly player: PlayerInterface,
    private readonly appendLogs: AppendLogsCallback,
  ) {}

  /** Increment version + reset flags. Call at start of seek(). */
  invalidate(): void {
    this.version++;
    this.isPreloadingNextChunk = false;
    this.player.setAwaitingMoreEvents(false);
  }

  /** Set chunk indices after seek or initial load completes. */
  reset(chunkIndex: number): void {
    this.lastAppendedChunkIndex = chunkIndex;
    this.playingChunkIndex = chunkIndex;
  }

  getVersion(): number {
    return this.version;
  }

  updatePlayingChunkIndex(currentTimeUs: number): void {
    this.playingChunkIndex = findEventChunkIndex(this.manifest, currentTimeUs);
  }

  ensureOneChunkAhead(): void {
    if (this.isPreloadingNextChunk) return;
    const nextIndex = this.lastAppendedChunkIndex + 1;
    if (nextIndex >= this.manifest.chunkCount) {
      this.player.setAwaitingMoreEvents(false);
      return;
    }
    const chunksAhead = this.lastAppendedChunkIndex - this.playingChunkIndex;
    if (chunksAhead >= 1) return;
    this.isPreloadingNextChunk = true;
    this.player.setAwaitingMoreEvents(true);
    void this.preloadNextChunk(nextIndex).catch((error) => {
      console.warn('[ChunkPreloadController] preload failed', error);
      this.isPreloadingNextChunk = false;
      this.player.setAwaitingMoreEvents(false);
    });
  }

  private async preloadNextChunk(nextIndex: number): Promise<void> {
    const version = this.version;
    console.debug('[ChunkPreloadController] preload start', {
      nextIndex,
      version,
      lastAppendedChunkIndex: this.lastAppendedChunkIndex,
    });
    try {
      const nextChunk = await this.loader.loadEventChunk(nextIndex);
      console.debug('[ChunkPreloadController] event chunk loaded', {
        nextIndex,
        stale: version !== this.version,
        eventsCount: nextChunk.events.length,
      });
      if (version !== this.version) return;
      this.player.append(nextChunk.events);
      console.debug('[ChunkPreloadController] events appended', {
        nextIndex,
        eventsCount: nextChunk.events.length,
      });
      this.lastAppendedChunkIndex = nextIndex;
      const hasNextChunk = nextIndex + 1 < this.manifest.chunkCount;
      this.player.setAwaitingMoreEvents(hasNextChunk);
      void this.appendLogs(nextChunk, () => version !== this.version);
      this.isPreloadingNextChunk = false;
    } finally {
      if (version === this.version) {
        this.isPreloadingNextChunk = false;
      }
    }
  }
}
