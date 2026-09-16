import type { AppDispatch } from '@/shared/store';
import type {
  HistorySnapshot,
  HistoryEvent,
  LogEvent,
  TimelineEvent,
} from './types';
import { HistoryAdapter } from './integration/historyAdapter';
import {
  deriveTimelineEvents,
  deriveErrorWarningEvents,
} from './integration/deriveTimelineEvents';
import { EventPlayer } from './replay/eventPlayer';
import type { PlayerState, PlayerListener } from './replay/eventPlayer';
import {
  BadgeExpirationController,
  BADGE_DURATION_US,
} from './replay/badgeExpirationController';
import { ChunkPreloadController } from './replay/chunkPreloadController';
import type { AppendLogsCallback } from './replay/chunkPreloadController';
import { resolveSegmentSwitch } from './replay/resolveSegmentSwitch';
import { flattenLogEvents } from './replay/flattenLogEvents';
import type {
  HistoryManifest,
  HistorySource,
  HistorySessionIndex,
} from './source/types';
import { ChunkLoader } from './chunkLoader';
import type { EventChunk } from './chunkLoader';
import { findEventChunkIndex, findNearestCheckpoint } from './manifestParser';
import {
  findNextSegmentDir,
  findPreviousSegmentDir,
  getSegmentDir,
  getSegmentToUs,
  hasNextSegment,
} from './sessionIndexParser';

/**
 * HistoryController — orchestrates snapshot loading + event replay.
 * Owns the EventPlayer and HistoryAdapter instances.
 */
export class HistoryController {
  private player = new EventPlayer();
  private adapter: HistoryAdapter | null = null;
  private badgeExpiration = new BadgeExpirationController();
  private snapshot: HistorySnapshot | null = null;
  private sessionStartUs = 0;
  private sessionLogs: LogEvent[] = [];
  private nextLogIndex = 0;
  private loader: ChunkLoader | null = null;
  private manifest: HistoryManifest | null = null;
  private sessionIndex: HistorySessionIndex | null = null;
  private source: HistorySource | null = null;
  private segmentDir: string | undefined;
  private loadedChunkIndex: number | null = null;
  private preloader: ChunkPreloadController | null = null;
  private timelineEvents: TimelineEvent[] = [];
  private userListener: PlayerListener | null = null;

  constructor() {
    this.player.setListener(this.handlePlayerStateChange);
  }

  setListener(listener: PlayerListener) {
    this.userListener = listener;
  }

  private handlePlayerStateChange = (
    state: PlayerState,
    timeUs: number,
  ): void => {
    this.userListener?.(state, timeUs);
    if (state === 'waiting') {
      void this.tryRolloverToNextSegment();
    }
  };

  /**
   * Forward playback hit the end of the current segment's last loaded chunk
   * (task 15 E2). Swap loader/preloader to segment N+1 and append its first
   * chunk — adapter/baseState untouched, only a true seek re-hydrates.
   */
  private async tryRolloverToNextSegment(): Promise<void> {
    const currentPreloader = this.preloader;
    if (!currentPreloader || !currentPreloader.isAtSegmentEnd()) return;
    if (!this.sessionIndex || !this.segmentDir || !this.source) return;

    const nextSegmentDir = findNextSegmentDir(
      this.sessionIndex,
      this.segmentDir,
    );
    if (!nextSegmentDir) return;

    const versionBeforeSwitch = currentPreloader.getVersion();
    const manifest = await this.source.getSegmentManifest(nextSegmentDir);
    if (versionBeforeSwitch !== currentPreloader.getVersion() || !manifest)
      return;

    const loader = new ChunkLoader(this.source, manifest, nextSegmentDir);
    const firstChunk = await loader.loadEventChunk(0);
    if (versionBeforeSwitch !== currentPreloader.getVersion()) return;

    const newPreloader = new ChunkPreloadController(
      loader,
      manifest,
      this.player,
      this.appendLogs,
      hasNextSegment(this.sessionIndex, nextSegmentDir),
    );
    const newPreloaderVersion = newPreloader.getVersion();

    this.manifest = manifest;
    this.loader = loader;
    this.preloader = newPreloader;
    this.segmentDir = nextSegmentDir;
    this.loadedChunkIndex = 0;

    this.player.append(firstChunk.events);
    void this.appendLogs(
      firstChunk,
      () => newPreloader.getVersion() !== newPreloaderVersion,
    );
    newPreloader.reset(0);
    newPreloader.ensureOneChunkAhead();
  }

