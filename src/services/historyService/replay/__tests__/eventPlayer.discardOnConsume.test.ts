import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventPlayer } from '../eventPlayer';
import type { HistoryEvent } from '../../types';

const EVENTS_PER_CHUNK = 1_000;
const EVENT_SPACING_US = 10;
const CHUNK_SPAN_US = EVENTS_PER_CHUNK * EVENT_SPACING_US;
const APPENDED_CHUNK_COUNT = 200;

function makeChunk(chunkIndex: number): HistoryEvent[] {
  return Array.from({ length: EVENTS_PER_CHUNK }, (_unused, position) => ({
    version: 1,
    ts_us: chunkIndex * CHUNK_SPAN_US + position * EVENT_SPACING_US,
    message: 'cpu_stats' as const,
    stats: {} as any,
  }));
}

function advanceTo(player: EventPlayer, targetUs: number): void {
  vi.mocked(performance.now).mockReturnValue(targetUs / 1000);
  (player as any).tick();
}

describe('EventPlayer — discard-on-consume overflow proof', () => {
  beforeEach(() => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the timeline bounded while replaying every event once, in order', () => {
    const player = new EventPlayer();
    const receivedTimestamps: number[] = [];
    player.load(makeChunk(0), (event) => receivedTimestamps.push(event.ts_us));
    player.play();

    let largestTimelineLength = 0;
    for (let chunkIndex = 1; chunkIndex <= APPENDED_CHUNK_COUNT; chunkIndex++) {
      player.append(makeChunk(chunkIndex));
      largestTimelineLength = Math.max(
        largestTimelineLength,
        (player as any).timelineEvents.length,
      );
      advanceTo(player, chunkIndex * CHUNK_SPAN_US - EVENT_SPACING_US);
    }
    advanceTo(player, (APPENDED_CHUNK_COUNT + 1) * CHUNK_SPAN_US);

    const totalEventCount = (APPENDED_CHUNK_COUNT + 1) * EVENTS_PER_CHUNK;
    expect(receivedTimestamps).toHaveLength(totalEventCount);
    expect(
      receivedTimestamps.every(
        (timestampUs, position) => timestampUs === position * EVENT_SPACING_US,
      ),
    ).toBe(true);
    expect(largestTimelineLength).toBeLessThanOrEqual(2 * EVENTS_PER_CHUNK);
    expect(player.getState()).toBe('done');
  });
});
