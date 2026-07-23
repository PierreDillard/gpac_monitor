import React, { useCallback, useRef, useState, useMemo } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { RiScrollToBottomLine, RiFilterOffLine } from 'react-icons/ri';
import { MdOutlineTimer } from 'react-icons/md';
import WidgetWrapper from '../../widget/WidgetWrapper';
import { useLogs } from './hooks/useLogs';
import { useLogsRedux } from './hooks/useLogsRedux';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/redux';
import {
  selectAllLogCountsByTool,
  selectCriticalLogCountsByTool,
  selectUIFilter,
  selectViewMode,
} from '@/shared/store/selectors/logs/logsSelectors';
import { selectCriticalLogsCount } from '@/shared/store/selectors/logs/logsFilterSelectors';
import {
  clearUIFilter,
  toggleTimestampMode,
} from '@/shared/store/slices/logsSlice';
import { selectTimestampMode } from '@/shared/store/selectors/logs/logsSelectors';
import { useLogsService } from './hooks/useLogsService';
import { useDataMode } from '@/shared/hooks/data/useDataMode';
import { CustomTooltip } from '@/components/ui/tooltip';
import { ToolSettingsDropdown } from './components/Tool/ToolSettingsDropdown';
import { ToolSwitcher } from './components/Tool/ToolSwitcher';
import { LogEntryItem } from './components/LogEntryItem';
import { generateLogId } from './utils/logIdentifier';
import { setHighlightedLog } from '@/shared/store/slices/logsSlice';
import { Button } from '@/components/ui/button';
import { StableNumber } from '@/utils/performance/StableNumber';
import { renderGlobalFilterBadge } from './utils/badgeUtils';

interface LogsMonitorProps {
  id: string;
}

const LogsFooter = React.memo(({ count }: { count: number }) => (
  <div className="text-center text-xs text-gray-500 py-1">
    <StableNumber value={count} /> logs
  </div>
));

