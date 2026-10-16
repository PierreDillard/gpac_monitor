import { describe, it, expect } from 'vitest';
import {
  estimateTickLabelWidthPx,
  generateTimeTicks,
  generateWindowTimeTicks,
  type TimeTick,
} from '../generateTimeTicks';

const US = 1_000_000;

describe('generateTimeTicks', () => {
  it('returns empty major and minor for non-positive duration', () => {
    expect(generateTimeTicks(0)).toEqual({ major: [], minor: [] });
    expect(generateTimeTicks(-1)).toEqual({ major: [], minor: [] });
  });

  it('first major tick is always 00:00 at 0%', () => {
    const { major } = generateTimeTicks(90 * US);
    expect(major[0]).toEqual({ positionPercent: 0, label: '00:00' });
  });

  it('major ticks never exceed MAX_TICKS for a short session (90s)', () => {
    const { major } = generateTimeTicks(90 * US);
    expect(major.length).toBeLessThanOrEqual(17);
  });

  it('major ticks never exceed MAX_TICKS for a long session (3h)', () => {
    const { major } = generateTimeTicks(3 * 3600 * US);
    expect(major.length).toBeLessThanOrEqual(17);
  });

  it('formats hours correctly for a 3h session', () => {
    const { major } = generateTimeTicks(3 * 3600 * US);
    expect(major.some((tick) => tick.label === '01:00:00')).toBe(true);
  });

  it('last major tick does not exceed 100%', () => {
    const { major } = generateTimeTicks(90 * US);
    expect(major[major.length - 1].positionPercent).toBeLessThanOrEqual(100);
  });

  it('minor ticks appear between major ticks for intervals >= 5s', () => {
    const { major, minor } = generateTimeTicks(90 * US);
    expect(minor.length).toBeGreaterThan(0);
    const majorPositions = new Set(major.map((t) => t.positionPercent));
    minor.forEach((tick) => {
      expect(majorPositions.has(tick.positionPercent)).toBe(false);
    });
  });

  it('no minor ticks for very short intervals (2s major)', () => {
    const { minor } = generateTimeTicks(10 * US);
    expect(minor.length).toBe(0);
  });
});

describe('generateWindowTimeTicks with a ruler width', () => {
  const SESSION_720H_US = 720 * 3600 * US;

  const expectLabelsNotToOverlap = (
    major: TimeTick[],
    rulerWidthPx: number,
  ) => {
    for (let index = 1; index < major.length; index++) {
      const spacingPx =
        ((major[index].positionPercent - major[index - 1].positionPercent) /
          100) *
        rulerWidthPx;
      const widestHalfLabelsPx =
        (estimateTickLabelWidthPx(major[index].label) +
          estimateTickLabelWidthPx(major[index - 1].label)) /
        2;
      expect(spacingPx).toBeGreaterThan(widestHalfLabelsPx);
    }
  };

  it('labels a 720h session in whole days without overlap at 800px', () => {
    const { major } = generateWindowTimeTicks(0, SESSION_720H_US, 800);
    expect(major.length).toBeLessThanOrEqual(16);
    expect(major[1].label).toBe('2d');
    expectLabelsNotToOverlap(major, 800);
  });

  it('widens the interval on a narrow 300px ruler', () => {
    const { major } = generateWindowTimeTicks(0, SESSION_720H_US, 300);
    expect(major[1].label).toBe('5d');
    expectLabelsNotToOverlap(major, 300);
  });

  it('keeps full precision on ticks inside a day when zoomed', () => {
    const { major } = generateWindowTimeTicks(
      21 * 24 * 3600 * US,
      12 * 3600 * US,
      800,
    );
    expect(major.some((tick) => tick.label === '21d 02:00:00')).toBe(true);
    expectLabelsNotToOverlap(major, 800);
  });
});
