import uPlot from 'uplot';
import { formatChartSeconds } from '@/utils/formatting/time';

export interface CpuMemoryDataPoint {
  timestamp: number;
  sessionTimeUs?: number;
  cpu_percent: number;
  memory_mb: number;
}

export interface PreparedCpuMemoryData {
  alignedData: uPlot.AlignedData;
  memoryData: number[];
  cpuData: number[];
}

/**
 * Prepare CPU/Memory chart data for uPlot.
 * x-axis = integer indices [0, 1, ..., n-1] — stable range regardless of time span.
 * timeLabels = formatted relative-second strings for axis/tooltip display.
 */
export function prepareCpuMemoryData(
  dataPoints: CpuMemoryDataPoint[],
): PreparedCpuMemoryData {
  const indices = dataPoints.map((_, i) => i);
  const memoryData = dataPoints.map((p) => p.memory_mb);
  const cpuData = dataPoints.map((p) => p.cpu_percent);

  const alignedData: uPlot.AlignedData = [indices, memoryData, cpuData];

  return {
    alignedData,
    memoryData,
    cpuData,
  };
}

export function formatCpuMemoryTimeLabel(
  dataPoints: CpuMemoryDataPoint[],
  index: number,
  formatSessionTime: (us: number) => string,
): string {
  const point = dataPoints[index];
  if (!point) return '';
  if (point.sessionTimeUs != null)
    return formatSessionTime(point.sessionTimeUs);
  return formatChartSeconds((point.timestamp - dataPoints[0].timestamp) / 1000);
}

/**
 * Calculate dynamic memory Y-axis max value
 */
export function calculateMemoryYMax(currentMemoryMB: number): number {
  const minScale = 100;
  const roundTo = 50;
  const calculated = Math.ceil((currentMemoryMB * 1.5) / roundTo) * roundTo;
  return Math.max(minScale, calculated);
}
