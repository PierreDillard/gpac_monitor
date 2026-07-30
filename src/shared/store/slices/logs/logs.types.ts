import {
  GpacLogLevel,
  GpacLogTool,
  GpacLogEntry,
} from '@/types/domain/gpac/log-types';
import type { LogId } from '@/types/domain/gpac/log-types';

/** View mode for LogMonitor UI */
export type LogViewMode = 'perTool' | 'globalFilter';

/** Timestamp mode for log sorting */
export type TimestampMode = 'relative' | 'absolute';

/** UI-only filter supporting levels and filter keys */
export type LogsUIFilter = {
  levels?: GpacLogLevel[];
  filterKeys?: string[]; // caller (e.g., "12") or thread_id (e.g., "t:42")
};

/** Alert counters for a filter */
export interface FilterAlerts {
  warnings: number;
  errors: number;
  info: number;
}

/** Redux state for logs management with per-tool levels and buffers */
export interface LogsState {
  currentTool: GpacLogTool;
  levelsByTool: Partial<Record<GpacLogTool, GpacLogLevel>>;
  defaultAllLevel: GpacLogLevel;
  visibleToolsFilter: GpacLogTool[]; // Tools to display when in "all" mode (empty = show all)
  buffers: Record<GpacLogTool, GpacLogEntry[]>;
  maxEntriesPerTool: number;
  isSubscribed: boolean;
  highlightedLogId: LogId | null; // ID of the currently highlighted log (session only)
  uiFilter: LogsUIFilter | null; // UI-only filter (levels and/or filter keys)
  viewMode: LogViewMode; // Current view mode (perTool or globalFilter)
  timestampMode: TimestampMode; // Timestamp mode for log sorting (session only)
  lastSentConfig: {
    levelsByTool: Partial<Record<GpacLogTool, GpacLogLevel>>;
    defaultAllLevel: GpacLogLevel | null; // null means no config sent yet
  };
  alertsByFilterKey: Record<string, FilterAlerts>; // Warning/error counters per filter
}
