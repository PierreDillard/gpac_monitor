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
    private readonly hasNextSegment: boolean = false,
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

  /** True once the last chunk of this segment has been appended — not mid-preload. */
  isAtSegmentEnd(): boolean {
    return this.lastAppendedChunkIndex + 1 >= this.manifest.chunkCount;
  }

  updatePlayingChunkIndex(currentTimeUs: number): void {
    this.playingChunkIndex = findEventChunkIndex(this.manifest, currentTimeUs);
  }

  ensureOneChunkAhead(): void {
    if (this.isPreloadingNextChunk) return;
    const nextIndex = this.lastAppendedChunkIndex + 1;
    if (nextIndex >= this.manifest.chunkCount) {
      this.player.setAwaitingMoreEvents(this.hasNextSegment);
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
    try {
      const nextChunk = await this.loader.loadEventChunk(nextIndex);
      if (version !== this.version) return;
      this.player.append(nextChunk.events);
      this.lastAppendedChunkIndex = nextIndex;
      const hasNextChunk =
        nextIndex + 1 < this.manifest.chunkCount || this.hasNextSegment;
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
