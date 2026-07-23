import type { AppDispatch } from '@/shared/store';
import type { CPUStats } from '@/types/domain/system';
import type {
  SessionFilterStats,
  FilterPids,
} from '@/shared/store/slices/sessionStatsSlice';
import {
  setLoading,
  clearGraph,
  markPidReconfigured,
  markArgUpdated,
  clearPidReconfigured,
  clearArgUpdated,
} from '@/shared/store/slices/graphSlice';
import { filtersUpdated } from '@/shared/store/actions/globalActions';
import {
  resetAllData,
  clearAllPIDSamples,
  clearAllStatusMetricSamples,
  setParsedStatuses,
} from '@/shared/store/slices/monitoredFilterSlice';
import {
  setCommandLine,
  clearSessionDetails,
  resetSystemStatsHistory,
} from '@/shared/store/slices/sessionDetailsSlice';
import {
  updateSessionStats,
  setFilterPids,
  clearFilterPids,
  setMetricDefinitions,
} from '@/shared/store/slices/sessionStatsSlice';
import {
  parseMetricDefinitions,
  type MetricDefinitionMap,
} from '@/utils/metrics/metricDefinitionParser';
import {
  applyArgUpdate,
  hydrateFilterArgs,
  clearFilterArgs,
} from '@/shared/store/slices/filterArgumentSlice';
import {
  clearLogs,
  appendLogsForAllTools,
} from '@/shared/store/slices/logsSlice';
import type {
  HistoryEvent,
  HistorySnapshot,
  HistoryCheckpoint,
  HistoryFilter,
  FiltersEvent,
  FilterArgsUpdateEvent,
  LogEvent,
} from '../types';
import { parseFilterStatus } from '@/utils/metrics/filterStatusParser';
import type { GpacArgument } from '@/types/domain/gpac/gpac_args';
import type { GpacLogEntry } from '@/types/domain/gpac/log-types';
import {
  toGraphFilterData,
  buildPidsByFilter,
  buildArgsByFilter,
  toSessionFilterStats,
} from '../loader/snapshotHydrator';
import {
  dispatchSessionStats,
  dispatchCpuStats,
  flushStats,
} from './handlers/statsHandler';
import type {
  CombinedBandwidthBuffer,
  PrevBandwidthState,
  PIDSamplesBuffer,
  StatusMetricSamplesBuffer,
} from './handlers/statsHandler';
import type { PIDDynamicByFilter } from './extractPIDDynamic';
import {
  dispatchLogEvent,
  dispatchLogEvents,
  applyLogConfig,
} from './handlers/logHandler';
import {
  MAX_LOGS_ON_SEEK,
  BADGE_WINDOW_US,
  filterRecentIndexes,
} from './utils/flushHelpers';

export type { HistoryCheckpoint };

export class HistoryAdapter {
  private prevBandwidth: PrevBandwidthState = {};
  private baseArgs: Record<string, GpacArgument[]> = {};
  private sessionStartUs = 0;
  private silent = false;
  private pendingBandwidth: CombinedBandwidthBuffer = {};
  private pendingCpuStats: CPUStats[] = [];
  private pendingLastFilters: FiltersEvent | null = null;
  private pendingLastStats: {
    stats: SessionFilterStats[];
    ts_us: number;
  } | null = null;
  private pendingFilterArgs: FilterArgsUpdateEvent[] = [];
  private pendingPidTimestamps = new Map<number, number>();
  private pendingArgTimestamps = new Map<number, number>();
  private pendingPidsByFilter: Record<string, FilterPids> = {};
  private pendingArgsByFilter: Record<string, GpacArgument[]> = {};
  private pendingPIDSamples: PIDSamplesBuffer = [];
  private pendingPIDDynamic: PIDDynamicByFilter = {};
  private pendingStatusMetricSamples: StatusMetricSamplesBuffer = [];

  private localMetricDefinitions: MetricDefinitionMap = {};

  constructor(private dispatch: AppDispatch) {}

  setSilent(on: boolean): void {
    this.silent = on;
    if (on) {
      this.pendingBandwidth = {};
      this.pendingCpuStats = [];
      this.pendingLastFilters = null;
      this.pendingLastStats = null;
      this.pendingFilterArgs = [];
      this.pendingPidTimestamps = new Map();
      this.pendingArgTimestamps = new Map();
      this.pendingPidsByFilter = {};
      this.pendingArgsByFilter = {};
      this.pendingPIDSamples = [];
      this.pendingPIDDynamic = {};
      this.pendingStatusMetricSamples = [];
    }
  }

