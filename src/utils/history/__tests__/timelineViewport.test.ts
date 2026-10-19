import { describe, it, expect } from 'vitest';
import {
  clampViewport,
  zoomViewportAroundTime,
  centerViewportOnTime,
  MIN_VISIBLE_DURATION_US,
  type TimelineViewport,
} from '../timelineViewport';

const SESSION_US = 60_000_000;

const fullViewport: TimelineViewport = {
  sessionDurationUs: SESSION_US,
  visibleStartUs: 0,
  visibleDurationUs: SESSION_US,
};

describe('clampViewport', () => {
  it('clamps a negative start to 0', () => {
    const result = clampViewport({
      ...fullViewport,
      visibleDurationUs: 10_000_000,
      visibleStartUs: -5_000_000,
    });
    expect(result.visibleStartUs).toBe(0);
  });

  it('clamps an overflowing start to sessionDuration - visibleDuration', () => {
    const result = clampViewport({
      ...fullViewport,
      visibleDurationUs: 10_000_000,
      visibleStartUs: 55_000_000,
    });
    expect(result.visibleStartUs).toBe(SESSION_US - 10_000_000);
  });

  it('never lets the visible window exceed the session', () => {
    const result = clampViewport({
      ...fullViewport,
      visibleDurationUs: SESSION_US * 2,
      visibleStartUs: 0,
    });
    expect(result.visibleDurationUs).toBe(SESSION_US);
  });

  it('does not mutate the input', () => {
    const input = { ...fullViewport, visibleStartUs: -1 };
    clampViewport(input);
    expect(input.visibleStartUs).toBe(-1);
  });
});

describe('zoomViewportAroundTime', () => {
  it('halves the window and centers it on the anchor', () => {
    const result = zoomViewportAroundTime(fullViewport, 30_000_000, 0.5);
    expect(result.visibleDurationUs).toBe(SESSION_US / 2);
    expect(result.visibleStartUs).toBe(15_000_000);
  });

  it('floors the window at MIN_VISIBLE_DURATION_US', () => {
    const tight: TimelineViewport = {
      sessionDurationUs: SESSION_US,
      visibleStartUs: 0,
      visibleDurationUs: MIN_VISIBLE_DURATION_US,
    };
    const result = zoomViewportAroundTime(tight, 0, 0.5);
    expect(result.visibleDurationUs).toBe(MIN_VISIBLE_DURATION_US);
  });

  it('caps the window at sessionDuration when zooming out', () => {
    const result = zoomViewportAroundTime(fullViewport, 30_000_000, 4);
    expect(result.visibleDurationUs).toBe(SESSION_US);
  });

  it('keeps the area right of the anchor visible near the end of a 72h session', () => {
    const hourUs = 3_600_000_000;
    const longSession: TimelineViewport = {
      sessionDurationUs: 72 * hourUs,
      visibleStartUs: 0,
      visibleDurationUs: 72 * hourUs,
    };
    const anchorUs = 71 * hourUs + 43 * 60_000_000 + 32_000_000;
    const result = zoomViewportAroundTime(longSession, anchorUs, 0.5);
    expect(result.visibleDurationUs).toBe(36 * hourUs);
    expect(result.visibleStartUs + result.visibleDurationUs).toBe(72 * hourUs);
  });
});

describe('centerViewportOnTime', () => {
  it('centers the window on a mid time symmetrically', () => {
    const windowed: TimelineViewport = {
      sessionDurationUs: SESSION_US,
      visibleStartUs: 0,
      visibleDurationUs: 10_000_000,
    };
    const result = centerViewportOnTime(windowed, 30_000_000);
    expect(result.visibleStartUs).toBe(25_000_000);
    expect(result.visibleDurationUs).toBe(10_000_000);
  });

  it('clamps without changing duration when near a bound', () => {
    const windowed: TimelineViewport = {
      sessionDurationUs: SESSION_US,
      visibleStartUs: 0,
      visibleDurationUs: 10_000_000,
    };
    const result = centerViewportOnTime(windowed, 1_000_000);
    expect(result.visibleStartUs).toBe(0);
    expect(result.visibleDurationUs).toBe(10_000_000);
  });
});
