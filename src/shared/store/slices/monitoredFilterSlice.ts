import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
  PIDMetricSample,
  PIDGraphTarget,
} from '@/components/views/stats-session/types/pid';
import type { StatusMetricSample } from '@/components/views/stats-session/types/statusMetric';
import type { ParsedFilterStatus } from '@/utils/metrics/filterStatusParser';

/**
 * Generic data point for charts (time-series data)
 */
export interface ChartDataPoint {
  timestamp: number;
  value: number;
}

/**
 * Network chart data for a single filter
 */
interface NetworkChartData {
  outband: ChartDataPoint[];
  inband: ChartDataPoint[];
}

/**
 * Chart data per filter - extensible for other metrics
 */
interface FilterChartData {
  network?: NetworkChartData;
  lastTaskTime?: ChartDataPoint[];
}

/**
 * Monitored filter state - stores chart data per filter
 * Session-only (not persisted to localStorage)
 */
export interface MonitoredFilterState {
  dataByFilter: Record<string, FilterChartData>;
  maxPoints: number; // Default: 600 (10 min at 1Hz)
  selectedPidTargets: PIDGraphTarget[];
  pidSamples: Record<string, PIDMetricSample[]>;
  maxPidSamples: number;
  statusMetricSamples: Record<string, StatusMetricSample[]>;
  selectedStatusMetricByFilter: Record<number, string[]>;
  parsedStatusByFilterIdx: Record<number, ParsedFilterStatus>;
}

const initialState: MonitoredFilterState = {
  dataByFilter: {},
  maxPoints: 600,
  selectedPidTargets: [],
  pidSamples: {},
  maxPidSamples: 300,
  statusMetricSamples: {},
  selectedStatusMetricByFilter: {},
  parsedStatusByFilterIdx: {},
};

