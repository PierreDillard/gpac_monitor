import { describe, it, expect } from 'vitest';
import {
  formatFractionAsTimeWithRaw,
  formatCompactTime,
  formatChartTimeFromUs,
} from '../time';

describe('formatCompactTime', () => {
  it('formats 0 µs as 00:00', () => {
    expect(formatCompactTime(0)).toBe('00:00');
  });
  it('formats 8s as 00:08', () => {
    expect(formatCompactTime(8_000_000)).toBe('00:08');
  });
  it('formats 65s as 01:05', () => {
    expect(formatCompactTime(65_000_000)).toBe('01:05');
  });
  it('formats 1h1m1s as 01:01:01', () => {
    expect(formatCompactTime(3_661_000_000)).toBe('01:01:01');
  });
  it('truncates sub-second µs', () => {
    expect(formatCompactTime(8_500_000)).toBe('00:08');
  });
  it('formats 59m59s without hours', () => {
    expect(formatCompactTime(3_599_000_000)).toBe('59:59');
  });
  it('keeps centiseconds with withCs so tooltip matches the journal', () => {
    expect(formatCompactTime(3_350_000, true)).toBe('00:03.35');
    expect(formatCompactTime(3_350_000)).toBe('00:03');
  });
  it('keeps hh:mm:ss just under one day', () => {
    expect(formatCompactTime(86_399_000_000)).toBe('23:59:59');
  });
  it('switches to days at 24h with full precision by default', () => {
    expect(formatCompactTime(86_400_000_000)).toBe('1d 00:00:00');
  });
  it('formats 513h00m51s as 21d 09:00:51', () => {
    expect(formatCompactTime((513 * 3600 + 51) * 1_000_000)).toBe(
      '21d 09:00:51',
    );
  });
  it('keeps centiseconds with days', () => {
    expect(formatCompactTime(2 * 86_400_000_000 + 470_000, true)).toBe(
      '2d 00:00:00.47',
    );
  });
  it('trims a whole day to Nd only when asked', () => {
    expect(formatCompactTime(2 * 86_400_000_000, false, true)).toBe('2d');
    expect(formatCompactTime(2 * 86_400_000_000)).toBe('2d 00:00:00');
    expect(
      formatCompactTime(2 * 86_400_000_000 + 3_600_000_000, false, true),
    ).toBe('2d 01:00:00');
  });
});

describe('formatChartTimeFromUs (regression: timezone offset)', () => {
  it('formats 8 seconds as 00:00:08 (not 01:00:08 with UTC+1)', () => {
    expect(formatChartTimeFromUs(8_000_000)).toBe('00:00:08');
  });
  it('formats 1h8s as 01:00:08 (not 02:00:08)', () => {
    expect(formatChartTimeFromUs(3_608_000_000)).toBe('01:00:08');
  });
  it('uses pure arithmetic, no locale dependency', () => {
    expect(formatChartTimeFromUs(0)).toBe('00:00:00');
    expect(formatChartTimeFromUs(1_000_000)).toBe('00:00:01');
    expect(formatChartTimeFromUs(65_000_000)).toBe('00:01:05');
  });
});

describe('formatFractionAsTimeWithRaw', () => {
  it('formats fraction with readable duration and raw values', () => {
    expect(formatFractionAsTimeWithRaw(1918917, 90000)).toBe(
      '21.32s (1918917/90000)',
    );
  });

  it('formats small fractions correctly', () => {
    expect(formatFractionAsTimeWithRaw(7380, 90000)).toBe('0.08s (7380/90000)');
  });

  it('returns — for den = 0', () => {
    expect(formatFractionAsTimeWithRaw(100, 0)).toBe('—');
  });
});