  private handleReplayEvent = (event: HistoryEvent): void => {
    if (!this.adapter) return;
    this.adapter.handleEvent(event);
    this.scheduleBadgeIfNeeded(event);
  };

  private flushVisibleLogs(currentTimeUs: number): void {
    if (!this.adapter) return;
    const dueLogEvents: LogEvent[] = [];
    while (
      this.nextLogIndex < this.sessionLogs.length &&
      this.sessionLogs[this.nextLogIndex].ts_us <= currentTimeUs
    ) {
      dueLogEvents.push(this.sessionLogs[this.nextLogIndex]);
      this.nextLogIndex++;
    }
    if (dueLogEvents.length > 0) this.adapter.handleLogEvents(dueLogEvents);
  }

  private handlePlaybackTick = (currentTimeUs: number): void => {
    this.flushVisibleLogs(currentTimeUs);
    const expired = this.badgeExpiration.tick(currentTimeUs);
    if (expired.length > 0 && this.adapter) {
      this.adapter.clearExpiredBadges(expired);
    }
    if (this.manifest && this.preloader) {
      this.preloader.updatePlayingChunkIndex(currentTimeUs);
    }
    this.preloader?.ensureOneChunkAhead();
  };

  private appendLogs: AppendLogsCallback = async (
    chunk: EventChunk,
    isStale: () => boolean,
  ): Promise<void> => {
    if (!this.loader) return;
    try {
      const logChunks = await this.loader.loadLogChunksInRange(
        chunk.fromUs,
        chunk.toUs,
      );
      if (isStale()) return;
      const lastTs =
        this.sessionLogs.length > 0
          ? this.sessionLogs[this.sessionLogs.length - 1].ts_us
          : 0;
      const nextLogs = flattenLogEvents(
        logChunks.flatMap((logChunk) => logChunk.logs),
      )
        .filter((log) => log.ts_us > lastTs)
        .sort((leftLog, rightLog) => leftLog.ts_us - rightLog.ts_us);
      this.sessionLogs = [...this.sessionLogs, ...nextLogs];
    } catch (error) {
      console.warn('[HistoryController] log preload failed', error);
    }
  };

  private async loadLogsForChunk(chunk: EventChunk): Promise<void> {
    if (!this.loader)
      throw new Error('[HistoryController] Loader not initialized');

    const logChunks = await this.loader.loadLogChunksInRange(
      chunk.fromUs,
      chunk.toUs,
    );

    this.sessionLogs = flattenLogEvents(
      logChunks.flatMap((logChunk) => logChunk.logs),
    ).sort((leftLog, rightLog) => leftLog.ts_us - rightLog.ts_us);

    this.nextLogIndex = 0;
  }

  private async loadInitialPlaybackChunk(): Promise<void> {
    if (!this.loader)
      throw new Error('[HistoryController] Loader not initialized');

    const firstChunk = await this.loader.loadEventChunk(0);

    await this.loadLogsForChunk(firstChunk);

    this.player.load(
      firstChunk.events,
      this.handleReplayEvent,
      this.handlePlaybackTick,
    );

    this.preloader?.reset(0);
    this.loadedChunkIndex = 0;
    this.preloader?.ensureOneChunkAhead();
  }

