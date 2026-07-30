import { GpacLogEntry } from '@/types/domain/gpac/log-types';
import type { MetricDefinitionMap } from '@/utils/metrics/metricDefinitionParser';
import type { FilterStatusInput } from '@/services/gpacService/liveAdapter/extractParsedStatuses';
import type {
  PIDproperties,
  SessionFilterStatistics,
} from '@/types/domain/gpac/filter-stats';
import type { MonitorIntervals } from '@/shared/store/slices/monitorConfigSlice';
import type { GraphFilterData } from '@/types/domain/gpac/model';
import type { SessionEndMessage } from '@/services/ws/types';
import type { GpacMessage } from '@/types/communication/shared';

export interface FilterStatsPayload {
  idx: number;
  ts_us?: number;
  ipids?: Record<string, PIDproperties>;
  opids?: Record<string, PIDproperties>;
  bytes_sent: number;
  bytes_done: number;
  last_task_time?: number;
}

export interface SessionStatsUpdate {
  stats: SessionFilterStatistics[];
  ts_us?: number;
}

export interface MessageHandlerCallbacks {
  onUpdateGraphData: (data: GraphFilterData[]) => void;
  onSetLoading: (loading: boolean) => void;
  onUpdateSessionStats: (stats: SessionStatsUpdate) => void;
  onLogsUpdate: (logs: GpacLogEntry[]) => void;
  onLogSubscriptionChange: (isSubscribed: boolean) => void;
  onPidReconfigured: (indexes: number[]) => void;
  onArgUpdated: (indexes: number[]) => void;
  onSetMetricDefinitions: (definitions: MetricDefinitionMap) => void;
  onFilterStatuses: (entries: FilterStatusInput[]) => void;
  onUpdateFilterStats: (payload: FilterStatsPayload) => void;
  onSetMonitorConfig: (intervals: MonitorIntervals) => void;
  onSessionEnd?: (data: SessionEndMessage) => void;
}

export interface MessageHandlerDependencies {
  isConnected: () => boolean;
  send: (message: GpacMessage) => Promise<void>;
  stopReconnection: () => void;
  markEndOfSession: () => void;
}
