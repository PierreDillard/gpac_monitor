import { describe, it, expect } from 'vitest';
import { buildAlignedData } from '../useAlignedChartData';

describe('buildAlignedData', () => {
  describe('union timeline', () => {
    it('single series: xs = timestamps, values match', () => {
      const result = buildAlignedData([
        {
          label: 'A',
          color: '#fff',
          samples: [
            { sessionTimeUs: 1_000_000, value: 10 },
            { sessionTimeUs: 2_000_000, value: 20 },
          ],
        },
      ]);
      expect(result.data[0]).toEqual([1_000_000, 2_000_000]);
      expect(result.data[1]).toEqual([10, 20]);
    });

    it('two offset series: union xs, nulls at gaps', () => {
      const result = buildAlignedData([
        {
          label: 'A',
          color: '#fff',
          samples: [
            { sessionTimeUs: 1_000_000, value: 10 },
            { sessionTimeUs: 3_000_000, value: 30 },
          ],
        },
        {
          label: 'B',
          color: '#000',
          samples: [
            { sessionTimeUs: 2_000_000, value: 20 },
            { sessionTimeUs: 3_000_000, value: 35 },
          ],
        },
      ]);
      expect(result.data[0]).toEqual([1_000_000, 2_000_000, 3_000_000]);
      expect(result.data[1]).toEqual([10, null, 30]);
      expect(result.data[2]).toEqual([null, 20, 35]);
    });

    it('shared timestamp: both series get their value', () => {
      const result = buildAlignedData([
        {
          label: 'A',
          color: '#fff',
          samples: [{ sessionTimeUs: 5_000_000, value: 1 }],
        },
        {
          label: 'B',
          color: '#000',
          samples: [{ sessionTimeUs: 5_000_000, value: 2 }],
        },
      ]);
      expect(result.data[0]).toEqual([5_000_000]);
      expect(result.data[1]).toEqual([1]);
      expect(result.data[2]).toEqual([2]);
    });

    it('empty inputs: xs = [0], no columns', () => {
      const result = buildAlignedData([]);
      expect(result.series).toHaveLength(0);
      expect(result.data[0]).toEqual([0]);
    });

    it('empty samples: placeholder [0] with null column', () => {
      const result = buildAlignedData([
        { label: 'A', color: '#fff', samples: [] },
      ]);
      expect(result.data[0]).toEqual([0]);
      expect(result.data[1]).toEqual([null]);
    });

    it('series metadata mapped correctly', () => {
      const fmt = (v: number) => `${v}x`;
      const result = buildAlignedData([
        {
          label: 'A',
          color: '#abc',
          formatValue: fmt,
          fill: '#abc1',
          metricLabel: 'Rate',
          samples: [],
        },
      ]);
      expect(result.series[0]).toMatchObject({
        label: 'A',
        color: '#abc',
        formatValue: fmt,
        fill: '#abc1',
        metricLabel: 'Rate',
      });
    });
  });

  describe('windowUs', () => {
    it('keeps all samples when window covers full range', () => {
      const result = buildAlignedData(
        [
          {
            label: 'A',
            color: '#fff',
            samples: [
              { sessionTimeUs: 0, value: 1 },
              { sessionTimeUs: 30_000_000, value: 2 },
              { sessionTimeUs: 60_000_000, value: 3 },
            ],
          },
        ],
        { windowUs: 60_000_000 },
      );
      expect((result.data[0] as number[]).length).toBe(3);
    });

    it('drops samples older than windowUs relative to last', () => {
      const result = buildAlignedData(
        [
          {
            label: 'A',
            color: '#fff',
            samples: [
              { sessionTimeUs: 0, value: 1 },
              { sessionTimeUs: 30_000_000, value: 2 },
              { sessionTimeUs: 65_000_000, value: 3 },
            ],
          },
        ],
        { windowUs: 60_000_000 },
      );
      // lastUs=65s, cutoff=5s → keeps 30s and 65s
      expect(result.data[0]).toEqual([30_000_000, 65_000_000]);
      expect(result.data[1]).toEqual([2, 3]);
    });

    it('window applies per-series, union uses filtered timestamps', () => {
      const result = buildAlignedData(
        [
          {
            label: 'A',
            color: '#fff',
            samples: [
              { sessionTimeUs: 0, value: 10 },
              { sessionTimeUs: 70_000_000, value: 20 },
            ],
          },
          {
            label: 'B',
            color: '#000',
            samples: [
              { sessionTimeUs: 10_000_000, value: 30 },
              { sessionTimeUs: 70_000_000, value: 40 },
            ],
          },
        ],
        { windowUs: 60_000_000 },
      );
      // lastUs=70s, cutoff=10s → A keeps 70s; B keeps 10s and 70s
      expect(result.data[0]).toEqual([10_000_000, 70_000_000]);
      expect(result.data[1]).toEqual([null, 20]);
      expect(result.data[2]).toEqual([30, 40]);
    });
  });
});
