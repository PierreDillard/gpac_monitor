import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import sessionDetailsReducer, {
  setSystemStats,
} from '@/shared/store/slices/sessionDetailsSlice';
import { dispatchCpuStats } from '../handlers/statsHandler';
import type { CpuStatsEvent } from '../../types';
import type { CPUStats } from '@/types/domain/system';

const EVENT_1: CpuStatsEvent = {
  message: 'cpu_stats',
  ts_us: 3308791,
  stats: {
    total_cpu_usage: 0,
    process_cpu_usage: 11,
    process_memory: 197292032,
    physical_memory: 66624581632,
    physical_memory_avail: 29982257152,
    gpac_memory: 0,
    nb_cores: 20,
    thread_count: 0,
    memory_usage_percent: 54.99820574092817,
    process_memory_percent: 0.2961249844535459,
    gpac_memory_percent: 0,
    cpu_efficiency: 0,
  },
};

const EVENT_2: CpuStatsEvent = {
  message: 'cpu_stats',
  ts_us: 118195672,
  stats: {
    total_cpu_usage: 0,
    process_cpu_usage: 5,
    process_memory: 198930432,
    physical_memory: 66624581632,
    physical_memory_avail: 29990383616,
    gpac_memory: 0,
    nb_cores: 20,
    thread_count: 0,
    memory_usage_percent: 54.98600834501072,
    process_memory_percent: 0.2985841368562577,
    gpac_memory_percent: 0,
    cpu_efficiency: 0,
  },
};

function makeStore() {
  return configureStore({ reducer: { sessionDetails: sessionDetailsReducer } });
}

function pickFields(stats: CPUStats[]) {
  return stats.map(({ timestamp, process_cpu_usage, process_memory }) => ({
    timestamp,
    process_cpu_usage,
    process_memory,
  }));
}

describe('cpu_stats pipeline parity: history vs live', () => {
  it('history and live produce identical CPU data for the same events', () => {
    // --- History pipeline ---
    // CpuStatsEvent → dispatchCpuStats → mapCpuStatsEvent → setSystemStats
    const historyStore = makeStore();
    const pendingCpu: CPUStats[] = [];
    dispatchCpuStats(historyStore.dispatch, EVENT_1, false, pendingCpu);
    dispatchCpuStats(historyStore.dispatch, EVENT_2, false, pendingCpu);
    const historyCpu = pickFields(
      historyStore.getState().sessionDetails.systemStatsHistory,
    );

    // --- Live pipeline ---
    // WS server sends CPUStats directly (timestamp = ts_us set by server)
    const liveStore = makeStore();
    for (const event of [EVENT_1, EVENT_2]) {
      const cpuStats: CPUStats = {
        timestamp: event.ts_us,
        ...event.stats,
        memory_usage_percent: event.stats.memory_usage_percent ?? 0,
        process_memory_percent: event.stats.process_memory_percent ?? 0,
        gpac_memory_percent: event.stats.gpac_memory_percent ?? 0,
        cpu_efficiency: event.stats.cpu_efficiency ?? 0,
      };
      liveStore.dispatch(setSystemStats(cpuStats));
    }
    const liveCpu = pickFields(
      liveStore.getState().sessionDetails.systemStatsHistory,
    );

    expect(historyCpu).toEqual(liveCpu);
    expect(historyCpu).toMatchSnapshot();
  });
});