  async load(source: HistorySource, dispatch: AppDispatch) {
    const sessionIndex = await source.getSessionIndex();
    this.sessionIndex = sessionIndex;
    this.source = source;
    const segmentDir = sessionIndex?.segments[0]
      ? getSegmentDir(sessionIndex.segments[0])
      : undefined;
    this.segmentDir = segmentDir;
    const manifest = segmentDir
      ? await source.getSegmentManifest(segmentDir)
      : await source.getManifest();
    if (!manifest)
      throw new Error('[HistoryController] No manifest for session');

    this.manifest = manifest;
    const sessionStartUs = sessionIndex?.startUs ?? manifest.startUs;
    const eventsIndex = segmentDir
      ? ((await source.loadGlobalEventsIndex()) ?? [])
      : (manifest.eventsIndex ?? []);
    const journalIndex =
      segmentDir || manifest.journalIndex
        ? await source.loadJournalIndex()
        : null;
    this.timelineEvents = [
      ...deriveTimelineEvents(eventsIndex, sessionStartUs),
      ...deriveErrorWarningEvents(journalIndex, sessionStartUs),
    ].sort((left, right) => left.sessionTimeUs - right.sessionTimeUs);
    this.loader = new ChunkLoader(source, manifest, segmentDir);
    this.preloader = new ChunkPreloadController(
      this.loader,
      manifest,
      this.player,
      this.appendLogs,
      sessionIndex && segmentDir
        ? hasNextSegment(sessionIndex, segmentDir)
        : false,
    );

    const snapshot = segmentDir
      ? await source.loadSegmentSnapshot(segmentDir)
      : await source.loadSnapshot();

    this.snapshot = snapshot;
    this.sessionStartUs = sessionStartUs;
    this.sessionLogs = [];
    this.nextLogIndex = 0;
    this.loadedChunkIndex = null;
    this.adapter = new HistoryAdapter(dispatch);
    this.adapter.hydrate(snapshot, sessionStartUs);
    this.badgeExpiration.reset();
    this.player.load([], this.handleReplayEvent, this.handlePlaybackTick);
  }

  async seek(tsUs: number): Promise<void> {
    this.preloader?.invalidate();
    if (
      !this.manifest ||
      !this.loader ||
      !this.adapter ||
      !this.preloader ||
      !this.source
    )
      return;
    const { adapter, source } = this;
    let manifest = this.manifest;
    let loader = this.loader;
    let preloader = this.preloader;
    let segmentDir = this.segmentDir;

    const switchResult = await resolveSegmentSwitch({
      sessionIndex: this.sessionIndex,
      source,
      tsUs,
      segmentDir,
      preloader,
      player: this.player,
      appendLogs: this.appendLogs,
    });
    if (switchResult.stale) return;
    if (!switchResult.changed && switchResult.failed) {
      console.warn('[HistoryController] seek: segment switch failed, aborting');
      return;
    }
    if (switchResult.changed) {
      manifest = switchResult.manifest;
      loader = switchResult.loader;
      preloader = switchResult.preloader;
      segmentDir = switchResult.segmentDir;
      this.manifest = manifest;
      this.loader = loader;
      this.preloader = preloader;
      this.snapshot = switchResult.snapshot;
      this.segmentDir = segmentDir;
    }
    const version = preloader.getVersion();

    const chunkIndex = findEventChunkIndex(manifest, tsUs);
    const cp = findNearestCheckpoint(manifest, chunkIndex);
    adapter.resetTemporalState();
    if (cp) {
      const checkpoint = await loader.loadCheckpoint(cp.file);
      if (version !== preloader.getVersion()) return;
      adapter.clearTimeSeriesData();
      if (checkpoint) adapter.hydrateCheckpoint(checkpoint);
    }
    this.badgeExpiration.reset();

    const currentChunk = await loader.loadEventChunk(chunkIndex);
    if (version !== preloader.getVersion()) return;
    if (!cp) {
      adapter.clearTimeSeriesData();
      if (this.snapshot) adapter.hydrate(this.snapshot, this.sessionStartUs);
    }

    await this.loadLogsForChunk(currentChunk);
    this.nextLogIndex = this.getNextLogIndexFromTimestamp(tsUs);
    adapter.hydrateLogsForSeek(this.sessionLogs, tsUs);

    const prevChunkStats: HistoryEvent[] = [];
    if (chunkIndex > 0) {
      const prevChunk = await loader.loadEventChunk(chunkIndex - 1);
      if (version !== preloader.getVersion()) return;
      this.collectStatsEvents(prevChunk.events, prevChunkStats);
    } else if (this.sessionIndex && segmentDir) {
      const previousSegmentDir = findPreviousSegmentDir(
        this.sessionIndex,
        segmentDir,
      );
      if (previousSegmentDir) {
        const previousManifest =
          await source.getSegmentManifest(previousSegmentDir);
        if (version !== preloader.getVersion()) return;
        if (previousManifest) {
          const previousEvents = await source.readChunk(
            previousManifest.chunkCount - 1,
            previousSegmentDir,
          );
          if (version !== preloader.getVersion()) return;
          this.collectStatsEvents(previousEvents, prevChunkStats);
        }
      }
    }

    const eventsBeforeSeek = currentChunk.events.filter(
      (event) => event.ts_us <= tsUs,
    );
    if (prevChunkStats.length > 0 || eventsBeforeSeek.length > 0) {
      adapter.setSilent(true);
      for (const event of prevChunkStats) {
        adapter.handleEvent(event);
      }
      for (const event of eventsBeforeSeek) {
        adapter.handleEvent(event);
      }
      adapter.flush(tsUs);
      // Re-schedule expiry for events inside the pc window so ticks can clear them.
      const badgeWindowStart = tsUs - BADGE_DURATION_US;
      for (const event of eventsBeforeSeek) {
        if (event.ts_us >= badgeWindowStart) {
          this.scheduleBadgeIfNeeded(event);
        }
      }
    }

    this.player.load(
      currentChunk.events.filter((event) => event.ts_us > tsUs),
      this.handleReplayEvent,
      this.handlePlaybackTick,
      tsUs,
    );

    preloader.reset(chunkIndex);
    this.loadedChunkIndex = chunkIndex;
    preloader.ensureOneChunkAhead();
  }