const LogsMonitor: React.FC<LogsMonitorProps> = React.memo(({ id }) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const dispatch = useAppDispatch();
  const { isLive } = useDataMode();

  const {
    currentTool,
    levelsByTool,
    defaultAllLevel,
    visibleToolsFilter,
    visibleLogs,
    setTool,
    setToolLevel,
    setDefaultAllLevel: setDefaultLevel,
    toggleToolFilter,
    clearFilter,
    selectAllTools,
  } = useLogsRedux();

  // Get highlighted log ID from Redux
  const highlightedLogId = useAppSelector(
    (state) => state.logs.highlightedLogId,
  );
  const [atBottom, setAtBottom] = useState(true);
  const [_atTop, setAtTop] = useState(false);

  // Get all log counts by tool (to determine which tools have logs)
  const allLogCountsByTool = useAppSelector(selectAllLogCountsByTool);

  // Get critical log counts by tool (for badge display)
  const criticalLogCountsByTool = useAppSelector(selectCriticalLogCountsByTool);

  // Get critical logs count (warnings + errors only)
  const criticalLogsCount = useAppSelector(selectCriticalLogsCount);

  // Get UI filter (if active)
  const uiFilter = useAppSelector(selectUIFilter);
  const viewMode = useAppSelector(selectViewMode);
  const timestampMode = useAppSelector(selectTimestampMode);
  const isUIFilterActive =
    uiFilter &&
    ((uiFilter.levels && uiFilter.levels.length > 0) ||
      (uiFilter.filterKeys && uiFilter.filterKeys.length > 0));

  // Initialize logs subscription — disabled in history mode
  useLogs({
    enabled: isLive,
  });

  // Auto-sync per-tool configuration with backend
  useLogsService();

  // Handler for toggling highlight on a log
  const handleToggleHighlight = useCallback(
    (logId: string | null) => {
      dispatch(setHighlightedLog(logId));
    },
    [dispatch],
  );

  // Handler to scroll to highlighted log
  const scrollToHighlightedLog = useCallback(() => {
    if (highlightedLogId && virtuosoRef.current && visibleLogs.length > 0) {
      const index = visibleLogs.findIndex(
        (log) => generateLogId(log) === highlightedLogId,
      );
      if (index !== -1) {
        virtuosoRef.current.scrollToIndex({
          index,
          behavior: 'smooth',
          align: 'center',
        });
      }
    }
  }, [highlightedLogId, visibleLogs]);

  // Memoized scroll handler to prevent re-renders
  const handleScrollToggle = useCallback(() => {
    if (atBottom) {
      virtuosoRef.current?.scrollToIndex({ index: 0, behavior: 'smooth' });
    } else {
      virtuosoRef.current?.scrollToIndex({
        index: visibleLogs.length - 1,
        behavior: 'smooth',
      });
    }
  }, [atBottom, visibleLogs.length]);

  const renderLogItem = useCallback(
    (_: number, log: (typeof visibleLogs)[0]) => {
      const logId = generateLogId(log);
      return (
        <LogEntryItem
          log={log}
          logId={logId}
          isHighlighted={logId === highlightedLogId}
          onToggleHighlight={handleToggleHighlight}
          timestampMode={timestampMode}
        />
      );
    },
    [highlightedLogId, handleToggleHighlight, timestampMode],
  );

  // Memoized Virtuoso components to prevent layout shifts
  const virtuosoComponents = useMemo(
    () => ({
      Footer: () => <LogsFooter count={visibleLogs.length} />,
    }),
    [visibleLogs.length],
  );

  const statusBadge = useMemo(() => {
    // Global Filter mode: show "all@level" badge
    if (viewMode === 'globalFilter' && isUIFilterActive) {
      return renderGlobalFilterBadge(uiFilter);
    }

    // Per-tool mode: show normal ToolSwitcher
    return (
      <ToolSwitcher
        currentTool={currentTool}
        levelsByTool={levelsByTool}
        defaultAllLevel={defaultAllLevel}
        visibleLogsCount={criticalLogsCount}
        allLogCountsByTool={allLogCountsByTool}
        criticalLogCountsByTool={criticalLogCountsByTool}
        visibleToolsFilter={visibleToolsFilter}
        onToolSelect={setTool}
        onToggleToolFilter={toggleToolFilter}
        onClearFilter={clearFilter}
        onSelectAllTools={selectAllTools}
      />
    );
  }, [
    viewMode,
    uiFilter,
    isUIFilterActive,
    currentTool,
    levelsByTool,
    defaultAllLevel,
    criticalLogsCount,
    allLogCountsByTool,
    criticalLogCountsByTool,
    visibleToolsFilter,
    setTool,
    toggleToolFilter,
    clearFilter,
    selectAllTools,
  ]);

  const customActions = useMemo(
    () => (
      <div className="flex items-center gap-2">
        {isUIFilterActive && (
          <CustomTooltip content="Clear UI filter" side="bottom">
            <button
              onClick={() => dispatch(clearUIFilter())}
              className="px-2 py-1 text-xs rounded bg-red-900/50 border border-red-800/50 text-red-200 hover:bg-red-900/50"
            >
              <RiFilterOffLine className="w-4 h-4" />
            </button>
          </CustomTooltip>
        )}
        <CustomTooltip
          content={
            timestampMode === 'relative'
              ? 'Switch to absolute time'
              : 'Switch to relative time'
          }
          side="bottom"
        >
          <button
            onClick={() => dispatch(toggleTimestampMode())}
            className="px-2 py-1 text-xs rounded bg-gray-700/50 border border-gray-600/50 text-gray-200 hover:bg-gray-700/80"
          >
            <MdOutlineTimer className="w-4 h-4" />
          </button>
        </CustomTooltip>
        {isLive && (
          <CustomTooltip
            content="Configure log levels for each tool"
            side="bottom"
          >
            <ToolSettingsDropdown
              levelsByTool={levelsByTool}
              defaultAllLevel={defaultAllLevel}
              currentTool={currentTool}
              onToolLevelChange={setToolLevel}
              onDefaultAllLevelChange={setDefaultLevel}
              onToolNavigate={setTool}
            />
          </CustomTooltip>
        )}
      </div>
    ),
    [
      isUIFilterActive,
      isLive,
      timestampMode,
      levelsByTool,
      defaultAllLevel,
      currentTool,
      setToolLevel,
      setDefaultLevel,
      setTool,
      dispatch,
    ],
  );

  return (
    <WidgetWrapper
      id={id}
      statusBadge={statusBadge}
      customActions={customActions}
    >
      <div className="flex flex-col h-full bg-stat stat">
        {/* Logs */}
        <div className="flex-1 relative">
          <div className="absolute bottom-4 right-4 z-20 flex flex-col items-center gap-3 pointer-events-auto">
            {/* Scroll to highlighted log button */}
            <button
              onClick={scrollToHighlightedLog}
              className={`px-2 py-1 text-xs rounded border bg-gray-800 border-yellow-600 text-white hover:opacity-80 ${
                highlightedLogId ? 'visible' : 'invisible'
              }`}
              title="Scroll to highlighted log"
            >
              📌
            </button>

            {/* Auto-scroll toggle */}
            <Button
              onClick={handleScrollToggle}
              className="p-2 rounded-sm shadow-md border-2 hover:scale-105"
              title={atBottom ? 'Scroll to top' : 'Scroll to bottom'}
            >
              <RiScrollToBottomLine
                className={`w-5 h-5 transition-transform duration-200 ${
                  atBottom ? 'rotate-180' : ''
                }`}
              />
            </Button>
          </div>
          <Virtuoso
            ref={virtuosoRef}
            data={visibleLogs}
            followOutput={atBottom ? 'auto' : false}
            computeItemKey={(_, log) => generateLogId(log)}
            style={{
              height: '100%',
              fontFamily: "'Roboto Mono', 'Courier New', monospace",
              willChange: 'transform',
              contain: 'strict',
              overflowX: 'hidden',
            }}
            className="rounded px-2 py-1 text-sm bg-stat stat"
            itemContent={renderLogItem}
            atBottomStateChange={setAtBottom}
            atTopStateChange={setAtTop}
            overscan={20}
            increaseViewportBy={200}
            components={virtuosoComponents}
          />
        </div>
      </div>
    </WidgetWrapper>
  );
});

export default LogsMonitor;
