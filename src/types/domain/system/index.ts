export interface CPUStats {
  timestamp: number;
  sessionTimeUs?: number;
  total_cpu_usage: number;
  process_cpu_usage: number;
  process_memory: number;
  physical_memory: number;
  physical_memory_avail: number;
  gpac_memory: number;
  nb_cores: number;
  thread_count: number;
  memory_usage_percent: number;
  process_memory_percent: number;
  gpac_memory_percent: number;
  cpu_efficiency: number;
}

export const CPU_STATS_FIELDS = [
  'total_cpu_usage',
  'process_cpu_usage',
  'process_memory',
  'physical_memory',
  'physical_memory_avail',
  'gpac_memory',
  'thread_count',
] as const;

export type CPUStatsField = (typeof CPU_STATS_FIELDS)[number];