  flush(targetUs?: number): void {
    this.silent = false;
    if (this.pendingLastFilters) this.handleFilters(this.pendingLastFilters);
    for (const arg of this.pendingFilterArgs) this.handleFilterArgsUpdate(arg);
    flushStats(
      this.dispatch,
      this.pendingLastStats,
      this.pendingBandwidth,
      this.pendingCpuStats,
      this.pendingPIDSamples,
      this.pendingPIDDynamic,
      this.pendingStatusMetricSamples,
      this.localMetricDefinitions,
    );
    const badgeMinUs = targetUs !== undefined ? targetUs - BADGE_WINDOW_US : 0;
    const recentPidIndexes = filterRecentIndexes(
      this.pendingPidTimestamps,
      badgeMinUs,
    );
    if (recentPidIndexes.length > 0) {
      this.dispatch(markPidReconfigured(recentPidIndexes));
    }
    if (Object.keys(this.pendingPidsByFilter).length > 0) {
      this.dispatch(setFilterPids(this.pendingPidsByFilter));
    }
    const recentArgIndexes = filterRecentIndexes(
      this.pendingArgTimestamps,
      badgeMinUs,
    );
    if (recentArgIndexes.length > 0) {
      this.dispatch(markArgUpdated(recentArgIndexes));
    }
    if (Object.keys(this.pendingArgsByFilter).length > 0) {
      this.dispatch(hydrateFilterArgs(this.pendingArgsByFilter));
    }
    this.pendingBandwidth = {};
    this.pendingCpuStats = [];
    this.pendingLastFilters = null;
    this.pendingLastStats = null;
    this.pendingFilterArgs = [];
    this.pendingPidTimestamps = new Map();
    this.pendingArgTimestamps = new Map();
    this.pendingPidsByFilter = {};
    this.pendingArgsByFilter = {};
    this.pendingPIDSamples = [];
    this.pendingPIDDynamic = {};
    this.pendingStatusMetricSamples = [];
  }

  private rebuildParsedStatuses(filters: HistoryFilter[]): void {
    this.dispatch(
      setParsedStatuses(
        filters.map((filter) => ({
          filterIdx: filter.idx,
          parsedStatus: parseFilterStatus(
            filter.status ?? '',
            this.localMetricDefinitions,
          ),
        })),
      ),
    );
  }

  clearTimeSeriesData(): void {
    this.dispatch(resetSystemStatsHistory());
    this.dispatch(resetAllData());
    this.dispatch(clearAllPIDSamples());
    this.dispatch(clearAllStatusMetricSamples());
  }

  resetTemporalState(): void {
    this.prevBandwidth = {};
    this.pendingBandwidth = {};
    this.pendingCpuStats = [];
    this.pendingLastStats = null;
  }

  private applyMetricDefinitions(raw: string | null | undefined): void {
    if (!raw) return;
    this.localMetricDefinitions = parseMetricDefinitions(raw);
    this.dispatch(setMetricDefinitions(this.localMetricDefinitions));
  }

  hydrateCheckpoint(checkpoint: HistoryCheckpoint): void {
    this.resetTemporalState();
    const { dispatch } = this;
    dispatch(clearGraph());
    dispatch(filtersUpdated(checkpoint.filters.map(toGraphFilterData)));
    dispatch(clearFilterPids());
    const pidsByFilter = buildPidsByFilter(checkpoint.filters);
    if (checkpoint.pid_state) {
      for (const [idx, allPidProperties] of Object.entries(
        checkpoint.pid_state,
      )) {
        const filterIpids = pidsByFilter[idx]?.ipids;
        if (filterIpids) {
          for (const [pidKey, propsMap] of Object.entries(allPidProperties)) {
            if (filterIpids[pidKey]) {
              filterIpids[pidKey] = {
                ...filterIpids[pidKey],
                properties: propsMap,
              };
            }
          }
        }
      }
    }
    dispatch(setFilterPids(pidsByFilter));
    dispatch(clearFilterArgs());
    dispatch(hydrateFilterArgs(this.baseArgs));
    if (checkpoint.arg_state) {
      dispatch(hydrateFilterArgs(checkpoint.arg_state));
    }
    this.applyMetricDefinitions(checkpoint.metric_defs);
    this.rebuildParsedStatuses(checkpoint.filters);
  }

  hydrate(snapshot: HistorySnapshot, sessionStartUs: number): void {
    this.sessionStartUs = sessionStartUs;
    this.prevBandwidth = {};
    this.pendingBandwidth = {};
    this.pendingCpuStats = [];
    this.baseArgs = buildArgsByFilter(snapshot.filters);
    const { dispatch } = this;
    dispatch(resetAllData());
    dispatch(clearSessionDetails());
    dispatch(clearLogs());
    if (snapshot.log_config)
      applyLogConfig(dispatch, snapshot.log_config, true);
    dispatch(clearGraph());
    dispatch(filtersUpdated(snapshot.filters.map(toGraphFilterData)));
    dispatch(setCommandLine(snapshot.command_line));
    dispatch(
      updateSessionStats({ stats: snapshot.filters.map(toSessionFilterStats) }),
    );
    dispatch(clearFilterPids());
    dispatch(setFilterPids(buildPidsByFilter(snapshot.filters)));
    dispatch(clearFilterArgs());
    dispatch(hydrateFilterArgs(this.baseArgs));
    this.applyMetricDefinitions(snapshot.session_metrics);
    this.rebuildParsedStatuses(snapshot.filters);
    dispatch(setLoading(false));
  }

