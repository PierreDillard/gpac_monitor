import { describe, it, expect } from 'vitest';
import {
  enrichFiltersWithStatsStable,
  type EnrichmentCache,
} from '../filterEnrichment';
import type { GraphFilterData } from '@/types/domain/gpac/model';
import type { SessionFilterStatistics } from '@/types/domain/gpac/filter-stats';
import { GpacStreamType } from '@/types/domain/gpac/stream-types';

const staticFilter = (idx: number, name: string): GraphFilterData => ({
  idx,
  name,
  type: 'vout',
  status: '',
  itag: null,
  ID: null,
  nb_ipid: 1,
  nb_opid: 0,
  ipid: [
    {
      pid_index: 0,
      name: 'Video',
      source_idx: 0,
      stream_type: GpacStreamType.Visual,
      ID: 1,
    },
  ],
  opid: [],
});

const stat = (
  idx: number,
  overrides: Partial<SessionFilterStatistics> = {},
): SessionFilterStatistics => ({
  idx,
  status: 'play',
  bytes_done: 1000,
  bytes_sent: 0,
  pck_sent: 0,
  pck_done: 10,
  time: 5000,
  nb_ipid: 1,
  nb_opid: 0,
  is_eos: false,
  ...overrides,
});

describe('enrichFiltersWithStatsStable', () => {
  it('same static filters + identical stats → same object references', () => {
    const cache: EnrichmentCache = new Map();
    const staticFilters = [
      staticFilter(0, 'reframer'),
      staticFilter(1, 'vout'),
    ];
    const stats = [stat(0), stat(1)];

    const first = enrichFiltersWithStatsStable(cache, staticFilters, stats);
    const second = enrichFiltersWithStatsStable(cache, staticFilters, [
      stat(0),
      stat(1),
    ]);

    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
  });

  it('only one filter changes → only its reference changes', () => {
    const cache: EnrichmentCache = new Map();
    const staticFilters = [
      staticFilter(0, 'reframer'),
      staticFilter(1, 'vout'),
    ];

    const first = enrichFiltersWithStatsStable(cache, staticFilters, [
      stat(0),
      stat(1),
    ]);
    const second = enrichFiltersWithStatsStable(cache, staticFilters, [
      stat(0),
      stat(1, { time: 5040, pck_sent: 3 }),
    ]);

    expect(second[0]).toBe(first[0]);
    expect(second[1]).not.toBe(first[1]);
    expect(second[1].time).toBe(5040);
  });

  it('filter removed from staticFilters → cache entry pruned', () => {
    const cache: EnrichmentCache = new Map();
    const staticFilters = [
      staticFilter(0, 'reframer'),
      staticFilter(1, 'vout'),
    ];
    enrichFiltersWithStatsStable(cache, staticFilters, [stat(0), stat(1)]);

    enrichFiltersWithStatsStable(
      cache,
      [staticFilter(0, 'reframer')],
      [stat(0)],
    );

    expect(cache.has(1)).toBe(false);
  });
});