  async play(): Promise<void> {
    if (this.loadedChunkIndex === null) {
      await this.loadInitialPlaybackChunk();
    }
    this.player.play(() => {
      console.warn('[HistoryController] player restart callback called', {
        currentTimeUs: this.player.currentTimeUs(),
        loadedChunkIndex: this.loadedChunkIndex,
      });
      if (this.adapter && this.snapshot) {
        this.adapter.hydrate(this.snapshot, this.sessionStartUs);
        this.nextLogIndex = 0;
      }
    });
  }

  pause() {
    this.player.pause();
  }

  stop() {
    this.player.stop();
  }

  getState(): PlayerState {
    return this.player.getState();
  }

  currentTimeUs(): number {
    return this.player.currentTimeUs();
  }

  durationUs(): number {
    if (this.sessionIndex && this.sessionIndex.segments.length > 0) {
      const lastPosition = this.sessionIndex.segments.length - 1;
      const lastSegment = this.sessionIndex.segments[lastPosition];
      const toUs =
        getSegmentToUs(this.sessionIndex, lastPosition) ??
        (lastSegment.fromUs ?? 0) + this.sessionIndex.segmentDurationUs;
      return toUs - this.sessionStartUs;
    }
    if (this.manifest) return this.manifest.endUs - this.manifest.startUs;
    return this.player.durationUs();
  }

  getSessionStartUs(): number {
    return this.sessionStartUs;
  }

  getTimelineEvents(): TimelineEvent[] {
    return this.timelineEvents;
  }

  private collectStatsEvents(
    events: HistoryEvent[],
    into: HistoryEvent[],
  ): void {
    for (const event of events) {
      if (event.message === 'session_stats' || event.message === 'cpu_stats') {
        into.push(event);
      }
    }
  }

  private getNextLogIndexFromTimestamp(timestampUs: number): number {
    const firstReplayableLogIndex = this.sessionLogs.findIndex(
      (log) => log.ts_us >= timestampUs,
    );

    return firstReplayableLogIndex === -1
      ? this.sessionLogs.length
      : firstReplayableLogIndex;
  }

  // Registers badge expiry for structural events; ticks call clearExpiredBadges when due.
  private scheduleBadgeIfNeeded(event: HistoryEvent): void {
    if (event.message === 'filter_pid_reconfigured') {
      for (const idx of event.indexes) {
        this.badgeExpiration.schedule(idx, 'pid', event.ts_us);
      }
    } else if (event.message === 'filter_arg_updated') {
      for (const idx of event.indexes) {
        this.badgeExpiration.schedule(idx, 'arg', event.ts_us);
      }
    }
  }
}

/** Singleton instance */
export const historyController = new HistoryController();