  handleEvent(event: HistoryEvent): void {
    switch (event.message) {
      case 'filters':
        this.handleFilters(event);
        break;
      case 'session_stats': {
        const result = dispatchSessionStats(
          this.dispatch,
          event,
          this.sessionStartUs,
          this.prevBandwidth,
          this.silent,
          this.pendingLastStats,
          this.pendingBandwidth,
          this.pendingPIDSamples,
          this.pendingPIDDynamic,
          this.pendingStatusMetricSamples,
          this.localMetricDefinitions,
        );
        this.pendingLastStats = result.pendingStats;
        this.pendingBandwidth = result.pendingBandwidth;
        this.pendingPIDSamples = result.pendingPIDSamples;
        this.pendingPIDDynamic = result.pendingPIDDynamic;
        this.pendingStatusMetricSamples = result.pendingStatusMetricSamples;
        break;
      }
      case 'cpu_stats':
        dispatchCpuStats(
          this.dispatch,
          event,
          this.silent,
          this.pendingCpuStats,
          this.sessionStartUs,
        );
        break;
      case 'filter_args_update':
        this.handleFilterArgsUpdate(event);
        break;
      case 'filter_pid_reconfigured':
        if (this.silent) {
          for (const idx of event.indexes) {
            this.pendingPidTimestamps.set(idx, event.ts_us);
          }
          if (event.pidsByFilter) {
            for (const [idx, ipids] of Object.entries(event.pidsByFilter)) {
              this.pendingPidsByFilter[idx] = { ipids };
            }
          }
        } else {
          this.dispatch(markPidReconfigured(event.indexes));
          if (event.pidsByFilter) {
            const pidsForStore = Object.fromEntries(
              Object.entries(event.pidsByFilter).map(([idx, ipids]) => [
                idx,
                { ipids },
              ]),
            );
            this.dispatch(setFilterPids(pidsForStore));
          }
        }
        break;
      case 'filter_arg_updated':
        if (this.silent) {
          for (const idx of event.indexes) {
            this.pendingArgTimestamps.set(idx, event.ts_us);
          }
          if (event.argsByFilter) {
            for (const [idx, args] of Object.entries(event.argsByFilter)) {
              this.pendingArgsByFilter[idx] = args;
            }
          }
        } else {
          this.dispatch(markArgUpdated(event.indexes));
          if (event.argsByFilter) {
            this.dispatch(hydrateFilterArgs(event.argsByFilter));
          }
        }
        break;
    }
  }

  handleLogEvents(events: LogEvent[]): void {
    dispatchLogEvents(this.dispatch, events);
  }

  /** Dispatch the last N logs before targetUs (used by seek). */
  hydrateLogsForSeek(logEvents: LogEvent[], targetUs: number): void {
    this.dispatch(clearLogs());
    const allEntries: GpacLogEntry[] = [];
    let lastConfig: string | null = null;
    for (const event of logEvents) {
      if (event.ts_us > targetUs) break;
      if (event.message === 'log_batch') allEntries.push(...event.logs);
      else if (event.message === 'log_config_changed')
        lastConfig = event.logLevel;
    }
    if (lastConfig !== null) {
      dispatchLogEvent(this.dispatch, {
        version: 1,
        ts_us: 0,
        message: 'log_config_changed',
        logLevel: lastConfig,
      });
    }
    if (allEntries.length > 0) {
      this.dispatch(appendLogsForAllTools(allEntries.slice(-MAX_LOGS_ON_SEEK)));
    }
  }

  clearExpiredBadges(
    expired: Array<{ filterIdx: number; type: 'pid' | 'arg' }>,
  ): void {
    for (const badge of expired) {
      if (badge.type === 'pid') {
        this.dispatch(clearPidReconfigured(badge.filterIdx));
      } else {
        this.dispatch(clearArgUpdated(badge.filterIdx));
      }
    }
  }

  private handleFilters(event: FiltersEvent): void {
    this.baseArgs = buildArgsByFilter(event.filters);
    if (this.silent) {
      this.pendingLastFilters = event;
      return;
    }
    const { dispatch } = this;
    dispatch(filtersUpdated(event.filters.map(toGraphFilterData)));
    const withProps = event.filters.filter((filter) => filter.properties);
    if (withProps.length) {
      dispatch(setFilterPids(buildPidsByFilter(withProps)));
    }
    dispatch(clearFilterArgs());
    const args = buildArgsByFilter(event.filters);
    if (Object.keys(args).length) dispatch(hydrateFilterArgs(args));
  }

  private handleFilterArgsUpdate(event: FilterArgsUpdateEvent): void {
    if (this.silent) {
      this.pendingFilterArgs.push(event);
      return;
    }
    this.dispatch(
      applyArgUpdate({
        filterIdx: event.payload.filter_idx.toString(),
        argName: event.payload.arg_name,
        value: event.payload.value,
      }),
    );
  }
}