const monitoredFilterSlice = createSlice({
  name: 'monitoredFilter',
  initialState,
  reducers: {
    /**
     * Add network data point (outband or inband)
     */
    addNetworkDataPoint: (
      state,
      action: PayloadAction<{
        filterId: string;
        type: 'outband' | 'inband';
        point: ChartDataPoint;
      }>,
    ) => {
      const { filterId, type, point } = action.payload;

      if (!state.dataByFilter[filterId]) {
        state.dataByFilter[filterId] = {};
      }
      const data = state.dataByFilter[filterId];

      if (!data.network) {
        data.network = {
          outband: [],
          inband: [],
        };
      }

      const dataArray = data.network[type];

      // Add new point
      dataArray.push(point);

      // Maintain sliding window - keep only last maxPoints
      if (dataArray.length > state.maxPoints) {
        dataArray.shift();
      }
    },

    addCombinedNetworkPoint: (
      state,
      action: PayloadAction<{
        filterId: string;
        outband: ChartDataPoint;
        inband: ChartDataPoint;
        lastTaskTime: ChartDataPoint;
      }>,
    ) => {
      const { filterId, outband, inband, lastTaskTime } = action.payload;
      if (!state.dataByFilter[filterId]) state.dataByFilter[filterId] = {};
      const data = state.dataByFilter[filterId];
      if (!data.network) data.network = { outband: [], inband: [] };
      if (!data.lastTaskTime) data.lastTaskTime = [];

      data.network.outband.push(outband);
      if (data.network.outband.length > state.maxPoints)
        data.network.outband.shift();
      data.network.inband.push(inband);
      if (data.network.inband.length > state.maxPoints)
        data.network.inband.shift();
      data.lastTaskTime.push(lastTaskTime);
      if (data.lastTaskTime.length > state.maxPoints) data.lastTaskTime.shift();
    },

    /**
     * Clear all chart data for a specific filter
     */
    clearFilterData: (state, action: PayloadAction<string>) => {
      delete state.dataByFilter[action.payload];
    },

    /**
     * Reset all monitored filter data
     */
    resetAllData: (state) => {
      state.dataByFilter = {};
    },

    /** Bulk-add network data (used by seek flush). */
    bulkAddNetworkData: (
      state,
      action: PayloadAction<
        Record<
          string,
          {
            outband: ChartDataPoint[];
            inband: ChartDataPoint[];
            lastTaskTime: ChartDataPoint[];
          }
        >
      >,
    ) => {
      for (const [filterId, data] of Object.entries(action.payload)) {
        if (!state.dataByFilter[filterId]) state.dataByFilter[filterId] = {};
        const filterData = state.dataByFilter[filterId];

        if (!filterData.network)
          filterData.network = { outband: [], inband: [] };
        const network = filterData.network;
        for (const direction of ['outband', 'inband'] as const) {
          network[direction].push(...data[direction]);
          if (network[direction].length > state.maxPoints)
            network[direction].splice(
              0,
              network[direction].length - state.maxPoints,
            );
        }
        if (data.lastTaskTime.length) {
          if (!filterData.lastTaskTime) filterData.lastTaskTime = [];
          const lastTaskTimePoints = filterData.lastTaskTime;
          lastTaskTimePoints.push(...data.lastTaskTime);
          if (lastTaskTimePoints.length > state.maxPoints)
            lastTaskTimePoints.splice(
              0,
              lastTaskTimePoints.length - state.maxPoints,
            );
        }
      }
    },

    toggleSelectedPid: (state, action: PayloadAction<PIDGraphTarget>) => {
      const incoming = action.payload;
      const existingIndex = state.selectedPidTargets.findIndex(
        (existing) =>
          existing.filterIdx === incoming.filterIdx &&
          existing.direction === incoming.direction &&
          existing.pidIndex === incoming.pidIndex,
      );
      if (existingIndex >= 0) {
        state.selectedPidTargets.splice(existingIndex, 1);
      } else if (state.selectedPidTargets.length < 4) {
        state.selectedPidTargets.push(incoming);
      }
    },

    clearSelectedPids: (state) => {
      state.selectedPidTargets = [];
    },

    clearSelectedPidsByFilter: (state, action: PayloadAction<number>) => {
      state.selectedPidTargets = state.selectedPidTargets.filter(
        (target) => target.filterIdx !== action.payload,
      );
    },

    addPIDSample: (
      state,
      action: PayloadAction<{ key: string; sample: PIDMetricSample }>,
    ) => {
      const { key, sample } = action.payload;

      if (!state.pidSamples[key]) {
        state.pidSamples[key] = [];
      }

      const samples = state.pidSamples[key];
      const lastSample = samples[samples.length - 1];

      if (lastSample && lastSample.sessionTimeUs === sample.sessionTimeUs) {
        return;
      }

      samples.push(sample);

      if (samples.length > state.maxPidSamples) {
        samples.shift();
      }
    },

    addPIDSamples: (
      state,
      action: PayloadAction<Array<{ key: string; sample: PIDMetricSample }>>,
    ) => {
      for (const { key, sample } of action.payload) {
        if (!state.pidSamples[key]) state.pidSamples[key] = [];
        const samples = state.pidSamples[key];
        const last = samples[samples.length - 1];
        if (last && last.sessionTimeUs === sample.sessionTimeUs) continue;
        samples.push(sample);
        if (samples.length > state.maxPidSamples) samples.shift();
      }
    },

    clearPIDSamples: (state, action: PayloadAction<string>) => {
      delete state.pidSamples[action.payload];
    },

    clearAllPIDSamples: (state) => {
      state.pidSamples = {};
    },

    clearAllStatusMetricSamples: (state) => {
      state.statusMetricSamples = {};
    },

    addStatusMetricSamples: (
      state,
      action: PayloadAction<Array<{ key: string; sample: StatusMetricSample }>>,
    ) => {
      for (const { key, sample } of action.payload) {
        if (!state.statusMetricSamples[key])
          state.statusMetricSamples[key] = [];
        const samples = state.statusMetricSamples[key];
        const last = samples[samples.length - 1];
        if (
          last &&
          last.sessionTimeUs === sample.sessionTimeUs &&
          last.value === sample.value
        )
          continue;
        samples.push(sample);
        if (samples.length > state.maxPidSamples) samples.shift();
      }
    },

    setSelectedStatusMetric: (
      state,
      action: PayloadAction<{ filterIdx: number; metricKey: string }>,
    ) => {
      const { filterIdx, metricKey } = action.payload;
      const current = state.selectedStatusMetricByFilter[filterIdx] ?? [];
      const index = current.indexOf(metricKey);
      if (index !== -1) {
        current.splice(index, 1);
      } else {
        if (current.length >= 4) current.shift();
        current.push(metricKey);
      }
      state.selectedStatusMetricByFilter[filterIdx] = current;
    },

    setParsedStatuses: (
      state,
      action: PayloadAction<
        Array<{ filterIdx: number; parsedStatus: ParsedFilterStatus }>
      >,
    ) => {
      for (const { filterIdx, parsedStatus } of action.payload) {
        const existing = state.parsedStatusByFilterIdx[filterIdx];
        if (existing?.raw === parsedStatus.raw) continue;
        state.parsedStatusByFilterIdx[filterIdx] = parsedStatus;
      }
    },

    clearStatusMetricsByFilter: (state, action: PayloadAction<number>) => {
      const prefix = `${action.payload}:`;
      for (const key of Object.keys(state.statusMetricSamples)) {
        if (key.startsWith(prefix)) delete state.statusMetricSamples[key];
      }
      delete state.selectedStatusMetricByFilter[action.payload];
    },

    /**
     * Set max points for sliding window
     */
    setMaxPoints: (state, action: PayloadAction<number>) => {
      state.maxPoints = action.payload;
    },
  },
});

export const {
  addNetworkDataPoint,
  bulkAddNetworkData,
  addCombinedNetworkPoint,
  clearFilterData,
  resetAllData,
  setMaxPoints,
  toggleSelectedPid,
  clearSelectedPids,
  clearSelectedPidsByFilter,
  addPIDSample,
  addPIDSamples,
  clearPIDSamples,
  clearAllPIDSamples,
  addStatusMetricSamples,
  clearAllStatusMetricSamples,
  setSelectedStatusMetric,
  clearStatusMetricsByFilter,
  setParsedStatuses,
} = monitoredFilterSlice.actions;

export default monitoredFilterSlice.reducer;
