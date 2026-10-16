import type { AppDispatch } from '@/shared/store';
import type { MetricDefinitionMap } from '@/utils/metrics/metricDefinitionParser';
import type { CPUStats } from '@/types/domain/system';
import type { ChartDataPoint } from '@/shared/store/slices/monitoredFilterSlice';
import type { SessionFilterStats } from '@/shared/store/slices/sessionStatsSlice';
import type { SessionStatsEvent, CpuStatsEvent } from '../../types';
import type { PIDDynamicByFilter } from '../extractPIDDynamic';
import type { PIDMetricSample } from '@/components/views/stats-session/types/pid';
import type { StatusMetricSample } from '@/components/views/stats-session/types/statusMetric';
import {
  addCombinedNetworkPoint,
  bulkAddNetworkData,
  addPIDSamples,
  addStatusMetricSamples,
  setParsedStatuses,
} from '@/shared/store/slices/monitoredFilterSlice';
import { parseFilterStatus } from '@/utils/metrics/filterStatusParser';
import {
  updateSessionStats,
  setFilterPids,
} from '@/shared/store/slices/sessionStatsSlice';
import type { FilterPids } from '@/shared/store/slices/sessionStatsSlice';
import {
  setSystemStats,
  bulkAddSystemStats,
} from '@/shared/store/slices/sessionDetailsSlice';
import { extractPIDDynamic } from '../extractPIDDynamic';
import { buildStatusSamplesFromStats } from '@/utils/metrics/statusMetricGraph';
import { buildPIDSamplesFromFilterStats } from '@/utils/metrics/pidMetricGraph';
import {
  buildPerfSamplesFromStats,
  type PerfStatEntry,
} from '@/utils/metrics/perfMetricGraph';

export type CombinedBandwidthBuffer = Record<
  string,
  {
    outband: ChartDataPoint[];
    inband: ChartDataPoint[];
    lastTaskTime: ChartDataPoint[];
  }
>;

export type PrevBandwidthState = Record<
  string,
  { bytes_sent: number; bytes_done: number; ts_us: number }
>;

export type PIDSamplesBuffer = Array<{ key: string; sample: PIDMetricSample }>;
export type StatusMetricSamplesBuffer = Array<{
  key: string;
  sample: StatusMetricSample;
}>;

export function mapCpuStatsEvent(event: CpuStatsEvent): CPUStats {
  return {
    ...event.stats,
    timestamp: event.ts_us,
    memory_usage_percent: event.stats.memory_usage_percent ?? 0,
    process_memory_percent: event.stats.process_memory_percent ?? 0,
    gpac_memory_percent: event.stats.gpac_memory_percent ?? 0,
    cpu_efficiency: event.stats.cpu_efficiency ?? 0,
  };
}

