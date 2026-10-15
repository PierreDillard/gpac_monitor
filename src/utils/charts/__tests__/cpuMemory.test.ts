import { describe, it, expect } from 'vitest';
import {
  prepareCpuMemoryData,
  calculateMemoryYMax,
  formatCpuMemoryTimeLabel,
} from '../cpuMemory';
import { formatAxisTime, formatCompactTime } from '@/utils/formatting/time';

describe('prepareCpuMemoryData', () => {
  it('returns empty arrays for empty input', () => {
    const result = prepareCpuMemoryData([]);
    expect(result.cpuData).toEqual([]);
    expect(result.memoryData).toEqual([]);
  });

  it('computes integer indices from timestamps', () => {
    const points = [
      { timestamp: 1000, cpu_percent: 10, memory_mb: 50 },
      { timestamp: 2000, cpu_percent: 20, memory_mb: 60 },
      { timestamp: 3000, cpu_percent: 30, memory_mb: 70 },
    ];
    const result = prepareCpuMemoryData(points);

    expect(result.alignedData[0]).toEqual([0, 1, 2]);
    expect(result.cpuData).toEqual([10, 20, 30]);
    expect(result.memoryData).toEqual([50, 60, 70]);
  });

  it('returns alignedData as [indices, memory, cpu]', () => {
    const points = [{ timestamp: 0, cpu_percent: 5, memory_mb: 100 }];
    const result = prepareCpuMemoryData(points);

    expect(result.alignedData).toEqual([[0], [100], [5]]);
  });
});

describe('formatCpuMemoryTimeLabel', () => {
  it('keeps days in the tooltip but drops them on the axis', () => {
    const points = [
      {
        timestamp: 0,
        sessionTimeUs: (12 * 24 * 3600 + 2 * 3600 + 9 * 60 + 15) * 1_000_000,
        cpu_percent: 5,
        memory_mb: 100,
      },
    ];

    expect(formatCpuMemoryTimeLabel(points, 0, formatCompactTime)).toBe(
      '12d 02:09:15',
    );
    expect(formatCpuMemoryTimeLabel(points, 0, formatAxisTime)).toBe(
      '02:09:15',
    );
  });

  it('formats live points as seconds since the first point', () => {
    const points = [
      { timestamp: 1000, cpu_percent: 10, memory_mb: 50 },
      { timestamp: 91_000, cpu_percent: 20, memory_mb: 60 },
    ];

    expect(formatCpuMemoryTimeLabel(points, 0, formatAxisTime)).toBe('0s');
    expect(formatCpuMemoryTimeLabel(points, 1, formatAxisTime)).toBe('1m 30s');
  });

  it('returns an empty label for an index outside the data', () => {
    expect(formatCpuMemoryTimeLabel([], 3, formatAxisTime)).toBe('');
  });
});

describe('calculateMemoryYMax', () => {
  it('returns minimum scale of 100 for small values', () => {
    expect(calculateMemoryYMax(10)).toBe(100);
  });

  it('rounds up to nearest 50 with 1.5x headroom', () => {
    expect(calculateMemoryYMax(200)).toBe(300);
    expect(calculateMemoryYMax(400)).toBe(600);
  });
});
