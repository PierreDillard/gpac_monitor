import { useMemo } from 'react';
import type { PIDproperties, PIDStats } from '@/types/domain/gpac/filter-stats';

export interface PIDPerformanceStats {
  // From PIDproperties
  bitrate: number | null;
  // From PIDStats — names match source exactly
  disconnected: boolean;
  average_bitrate: number | null;
  max_bitrate: number | null;
  average_process_rate: number | null;
  max_process_rate: number | null;
  nb_processed: number;
  average_process_time: number | null;
  max_process_time: number;
  total_process_time: number;
  last_ts_sent: PIDStats['last_ts_sent'] | null;
  first_process_time: number | null;
  last_process_time: number | null;
}

export const usePIDPerformanceStats = (
  pid: PIDproperties,
): PIDPerformanceStats => {
  return useMemo(() => {
    const stats = pid.stats;

    return {
      bitrate: pid.bitrate,
      disconnected: stats?.disconnected ?? false,
      average_bitrate:
        stats && stats.average_bitrate >= 0 ? stats.average_bitrate : null,
      max_bitrate: stats && stats.max_bitrate >= 0 ? stats.max_bitrate : null,
      average_process_rate:
        stats && stats.average_process_rate >= 0
          ? stats.average_process_rate
          : null,
      max_process_rate:
        stats && stats.max_process_rate >= 0 ? stats.max_process_rate : null,
      nb_processed: stats?.nb_processed ?? 0,
      average_process_time:
        stats?.average_process_time != null
          ? Math.round(stats.average_process_time * 10) / 10
          : null,
      max_process_time: stats?.max_process_time ?? 0,
      total_process_time: stats?.total_process_time ?? 0,
      last_ts_sent: stats?.last_ts_sent ?? null,
      first_process_time: stats?.first_process_time ?? null,
      last_process_time: stats?.last_process_time ?? null,
    };
  }, [pid.bitrate, pid.stats]);
};
