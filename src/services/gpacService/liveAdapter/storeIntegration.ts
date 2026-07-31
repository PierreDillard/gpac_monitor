import { store } from '@/shared/store';
import {
  setLoading,
  markPidReconfigured,
  markArgUpdated,
} from '@/shared/store/slices/graphSlice';
import { filtersUpdated } from '@/shared/store/actions/globalActions';
import {
  updateSessionStats,
  setMetricDefinitions,
} from '@/shared/store/slices/sessionStatsSlice';
import { setMonitorConfig } from '@/shared/store/slices/monitorConfigSlice';
import {
  appendLogsForAllTools,
  setSubscriptionStatus,
} from '@/shared/store/slices/logsSlice';
import {
  setParsedStatuses,
  addStatusMetricSamples,
  addPIDSamples,
  addCombinedNetworkPoint,
} from '@/shared/store/slices/monitoredFilterSlice';
import { selectMetricDefinitions } from '@/shared/store/selectors';
import {
  buildStatusSamplesFromStats,
  buildStatusSamplesFromParsed,
} from '@/utils/metrics/statusMetricGraph';
import { buildPIDSamplesFromFilterStats } from '@/utils/metrics/pidMetricGraph';
import {
  buildPerfSamplesFromStats,
  type PerfStatEntry,
} from '@/utils/metrics/perfMetricGraph';
import {
  selectSessionStartUs,
  selectPreviousSessionStats,
  selectLastUpdateUs,
  selectSessionStats,
} from '@/shared/store/selectors/session/sessionStatsSelectors';
import { selectParsedStatus } from '@/shared/store/selectors/monitoredFilter';
import { MessageHandlerCallbacks } from '../infrastructure/messageHandler/baseMessageHandler';
import { GpacLogEntry } from '@/types/domain/gpac/log-types';
import { extractParsedStatuses } from './extractParsedStatuses';

type FilterPerfPrev = { tsUs: number; bytesSent: number; bytesDone: number };

export const createStoreCallbacks = (): MessageHandlerCallbacks => {
  const filterPrevPerf = new Map<number, FilterPerfPrev>();
  const prevRawStatusByFilter = new Map<number, string>();

  return {
    onUpdateGraphData: (data) => {
      store.dispatch(filtersUpdated(data));
    },
    onSetLoading: (loading) => store.dispatch(setLoading(loading)),
    onUpdateSessionStats: (payload) => {
      const prevTsUs = selectLastUpdateUs(store.getState());
      store.dispatch(updateSessionStats(payload));
      const state = store.getState();
      const samples = buildStatusSamplesFromStats(
        payload.stats ?? [],
        payload.ts_us,
        selectSessionStartUs(state),
        selectMetricDefinitions(state),
      );
      if (samples.length > 0) store.dispatch(addStatusMetricSamples(samples));
      const perfSamples = buildPerfSamplesFromStats(
        payload.stats ?? [],
        selectPreviousSessionStats(state),
        payload.ts_us,
        prevTsUs,
        selectSessionStartUs(state),
      );
      for (const point of perfSamples)
        store.dispatch(addCombinedNetworkPoint(point));
    },
    onUpdateFilterStats: (payload) => {
      const state = store.getState();
      const sessionStartUs = selectSessionStartUs(state);

      const parsedStatus = selectParsedStatus(state, payload.idx);
      const statusSamples = buildStatusSamplesFromParsed(
        { [payload.idx]: parsedStatus },
        payload.ts_us,
        sessionStartUs,
      );
      if (statusSamples.length > 0)
        store.dispatch(addStatusMetricSamples(statusSamples));

      const pidSamples = buildPIDSamplesFromFilterStats(
        payload,
        payload.ts_us,
        sessionStartUs,
      );
      if (pidSamples.length > 0) store.dispatch(addPIDSamples(pidSamples));

      if (payload.ts_us != null) {
        if (!filterPrevPerf.has(payload.idx)) {
          const lastStat = selectSessionStats(state)[String(payload.idx)];
          const lastTsUs = selectLastUpdateUs(state);
          if (lastStat && lastTsUs != null) {
            filterPrevPerf.set(payload.idx, {
              tsUs: lastTsUs,
              bytesSent: lastStat.bytes_sent,
              bytesDone: lastStat.bytes_done,
            });
          }
        }
        const prev = filterPrevPerf.get(payload.idx);
        if (prev) {
          const curr: PerfStatEntry = {
            idx: payload.idx,
            bytes_sent: payload.bytes_sent,
            bytes_done: payload.bytes_done,
            last_task_time: payload.last_task_time,
          };
          const prevEntry: PerfStatEntry = {
            idx: payload.idx,
            bytes_sent: prev.bytesSent,
            bytes_done: prev.bytesDone,
          };
          const perfSamples = buildPerfSamplesFromStats(
            [curr],
            { [String(payload.idx)]: prevEntry },
            payload.ts_us,
            prev.tsUs,
            sessionStartUs,
          );
          for (const point of perfSamples)
            store.dispatch(addCombinedNetworkPoint(point));
        }
        filterPrevPerf.set(payload.idx, {
          tsUs: payload.ts_us,
          bytesSent: payload.bytes_sent,
          bytesDone: payload.bytes_done,
        });
      }
    },
    onLogsUpdate: (logs: GpacLogEntry[]) => {
      store.dispatch(appendLogsForAllTools(logs));
    },
    onLogSubscriptionChange: (isSubscribed: boolean) =>
      store.dispatch(setSubscriptionStatus(isSubscribed)),
    onPidReconfigured: (indexes: number[]) =>
      store.dispatch(markPidReconfigured(indexes)),
    onArgUpdated: (indexes: number[]) =>
      store.dispatch(markArgUpdated(indexes)),
    onSetMetricDefinitions: (definitions) =>
      store.dispatch(setMetricDefinitions(definitions)),
    onSetMonitorConfig: (intervals) =>
      store.dispatch(setMonitorConfig(intervals)),
    onFilterStatuses: (entries) => {
      const changedEntries = entries.filter((entry) => {
        const raw = entry.status ?? '';
        const isUnchanged = prevRawStatusByFilter.get(entry.idx) === raw;
        prevRawStatusByFilter.set(entry.idx, raw);
        return !isUnchanged;
      });
      if (changedEntries.length === 0) return;
      store.dispatch(
        setParsedStatuses(
          extractParsedStatuses(
            changedEntries,
            selectMetricDefinitions(store.getState()),
          ),
        ),
      );
    },
  };
};
