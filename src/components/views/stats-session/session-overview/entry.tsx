import React, {
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { useOptimizedResize } from '@/shared/hooks/ui/useOptimizedResize';
import { useMultiFilterMonitor } from '../hooks/useMultiFilterMonitor';
import { useStatsCalculations } from '../hooks/stats/useStatsCalculations';
import { useEnrichedFilters } from '../hooks/stats/useEnrichedFilters';
import { useMonitoredFilters, useFilterHandlers } from '../hooks/filters';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/redux';
import {
  clearPendingFilterOpen,
  clearSelectedNode,
  setSelectedNode,
} from '@/shared/store/slices/graphSlice';
import WidgetWrapper from '@/components/widget/WidgetWrapper';
import ConnectionErrorState from '@/components/common/ConnectionErrorState';
import { WidgetProps } from '@/types/ui/widget';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { StatsTabs } from '../tabs/SessionStatsTabs';
import { DashboardTabContent } from '../tabs/DashboardTabContent';
import {
  MonitoredFilterTabs,
  MonitoredFilterContent,
} from '../tabs/MonitoredFilterTabs';
import { getFilterIdxFromTab } from '../utils/filterMonitoringUtils';
import { Widget } from '@/types/ui/widget';

const EMPTY_ACTIVE_WIDGETS: Widget[] = [];

const MultiFilterMonitor: React.FC<WidgetProps> = React.memo(
  ({ id, isDetached, detachedFilterIdx }) => {
    // State & Refs
    const dispatch = useAppDispatch();
    const [activeTab, setActiveTab] = useState('main');
    const [isResizing, setIsResizing] = useState(false);
    const tabsRef = useRef<HTMLDivElement>(null);

    // Resize Handling
    const { ref } = useOptimizedResize({
      onResizeStart: () => setIsResizing(true),
      onResizeEnd: () => setIsResizing(false),
      debounce: 20,
      throttle: true,
    }) as { ref: React.RefObject<HTMLElement> };
    const containerRef = ref as React.RefObject<HTMLDivElement>;

    // Data Hooks (Stats & Filters)
    const isDashboardActive = useMemo(() => activeTab === 'main', [activeTab]);
    const { isLoading, sessionStats, staticFilters } =
      useMultiFilterMonitor(isDashboardActive);

    const filtersWithSessionStats = useEnrichedFilters(
      staticFilters,
      sessionStats,
      isResizing,
    );

    const { statsCounters, systemStats } = useStatsCalculations(
      filtersWithSessionStats,
      sessionStats,
    );
    const { monitoredFilterMap, inlineFilterMap } = useMonitoredFilters(
      filtersWithSessionStats,
    );

    const handleTabChange = useCallback(
      (value: string) => {
        setActiveTab(value);
        const filterIdx = getFilterIdxFromTab(value);
        if (filterIdx !== null) {
          dispatch(setSelectedNode(String(filterIdx)));
        } else {
          dispatch(clearSelectedNode());
        }
      },
      [dispatch],
    );

    // User Actions
    const {
      handleCardClick,
      handleDetachTab,
      handleCloseTab,
      handleOpenProperties,
    } = useFilterHandlers(handleTabChange);

    // Listen for pending filter open requests from NodeToolbar
    const pendingFilterOpen = useAppSelector(
      (state) => state.graph.pendingFilterOpen,
    );

    useEffect(() => {
      if (pendingFilterOpen) {
        handleCardClick(pendingFilterOpen.filterIdx);
        dispatch(clearPendingFilterOpen());
      }
    }, [pendingFilterOpen, handleCardClick, dispatch]);

    // Return to dashboard when monitored filter no longer exists in graph
    useEffect(() => {
      const currentIdx = getFilterIdxFromTab(activeTab);
      if (currentIdx !== null && !inlineFilterMap.has(currentIdx)) {
        handleTabChange('main');
      }
    }, [activeTab, inlineFilterMap, handleTabChange]);

    // Auto-scroll to bottom when widget is detached
    useEffect(() => {
      if (isDetached) {
        requestAnimationFrame(() => {
          const scroller = document.querySelector('main');
          scroller?.scrollTo({
            top: scroller.scrollHeight,
            behavior: 'smooth',
          });
        });
      }
    }, [isDetached]);

    // Disable callbacks during resize to avoid expensive re-renders
    const noopTabChange = useCallback(() => {}, []);
    const noopCardClick = useCallback(() => {}, []);
    const safeOnTabChange = isResizing ? noopTabChange : handleTabChange;
    const safeOnCardClick = isResizing ? noopCardClick : handleCardClick;

    // Detached Mode (Overlay Widget)

    if (isDetached && detachedFilterIdx !== undefined) {
      const filter = filtersWithSessionStats.find(
        (f) => f.idx === detachedFilterIdx,
      );

      if (!filter) {
        return (
          <WidgetWrapper id={id}>
            <div className="flex items-center justify-center h-full">
              <p className="text-monitor-text-muted">
                Filter {detachedFilterIdx} not found
              </p>
            </div>
          </WidgetWrapper>
        );
      }

      return (
        <WidgetWrapper id={id}>
          <div className="h-full">
            <MonitoredFilterContent
              idx={filter.idx}
              filter={filter}
              isActive={true}
              isDetached={true}
              onCardClick={handleCardClick}
              onOpenProperties={handleOpenProperties}
            />
          </div>
        </WidgetWrapper>
      );
    }

    // Loading State
    if (isLoading && staticFilters.length === 0) {
      return <ConnectionErrorState id={id} isLoading={true} />;
    }
    // Empty State
    if (!isLoading && staticFilters.length === 0) {
      return (
        <WidgetWrapper id={id}>
          <div className="flex flex-col items-center justify-center h-full p-4 text-monitor-text-secondary">
            <p className="text-monitor-text-primary">No filters available</p>
            <p className="text-sm mt-2 text-monitor-text-muted">
              Waiting for graph construction...
            </p>
          </div>
        </WidgetWrapper>
      );
    }
    // Main UI (
    return (
      <WidgetWrapper id={id}>
        <div
          ref={containerRef}
          className={`h-full ${isResizing ? 'contain-layout contain-style' : ''}`}
        >
          <Tabs
            value={activeTab}
            onValueChange={safeOnTabChange}
            className="flex-1 flex flex-col"
          >
            <StatsTabs
              activeTab={activeTab}
              onValueChange={safeOnTabChange}
              allFilters={filtersWithSessionStats}
              onCloseTab={handleCloseTab}
              onDetachTab={handleDetachTab}
              tabsRef={tabsRef}
            />

            <TabsContent
              value="main"
              className={`flex-1 p-4 ${isResizing ? 'pointer-events-none' : ''}`}
            >
              <DashboardTabContent
                systemStats={systemStats}
                statsCounters={statsCounters}
                filtersWithLiveStats={filtersWithSessionStats}
                filtersMatchingCriteria={filtersWithSessionStats}
                loading={isLoading || isResizing}
                monitoredFilters={monitoredFilterMap}
                onCardClick={safeOnCardClick}
                refreshInterval="1s"
                activeWidgets={EMPTY_ACTIVE_WIDGETS}
              />
            </TabsContent>

            <MonitoredFilterTabs
              monitoredFilters={inlineFilterMap}
              activeTab={activeTab}
              onCardClick={safeOnCardClick}
              onOpenProperties={handleOpenProperties}
            />
          </Tabs>
        </div>
      </WidgetWrapper>
    );
  },
);

MultiFilterMonitor.displayName = 'MultiFilterMonitor';

export default MultiFilterMonitor;
