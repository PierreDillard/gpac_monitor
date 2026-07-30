import { LuMonitorCheck, LuChevronRight } from 'react-icons/lu';
import type { EnrichedFilterOverview } from '@/types/domain/gpac/model';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import React, { useCallback, useEffect, useState } from 'react';
import { useAppSelector } from '@/shared/hooks/redux';
import { useDataMode } from '@/shared/hooks/data/useDataMode';
import { getFilterIdxFromTab } from '../utils/filterMonitoringUtils';
import {
  FilterTabTrigger,
  tabAccentClass,
} from './components/FilterTabTrigger';

interface StatsTabsProps {
  activeTab: string;
  onValueChange: (value: string) => void;
  allFilters: EnrichedFilterOverview[];
  onCloseTab: (idx: number, e: React.SyntheticEvent) => void;
  onDetachTab?: (
    idx: number,
    filterName: string,
    e: React.SyntheticEvent,
  ) => void;
  tabsRef: React.RefObject<HTMLDivElement>;
}

export const StatsTabs: React.FC<StatsTabsProps> = ({
  activeTab,
  onValueChange,
  allFilters,
  onCloseTab,
  onDetachTab,
  tabsRef,
}) => {
  const { isHistory } = useDataMode();
  const viewByFilter = useAppSelector((state) => state.widgets.viewByFilter);

  const inlineFilters = Object.entries(viewByFilter)
    .filter(([_, view]) => view?.mode === 'inline')
    .map(([idx]) => Number(idx));

  // Active tab first
  const activeFilterIdx = getFilterIdxFromTab(activeTab);
  const orderedFilters =
    activeFilterIdx !== null && inlineFilters.includes(activeFilterIdx)
      ? [
          activeFilterIdx,
          ...inlineFilters.filter((idx) => idx !== activeFilterIdx),
        ]
      : inlineFilters;

  const [hasHiddenTabs, setHasHiddenTabs] = useState(false);

  useEffect(() => {
    const tabStrip = tabsRef.current;
    if (!tabStrip) return;
    tabStrip.scrollTo({ left: 0 });
    setHasHiddenTabs(tabStrip.scrollWidth > tabStrip.clientWidth + 1);
  }, [activeTab, orderedFilters.length, tabsRef]);

  // DOM only, no re-render
  const handleShowNextTab = useCallback(() => {
    const tabStrip = tabsRef.current;
    if (!tabStrip) return;

    const reachedEnd =
      tabStrip.scrollLeft + tabStrip.clientWidth >= tabStrip.scrollWidth - 1;
    if (reachedEnd) {
      tabStrip.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }

    const stripRight = tabStrip.getBoundingClientRect().right;
    const firstHiddenTab = Array.from(
      tabStrip.querySelectorAll<HTMLElement>('[data-value]'),
    ).find((trigger) => trigger.getBoundingClientRect().right > stripRight + 1);

    firstHiddenTab?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'end',
    });
  }, [tabsRef]);

  return (
    <div className="sticky top-0 z-50 flex w-full items-center bg-monitor-surface">
      <TabsList
        className="min-w-0 flex-1 justify-start overflow-hidden border-none bg-transparent"
        ref={tabsRef}
      >
        <TabsTrigger
          value="main"
          className={`flex shrink-0 items-center gap-1 ${tabAccentClass(isHistory)}`}
          data-value="main"
          onClick={() => onValueChange('main')}
        >
          <LuMonitorCheck className="h-4 w-4" />
          <span>Dashboard</span>
        </TabsTrigger>

        {orderedFilters.map((filterIdx) => {
          const filter = allFilters.find((f) => f.idx === filterIdx);
          if (!filter) return null;

          return (
            <FilterTabTrigger
              key={`tab-${filterIdx}`}
              filterIdx={filterIdx}
              filterName={filter.name}
              isHistory={isHistory}
              onValueChange={onValueChange}
              onCloseTab={onCloseTab}
              onDetachTab={onDetachTab}
            />
          );
        })}
      </TabsList>

      {hasHiddenTabs && (
        <button
          type="button"
          onClick={handleShowNextTab}
          title="Show next tab"
          aria-label="Show next tab"
          className="shrink-0 px-2 py-2 text-gray-500 hover:text-gray-300"
        >
          <LuChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
