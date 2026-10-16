import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChunkPreloadController } from '../chunkPreloadController';
import type { AppendLogsCallback } from '../chunkPreloadController';
import type { HistoryManifest } from '../../source/types';
import type { EventChunk } from '../../chunkLoader';
import type { HistoryEvent } from '../../types';

const flushPromises = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

const makeManifest = (chunkCount: number): HistoryManifest => ({
  version: 1,
  startUs: 0,
  endUs: chunkCount * 10_000_000,
  chunkDurationUs: 10_000_000,
  chunkCount,
});

const makeEvent = (tsUs: number): HistoryEvent =>
  ({
    version: 1,
    ts_us: tsUs,
    message: 'filters',
    graph_v: 1,
    filters: [],
  }) as HistoryEvent;

const makeChunk = (index: number): EventChunk => ({
  index,
  fromUs: index * 10_000_000,
  toUs: (index + 1) * 10_000_000,
  events: [makeEvent(index * 10_000_000 + 1_000_000)],
});

describe('ChunkPreloadController', () => {
  let loader: { loadEventChunk: ReturnType<typeof vi.fn> };
  let player: {
    append: ReturnType<typeof vi.fn>;
    setAwaitingMoreEvents: ReturnType<typeof vi.fn>;
  };
  let appendLogs: AppendLogsCallback;

  beforeEach(() => {
    loader = { loadEventChunk: vi.fn() };
    player = {
      append: vi.fn(),
      setAwaitingMoreEvents: vi.fn(),
    };
    appendLogs = vi.fn().mockResolvedValue(undefined);
  });

  function makeController(chunkCount = 3, hasNextSegment = false) {
    return new ChunkPreloadController(
      loader as any,
      makeManifest(chunkCount),
      player,
      appendLogs,
      hasNextSegment,
    );
  }

  describe('ensureOneChunkAhead', () => {
    it('does not preload when already preloading', () => {
      const controller = makeController();
      controller.reset(0);
      loader.loadEventChunk.mockReturnValue(new Promise(() => {}));

      controller.ensureOneChunkAhead();
      controller.ensureOneChunkAhead();

      expect(loader.loadEventChunk).toHaveBeenCalledOnce();
    });

    it('does not preload when one chunk already ahead', () => {
      const controller = makeController();
      controller.reset(1);
      controller.updatePlayingChunkIndex(0);

      controller.ensureOneChunkAhead();

      expect(loader.loadEventChunk).not.toHaveBeenCalled();
    });

    it('marks no more events and skips load when at last chunk of the last segment', () => {
      const controller = makeController(2, false);
      controller.reset(1);

      controller.ensureOneChunkAhead();

      expect(player.setAwaitingMoreEvents).toHaveBeenCalledWith(false);
      expect(loader.loadEventChunk).not.toHaveBeenCalled();
    });

    it('signals more events at manifest end when a next segment exists', () => {
      const controller = makeController(2, true);
      controller.reset(1);

      controller.ensureOneChunkAhead();

      expect(player.setAwaitingMoreEvents).toHaveBeenCalledWith(true);
      expect(loader.loadEventChunk).not.toHaveBeenCalled();
    });

    it('appends events to player after loading next chunk', async () => {
      const controller = makeController(3);
      controller.reset(0);
      const chunk1 = makeChunk(1);
      loader.loadEventChunk.mockResolvedValue(chunk1);

      controller.ensureOneChunkAhead();
      await flushPromises();

      expect(player.append).toHaveBeenCalledWith(chunk1.events);
    });

    it('signals more events available when next-next chunk exists', async () => {
      const controller = makeController(3);
      controller.reset(0);
      loader.loadEventChunk.mockResolvedValue(makeChunk(1));

      controller.ensureOneChunkAhead();
      await flushPromises();

      expect(player.setAwaitingMoreEvents).toHaveBeenLastCalledWith(true);
    });

    it('signals no more events after loading the last chunk of the last segment', async () => {
      const controller = makeController(2, false);
      controller.reset(0);
      loader.loadEventChunk.mockResolvedValue(makeChunk(1));

      controller.ensureOneChunkAhead();
      await flushPromises();

      expect(player.setAwaitingMoreEvents).toHaveBeenLastCalledWith(false);
    });

    it('keeps signaling more events after loading the last chunk when a next segment exists', async () => {
      const controller = makeController(2, true);
      controller.reset(0);
      loader.loadEventChunk.mockResolvedValue(makeChunk(1));

      controller.ensureOneChunkAhead();
      await flushPromises();

      expect(player.setAwaitingMoreEvents).toHaveBeenLastCalledWith(true);
    });

    it('calls appendLogs with chunk and isStale function', async () => {
      const controller = makeController(3);
      controller.reset(0);
      const chunk1 = makeChunk(1);
      loader.loadEventChunk.mockResolvedValue(chunk1);

      controller.ensureOneChunkAhead();
      await flushPromises();

      expect(appendLogs).toHaveBeenCalledWith(chunk1, expect.any(Function));
    });
  });

  describe('invalidate', () => {
    it('cancels in-flight preload — events not appended after invalidate', async () => {
      const controller = makeController(3);
      controller.reset(0);
      loader.loadEventChunk.mockResolvedValue(makeChunk(1));

      controller.ensureOneChunkAhead();
      controller.invalidate();
      await flushPromises();

      expect(player.append).not.toHaveBeenCalled();
    });

    it('resets isPreloading so ensureOneChunkAhead can restart', async () => {
      const controller = makeController(3);
      controller.reset(0);
      loader.loadEventChunk.mockResolvedValue(makeChunk(1));

      controller.ensureOneChunkAhead();
      controller.invalidate();
      controller.reset(0);
      loader.loadEventChunk.mockResolvedValue(makeChunk(1));
      controller.ensureOneChunkAhead();
      await flushPromises();

      expect(player.append).toHaveBeenCalledOnce();
    });
  });

  describe('isStale callback', () => {
    it('returns false before invalidate', async () => {
      const controller = makeController(3);
      controller.reset(0);
      loader.loadEventChunk.mockResolvedValue(makeChunk(1));

      let capturedIsStale: (() => boolean) | null = null;
      (appendLogs as ReturnType<typeof vi.fn>).mockImplementation(
        (_chunk: EventChunk, isStale: () => boolean) => {
          capturedIsStale = isStale;
          return Promise.resolve();
        },
      );

      controller.ensureOneChunkAhead();
      await flushPromises();

      expect(capturedIsStale?.()).toBe(false);
    });

    it('returns true after invalidate', async () => {
      const controller = makeController(3);
      controller.reset(0);
      loader.loadEventChunk.mockResolvedValue(makeChunk(1));

      let capturedIsStale: (() => boolean) | null = null;
      (appendLogs as ReturnType<typeof vi.fn>).mockImplementation(
        (_chunk: EventChunk, isStale: () => boolean) => {
          capturedIsStale = isStale;
          return Promise.resolve();
        },
      );

      controller.ensureOneChunkAhead();
      await flushPromises();

      controller.invalidate();
      expect(capturedIsStale?.()).toBe(true);
    });
  });

  describe('reset', () => {
    it('allows preloading from new chunk position after reset', async () => {
      const controller = makeController(4);
      controller.reset(2);
      const chunk3 = makeChunk(3);
      loader.loadEventChunk.mockResolvedValue(chunk3);

      controller.ensureOneChunkAhead();
      await flushPromises();

      expect(loader.loadEventChunk).toHaveBeenCalledWith(3);
      expect(player.append).toHaveBeenCalledWith(chunk3.events);
    });
  });
});
