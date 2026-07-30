import {
  GpacLogLevel,
  GpacLogTool,
  GpacLogEntry,
} from '@/types/domain/gpac/log-types';
import { LogsState } from './logs.types';

const STORAGE_KEY = 'gpac-logs-config';

const createEmptyBuffers = (): Record<GpacLogTool, GpacLogEntry[]> => {
  const buffers = {} as Record<GpacLogTool, GpacLogEntry[]>;
  Object.values(GpacLogTool).forEach((tool) => {
    buffers[tool] = [];
  });
  return buffers;
};

/** Initialize state from localStorage */
export const getInitialLogsState = (): LogsState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const config = saved ? JSON.parse(saved) : {};

    return {
      currentTool: config.currentTool || GpacLogTool.FILTER,
      levelsByTool: config.levelsByTool || {},
      defaultAllLevel: config.defaultAllLevel || GpacLogLevel.QUIET,
      visibleToolsFilter: config.visibleToolsFilter || [],
      buffers: createEmptyBuffers(),
      maxEntriesPerTool: 500,
      isSubscribed: false,
      highlightedLogId: null,
      uiFilter: null,
      viewMode: 'perTool' as const,
      timestampMode: 'relative' as const,
      lastSentConfig: {
        levelsByTool: {},
        defaultAllLevel: null, // Indicates no config has been sent yet
      },
      alertsByFilterKey: {},
    };
  } catch {
    return {
      currentTool: GpacLogTool.FILTER,
      levelsByTool: {},
      defaultAllLevel: GpacLogLevel.QUIET,
      visibleToolsFilter: [],
      buffers: createEmptyBuffers(),
      maxEntriesPerTool: 500,
      isSubscribed: false,
      highlightedLogId: null,
      uiFilter: null,
      viewMode: 'perTool' as const,
      timestampMode: 'relative' as const,
      lastSentConfig: {
        levelsByTool: {},
        defaultAllLevel: null,
      },
      alertsByFilterKey: {},
    };
  }
};
