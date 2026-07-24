import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { PIDStats } from '@/types/domain/gpac/filter-stats';
import { usePIDPerformanceStats } from '../usePIDPerformanceStats';
import { makePID, makeStats } from './fixtures';

describe('usePIDPerformanceStats — sanitisation overflow uint32', () => {
  it('returns null for negative average_process_rate', () => {
    const pid = makePID({
      stats: makeStats({ average_process_rate: -394014916 }),
    });
    const { result } = renderHook(() => usePIDPerformanceStats(pid));
    expect(result.current.average_process_rate).toBeNull();
  });

  it('returns null for negative max_process_rate', () => {
    const pid = makePID({ stats: makeStats({ max_process_rate: -1 }) });
    const { result } = renderHook(() => usePIDPerformanceStats(pid));
    expect(result.current.max_process_rate).toBeNull();
  });

  it('returns null for negative average_bitrate', () => {
    const pid = makePID({ stats: makeStats({ average_bitrate: -500000 }) });
    const { result } = renderHook(() => usePIDPerformanceStats(pid));
    expect(result.current.average_bitrate).toBeNull();
  });

  it('returns null for negative max_bitrate', () => {
    const pid = makePID({ stats: makeStats({ max_bitrate: -1 }) });
    const { result } = renderHook(() => usePIDPerformanceStats(pid));
    expect(result.current.max_bitrate).toBeNull();
  });

  it('passes through zero (valid: no data yet)', () => {
    const pid = makePID({ stats: makeStats({ average_process_rate: 0 }) });
    const { result } = renderHook(() => usePIDPerformanceStats(pid));
    expect(result.current.average_process_rate).toBe(0);
  });

  it('passes through positive values unchanged', () => {
    const pid = makePID({
      bitrate: 160_010,
      stats: makeStats({
        average_process_rate: 867_030_000,
        max_process_rate: 1_200_000_000,
        average_bitrate: 160_000,
        max_bitrate: 192_000,
        max_process_time: 14,
        nb_processed: 3200,
      }),
    });
    const { result } = renderHook(() => usePIDPerformanceStats(pid));
    expect(result.current.bitrate).toBe(160_010);
    expect(result.current.average_process_rate).toBe(867_030_000);
    expect(result.current.max_process_rate).toBe(1_200_000_000);
    expect(result.current.average_bitrate).toBe(160_000);
    expect(result.current.max_bitrate).toBe(192_000);
    expect(result.current.max_process_time).toBe(14);
    expect(result.current.nb_processed).toBe(3200);
  });

  it('maps last_ts_sent undefined to null', () => {
    const pid = makePID({ stats: makeStats({ last_ts_sent: undefined }) });
    const { result } = renderHook(() => usePIDPerformanceStats(pid));
    expect(result.current.last_ts_sent).toBeNull();
  });

  it('preserves last_ts_sent fraction format', () => {
    const ts = { n: 58730, d: 1000 };
    const pid = makePID({ stats: makeStats({ last_ts_sent: ts }) });
    const { result } = renderHook(() => usePIDPerformanceStats(pid));
    expect(result.current.last_ts_sent).toEqual(ts);
  });
});

describe('usePIDPerformanceStats — pid.stats absent (server omits it before first tick)', () => {
  it('does not throw and returns safe defaults when stats is undefined', () => {
    const pid = makePID({ stats: undefined as unknown as PIDStats });
    const { result } = renderHook(() => usePIDPerformanceStats(pid));

    expect(result.current.disconnected).toBe(false);
    expect(result.current.average_bitrate).toBeNull();
    expect(result.current.max_bitrate).toBeNull();
    expect(result.current.nb_processed).toBe(0);
    expect(result.current.last_ts_sent).toBeNull();
  });
});
