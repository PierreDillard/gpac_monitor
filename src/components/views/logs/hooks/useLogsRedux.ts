import { useEffect, useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/redux';
import {
  selectCurrentTool,
  selectLevelsByTool,
  selectDefaultAllLevel,
  selectVisibleToolsFilter,
} from '@/shared/store/selectors/logs/logsSelectors';
import { selectVisibleLogs } from '@/shared/store/selectors/logs/logsFilterSelectors';
import { selectCurrentConfig } from '@/shared/store/selectors/logs/logsPersistenceSelectors';
import { useDataMode } from '@/shared/hooks/data/useDataMode';
import { useDisplayQueue } from './useDisplayQueue';
import {
  setTool,
  setToolLevel,
  setDefaultAllLevel,
  toggleToolInVisibleFilter,
  clearVisibleToolsFilter,
  selectAllToolsInFilter,
} from '@/shared/store/slices/logsSlice';
import { GpacLogLevel, GpacLogTool } from '@/types/domain/gpac/log-types';
import { toast } from '@/shared/hooks/ui/useToast';

const STORAGE_KEY = 'gpac-logs-config';

export function useLogsRedux() {
  const dispatch = useAppDispatch();
  const { isLive } = useDataMode();

  // Redux selectors
  const currentTool = useAppSelector(selectCurrentTool);
  const levelsByTool = useAppSelector(selectLevelsByTool);
  const defaultAllLevel = useAppSelector(selectDefaultAllLevel);
  const visibleToolsFilter = useAppSelector(selectVisibleToolsFilter);
  const rawVisibleLogs = useAppSelector(selectVisibleLogs);
  const currentConfig = useAppSelector(selectCurrentConfig);

  // Throttle visible logs updates using requestAnimationFrame for performance
  const visibleLogs = useDisplayQueue(rawVisibleLogs);

  // Actions with persistence
  const handleSetTool = useCallback(
    (tool: GpacLogTool) => {
      dispatch(setTool(tool));
    },
    [dispatch],
  );

  const handleSetToolLevel = useCallback(
    (tool: GpacLogTool, level: GpacLogLevel) => {
      dispatch(setToolLevel({ tool, level }));
      dispatch(setTool(tool)); // Switch to the tool after changing its level

      // Show toast notification
      toast({
        title: 'Log Level Updated',
        description: `${tool.toUpperCase()} set to ${level.toUpperCase()}`,
      });
    },
    [dispatch],
  );

  const handleSetDefaultAllLevel = useCallback(
    (level: GpacLogLevel) => {
      dispatch(setDefaultAllLevel(level));

      // Show toast notification
      toast({
        title: 'Default Level Updated',
        description: `Default level for all tools set to ${level.toUpperCase()}`,
      });
    },
    [dispatch],
  );

  const handleToggleToolFilter = useCallback(
    (tool: GpacLogTool) => {
      dispatch(toggleToolInVisibleFilter(tool));
    },
    [dispatch],
  );

  const handleClearFilter = useCallback(() => {
    dispatch(clearVisibleToolsFilter());
  }, [dispatch]);

  const handleSelectAllTools = useCallback(
    (tools: GpacLogTool[]) => {
      dispatch(selectAllToolsInFilter(tools));
    },
    [dispatch],
  );

  // Auto-save config when it changes — never from history mode, where the
  // config reflects the recorded session, not the user's live preferences
  useEffect(() => {
    if (!isLive) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig));
  }, [currentConfig, isLive]);

  return useMemo(
    () => ({
      // State
      currentTool,
      levelsByTool,
      defaultAllLevel,
      visibleToolsFilter,
      visibleLogs,

      // Actions (already memoized via useCallback)
      setTool: handleSetTool,
      setToolLevel: handleSetToolLevel,
      setDefaultAllLevel: handleSetDefaultAllLevel,
      toggleToolFilter: handleToggleToolFilter,
      clearFilter: handleClearFilter,
      selectAllTools: handleSelectAllTools,
    }),
    [
      currentTool,
      levelsByTool,
      defaultAllLevel,
      visibleToolsFilter,
      visibleLogs,
      handleSetTool,
      handleSetToolLevel,
      handleSetDefaultAllLevel,
      handleToggleToolFilter,
      handleClearFilter,
      handleSelectAllTools,
    ],
  );
}