export function dispatchSessionStats(
  dispatch: AppDispatch,
  event: SessionStatsEvent,
  sessionStartUs: number,
  prevBandwidth: PrevBandwidthState,
  silent: boolean,
  pendingStats: { stats: SessionFilterStats[]; ts_us: number } | null,
  pendingBandwidth: CombinedBandwidthBuffer,
  pendingPIDSamples: PIDSamplesBuffer,
  pendingPIDDynamic: PIDDynamicByFilter,
  pendingStatusMetricSamples: StatusMetricSamplesBuffer,
  definitions?: MetricDefinitionMap,
): {
  pendingStats: typeof pendingStats;
  pendingBandwidth: CombinedBandwidthBuffer;
  pendingPIDSamples: PIDSamplesBuffer;
  pendingPIDDynamic: PIDDynamicByFilter;
  pendingStatusMetricSamples: StatusMetricSamplesBuffer;
} {
  const statsPayload = {
    stats: event.stats as SessionFilterStats[],
    ts_us: event.ts_us,
  };
  const pidSamples = event.stats.flatMap((stat) =>
    buildPIDSamplesFromFilterStats(stat, event.ts_us, sessionStartUs),
  );
  const pidDynamic = extractPIDDynamic(event.stats);
  const statusSamples = buildStatusSamplesFromStats(
    event.stats,
    event.ts_us,
    sessionStartUs,
    definitions,
  );
  const parsedStatusEntries = event.stats.map((stat) => ({
    filterIdx: stat.idx,
    parsedStatus: parseFilterStatus(stat.status ?? '', definitions),
  }));

  if (silent) {
    pendingStats = statsPayload;
    pendingPIDSamples.push(...pidSamples);
    pendingPIDDynamic = { ...pendingPIDDynamic, ...pidDynamic };
    pendingStatusMetricSamples.push(...statusSamples);
  } else {
    dispatch(updateSessionStats(statsPayload));
    dispatch(setParsedStatuses(parsedStatusEntries));
    if (pidSamples.length) dispatch(addPIDSamples(pidSamples));
    if (Object.keys(pidDynamic).length)
      dispatch(setFilterPids(pidDynamic as Record<string, FilterPids>));
    if (statusSamples.length) dispatch(addStatusMetricSamples(statusSamples));
  }

  const prevStats: Record<string, PerfStatEntry> = {};
  let prevTsUs: number | null = null;
  for (const [filterId, prev] of Object.entries(prevBandwidth)) {
    prevStats[filterId] = {
      idx: Number(filterId),
      bytes_sent: prev.bytes_sent,
      bytes_done: prev.bytes_done,
    };
    prevTsUs = prev.ts_us;
  }
  const points = buildPerfSamplesFromStats(
    event.stats as PerfStatEntry[],
    prevStats,
    event.ts_us,
    prevTsUs,
    sessionStartUs,
  );
  for (const stat of event.stats) {
    prevBandwidth[String(stat.idx)] = {
      bytes_sent: stat.bytes_sent,
      bytes_done: stat.bytes_done,
      ts_us: event.ts_us,
    };
  }

  if (silent) {
    for (const point of points) {
      if (!pendingBandwidth[point.filterId])
        pendingBandwidth[point.filterId] = {
          outband: [],
          inband: [],
          lastTaskTime: [],
        };
      pendingBandwidth[point.filterId].outband.push(point.outband);
      pendingBandwidth[point.filterId].inband.push(point.inband);
      pendingBandwidth[point.filterId].lastTaskTime.push(point.lastTaskTime);
    }
  } else {
    for (const point of points) {
      dispatch(
        addCombinedNetworkPoint({
          filterId: point.filterId,
          outband: point.outband,
          inband: point.inband,
          lastTaskTime: point.lastTaskTime,
        }),
      );
    }
  }

  return {
    pendingStats,
    pendingBandwidth,
    pendingPIDSamples,
    pendingPIDDynamic,
    pendingStatusMetricSamples,
  };
}

export function dispatchCpuStats(
  dispatch: AppDispatch,
  event: CpuStatsEvent,
  silent: boolean,
  pendingCpuStats: CPUStats[],
  sessionStartUs = 0,
): void {
  const stats = mapCpuStatsEvent(event);
  if (sessionStartUs > 0) {
    stats.sessionTimeUs = event.ts_us - sessionStartUs;
  }
  if (silent) {
    pendingCpuStats.push(stats);
  } else {
    dispatch(setSystemStats(stats));
  }
}

export function flushStats(
  dispatch: AppDispatch,
  pendingStats: { stats: SessionFilterStats[]; ts_us: number } | null,
  pendingBandwidth: CombinedBandwidthBuffer,
  pendingCpuStats: CPUStats[],
  pendingPIDSamples: PIDSamplesBuffer,
  pendingPIDDynamic: PIDDynamicByFilter,
  pendingStatusMetricSamples: StatusMetricSamplesBuffer,
  definitions?: MetricDefinitionMap,
): void {
  if (pendingStats) {
    dispatch(updateSessionStats(pendingStats));
    dispatch(
      setParsedStatuses(
        pendingStats.stats.map((stat) => ({
          filterIdx: stat.idx,
          parsedStatus: parseFilterStatus(stat.status ?? '', definitions),
        })),
      ),
    );
  }
  if (Object.keys(pendingBandwidth).length)
    dispatch(bulkAddNetworkData(pendingBandwidth));
  if (pendingCpuStats.length) dispatch(bulkAddSystemStats(pendingCpuStats));
  if (pendingPIDSamples.length) dispatch(addPIDSamples(pendingPIDSamples));
  if (Object.keys(pendingPIDDynamic).length)
    dispatch(setFilterPids(pendingPIDDynamic as Record<string, FilterPids>));
  if (pendingStatusMetricSamples.length)
    dispatch(addStatusMetricSamples(pendingStatusMetricSamples));
}
