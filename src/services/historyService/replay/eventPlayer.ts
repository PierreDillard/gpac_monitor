import type { HistoryEvent } from '../types';

export type PlayerState = 'idle' | 'playing' | 'paused' | 'done' | 'waiting';
export type PlayerListener = (state: PlayerState, timeUs: number) => void;

/**
 * EventPlayer — replays HistoryEvent[] into Redux via rAF + batch.
 *
 * Processes all events whose ts_us <= current playback time each frame.
 * No drift: playback time is based on wall-clock delta from play start.
 */
export class EventPlayer {
  private timelineEvents: HistoryEvent[] = [];
  private onEvent: ((event: HistoryEvent) => void) | null = null;
  private onTick: ((currentTimeUs: number) => void) | null = null;
  private nextEventIndex = 0;
  private state: PlayerState = 'idle';
  private animationFrameId: number | null = null;
  private listener?: PlayerListener;
  private awaitingMoreEvents = false;

  // Timing
  private playbackStartTimeMs = 0;
  private startEventUs = 0;
  private currentPlaybackTimeUs = 0;

  setListener(listener: PlayerListener) {
    this.listener = listener;
  }

  load(
    timelineEvents: HistoryEvent[],
    onEvent: (event: HistoryEvent) => void,
    onTick?: (currentTimeUs: number) => void,
    positionUs?: number,
  ) {
    this.cancelFrame();
    this.timelineEvents = timelineEvents;
    this.onEvent = onEvent;
    this.onTick = onTick ?? null;
    this.nextEventIndex = 0;
    if (positionUs !== undefined) {
      this.currentPlaybackTimeUs = positionUs;
      this.setState('paused');
    } else {
      this.currentPlaybackTimeUs = 0;
      this.setState('idle');
    }
  }

  play(resetStateFromSnapshot?: () => void) {
    if (!this.timelineEvents.length || !this.onEvent) return;

    if (this.state === 'paused') {
      this.playbackStartTimeMs = performance.now();
      this.startEventUs = this.currentPlaybackTimeUs;
    } else {
      // Restarting from idle/done — reset Redux state before replaying
      resetStateFromSnapshot?.();
      this.playbackStartTimeMs = performance.now();
      this.startEventUs = this.timelineEvents[0]?.ts_us ?? 0;
      this.currentPlaybackTimeUs = this.startEventUs;
      this.nextEventIndex = 0;
    }

    this.setState('playing');
    this.scheduleFrame();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.currentPlaybackTimeUs = this.currentTimeUs();
    this.cancelFrame();
    this.setState('paused');
  }

  stop() {
    this.cancelFrame();
    this.nextEventIndex = 0;
    this.currentPlaybackTimeUs = 0;
    this.setState('idle');
  }

  getState(): PlayerState {
    return this.state;
  }

  currentTimeUs(): number {
    if (this.state === 'playing') {
      const elapsedMs = performance.now() - this.playbackStartTimeMs;
      return this.startEventUs + elapsedMs * 1000;
    }
    return this.currentPlaybackTimeUs;
  }
  /**
   * Appends new events to the timeline without interrupting the current playback.
   * @param events - The events to append.
   */
  append(events: HistoryEvent[]): void {
    if (!events.length) return;
    this.timelineEvents = this.timelineEvents.concat(events);
    if (this.state === 'waiting') {
      this.playbackStartTimeMs = performance.now();
      this.startEventUs = this.currentPlaybackTimeUs;
      this.setState('playing');
      this.scheduleFrame();
    }
  }

  setAwaitingMoreEvents(value: boolean): void {
    this.awaitingMoreEvents = value;
  }

  durationUs(): number {
    if (!this.timelineEvents.length) return 0;
    return (
      this.timelineEvents[this.timelineEvents.length - 1].ts_us -
      this.timelineEvents[0].ts_us
    );
  }

  private setState(state: PlayerState) {
    this.state = state;
    if (this.listener) this.listener(state, this.currentTimeUs());
  }

  private scheduleFrame() {
    this.animationFrameId = requestAnimationFrame(() => this.tick());
  }

  private cancelFrame() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private tick() {
    if (this.state !== 'playing' || !this.onEvent) return;

    const now = this.currentTimeUs();

    while (this.nextEventIndex < this.timelineEvents.length) {
      const event = this.timelineEvents[this.nextEventIndex];
      if (event.ts_us > now) break;
      this.onEvent!(event);
      this.nextEventIndex++;
    }
    this.onTick?.(now);

    if (this.nextEventIndex >= this.timelineEvents.length) {
      if (this.awaitingMoreEvents) {
        this.currentPlaybackTimeUs = now;
        this.setState('waiting');
        return;
      }
      this.currentPlaybackTimeUs =
        this.timelineEvents[this.timelineEvents.length - 1].ts_us;
      this.setState('done');
      return;
    }

    this.scheduleFrame();
  }
}
