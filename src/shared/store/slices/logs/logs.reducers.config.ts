import { PayloadAction } from '@reduxjs/toolkit';
import { GpacLogLevel, GpacLogTool } from '@/types/domain/gpac/log-types';
import { LogsState } from './logs.types';

export const configReducers = {
  /** Set the currently active GPAC tool for log filtering */
  setTool: (state: LogsState, action: PayloadAction<GpacLogTool>) => {
    state.currentTool = action.payload;
  },

  /** Set level for a specific tool */
  setToolLevel: (
    state: LogsState,
    action: PayloadAction<{ tool: GpacLogTool; level: GpacLogLevel }>,
  ) => {
    const { tool, level } = action.payload;
    state.levelsByTool[tool] = level;
  },

  /** Set the default level for 'all' tool (fallback) */
  setDefaultAllLevel: (
    state: LogsState,
    action: PayloadAction<GpacLogLevel>,
  ) => {
    const newDefaultLevel = action.payload;
    state.defaultAllLevel = newDefaultLevel;

    // Reset all tool-specific levels - all tools inherit from 'all' level
    state.levelsByTool = {} as Record<GpacLogTool, GpacLogLevel>;
  },

  /** Toggle tool visibility in "all" mode */
  toggleToolInVisibleFilter: (
    state: LogsState,
    action: PayloadAction<GpacLogTool>,
  ) => {
    const tool = action.payload;
    const index = state.visibleToolsFilter.indexOf(tool);

    if (index === -1) {
      state.visibleToolsFilter.push(tool);
    } else {
      state.visibleToolsFilter.splice(index, 1);
    }
  },

  /** Clear all tools from visible filter (show all) */
  clearVisibleToolsFilter: (state: LogsState) => {
    state.visibleToolsFilter = [];
  },

  /** Select all configured tools in visible filter */
  selectAllToolsInFilter: (
    state: LogsState,
    action: PayloadAction<GpacLogTool[]>,
  ) => {
    state.visibleToolsFilter = [...action.payload];
  },

  /** Restore logs configuration from localStorage persistence.
   *  `replace: true` = payload is a complete state (snapshot): levelsByTool
   *  replaces the current map instead of merging into it. */
  restoreConfig: (
    state: LogsState,
    action: PayloadAction<{
      currentTool?: GpacLogTool;
      levelsByTool?: Partial<Record<GpacLogTool, GpacLogLevel>>;
      defaultAllLevel?: GpacLogLevel;
      visibleToolsFilter?: GpacLogTool[];
      replace?: boolean;
    }>,
  ) => {
    const {
      currentTool,
      levelsByTool,
      defaultAllLevel,
      visibleToolsFilter,
      replace,
    } = action.payload;
    if (currentTool) {
      state.currentTool = currentTool;
    }
    if (levelsByTool) {
      state.levelsByTool = replace
        ? (levelsByTool as Record<GpacLogTool, GpacLogLevel>)
        : { ...state.levelsByTool, ...levelsByTool };
    }
    if (defaultAllLevel) {
      state.defaultAllLevel = defaultAllLevel;
    }
    if (visibleToolsFilter) {
      state.visibleToolsFilter = visibleToolsFilter;
    }
  },

  /** Mark current config as sent to backend */
  markConfigAsSent: (state: LogsState) => {
    state.lastSentConfig = {
      levelsByTool: { ...state.levelsByTool },
      defaultAllLevel: state.defaultAllLevel,
    };
  },
};
