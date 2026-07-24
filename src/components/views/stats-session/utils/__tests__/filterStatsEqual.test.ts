import { describe, it, expect } from 'vitest';
import { filterStatsEqual } from '../filterStatsEqual';
import {
  makePID,
  makeStats,
} from '../../monitored_filters/tabs/hooks/__tests__/fixtures';
import type { MonitoredFilterStats } from '@/types/domain/gpac/model';

const snapshot = (): MonitoredFilterStats => ({
  idx: 3,
  status: 'rti=1',
  bytes_done: 188416,
  bytes_sent: 0,
  pck_sent: 0,
  pck_done: 1024,
  time: 500000,
  nb_ipid: 1,
  nb_opid: 1,
  ipids: {
    'ipid-0': makePID({
      name: 'ipid-0',
      buffer: 4000,
      stats: makeStats({ average_bitrate: 128000, nb_processed: 12 }),
    }),
  },
  opids: {
    'opid-0': makePID({ name: 'opid-0', buffer: 0 }),
  },
});

describe('filterStatsEqual', () => {
  it('identical snapshots → true', () => {
    expect(filterStatsEqual(snapshot(), snapshot())).toBe(true);
  });

  it('same reference → true', () => {
    const stats = snapshot();
    expect(filterStatsEqual(stats, stats)).toBe(true);
  });

  it('null vs value → false', () => {
    expect(filterStatsEqual(null, snapshot())).toBe(false);
  });

  it('null vs null → true', () => {
    expect(filterStatsEqual(null, null)).toBe(true);
  });

  it('ipid buffer progressing → false', () => {
    const next = snapshot();
    next.ipids!['ipid-0'].buffer += 1000;
    expect(filterStatsEqual(snapshot(), next)).toBe(false);
  });

  it('ipid nb_processed progressing → false', () => {
    const next = snapshot();
    next.ipids!['ipid-0'].stats.nb_processed += 1;
    expect(filterStatsEqual(snapshot(), next)).toBe(false);
  });

  it('extra PID key → false', () => {
    const next = snapshot();
    next.ipids!['ipid-1'] = makePID({ name: 'ipid-1' });
    expect(filterStatsEqual(snapshot(), next)).toBe(false);
  });

  it('does not throw when a PID has no stats yet (server omits it before first tick)', () => {
    const prev = snapshot();
    prev.ipids!['ipid-0'] = makePID({
      name: 'ipid-0',
      stats: undefined as unknown as ReturnType<typeof makeStats>,
    });
    const next = snapshot();

    expect(() => filterStatsEqual(prev, next)).not.toThrow();
    expect(filterStatsEqual(prev, next)).toBe(false);
  });

  it('two PIDs both missing stats are still considered equal', () => {
    const prev = snapshot();
    const next = snapshot();
    prev.ipids!['ipid-0'] = makePID({
      name: 'ipid-0',
      stats: undefined as unknown as ReturnType<typeof makeStats>,
    });
    next.ipids!['ipid-0'] = makePID({
      name: 'ipid-0',
      stats: undefined as unknown as ReturnType<typeof makeStats>,
    });

    expect(filterStatsEqual(prev, next)).toBe(true);
  });
});
