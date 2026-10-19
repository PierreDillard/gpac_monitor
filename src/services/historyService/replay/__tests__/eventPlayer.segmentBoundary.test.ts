import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventPlayer } from '../eventPlayer';
import { ChunkPreloadController } from '../chunkPreloadController';
import type { HistoryManifest } from '../../source/types';
import type { HistoryEvent } from '../../types';

const makeEvent = (tsUs: number): HistoryEvent =>
  ({
    version: 1,
    ts_us: tsUs,
    message: 'cpu_stats',
    stats: {} as any,
  }) as HistoryEvent;

const makeSingleChunkManifest = (): HistoryManifest => ({
  version: 1,
  startUs: 0,
  endUs: 10_000_000,
  chunkDurationUs: 10_000_000,
  chunkCount: 1,
});

describe('EventPlayer + ChunkPreloadController — segment boundary (task 15 / E1)', () => {
  let player: EventPlayer;
  let onEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    player = new EventPlayer();
    onEvent = vi.fn();
    vi.spyOn(performance, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('settles in "waiting" (not "done") at manifest end when a next segment exists, and a spurious extra tick is a no-op', () => {
    const loader = { loadEventChunk: vi.fn() };
    const preloader = new ChunkPreloadController(
      loader as any,
      makeSingleChunkManifest(),
      player,
      vi.fn().mockResolvedValue(undefined),
      true, // hasNextSegment
    );
    preloader.reset(0);

    player.load([makeEvent(1_000_000)], onEvent, (currentTimeUs) => {
      preloader.updatePlayingChunkIndex(currentTimeUs);
      preloader.ensureOneChunkAhead();
    });

    player.play();
    (performance.now as ReturnType<typeof vi.fn>).mockReturnValue(2_000); // 2ms elapsed, past the only event
    (player as any).tick();

    expect(player.getState()).toBe('waiting');
    // No next chunk in THIS manifest — awaitingMoreEvents only reflects hasNextSegment, nothing to load yet.
    expect(loader.loadEventChunk).not.toHaveBeenCalled();

    onEvent.mockClear();
    (player as any).tick(); // simulates a stray extra rAF/tick call while 'waiting'

    expect(player.getState()).toBe('waiting');
    expect(onEvent).not.toHaveBeenCalled();
  });
});
