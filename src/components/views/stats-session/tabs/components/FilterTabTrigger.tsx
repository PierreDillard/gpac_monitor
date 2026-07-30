import React from 'react';
import { LuSquareArrowUpRight } from 'react-icons/lu';
import { TabsTrigger } from '@/components/ui/tabs';

export const tabAccentClass = (isHistory: boolean): string =>
  `data-[state=active]:border-b-2 ${
    isHistory
      ? 'data-[state=active]:border-history'
      : 'data-[state=active]:text-monitor-active-filter data-[state=active]:border-monitor-active-filter'
  }`;

interface FilterTabTriggerProps {
  filterIdx: number;
  filterName: string;
  isHistory: boolean;
  onValueChange: (value: string) => void;
  onCloseTab: (idx: number, e: React.SyntheticEvent) => void;
  onDetachTab?: (
    idx: number,
    filterName: string,
    e: React.SyntheticEvent,
  ) => void;
}

export const FilterTabTrigger: React.FC<FilterTabTriggerProps> = ({
  filterIdx,
  filterName,
  isHistory,
  onValueChange,
  onCloseTab,
  onDetachTab,
}) => (
  <TabsTrigger
    value={`filter-${filterIdx}`}
    className={`flex shrink-0 items-center gap-1 ${tabAccentClass(isHistory)}`}
    data-value={`filter-${filterIdx}`}
    onClick={() => onValueChange(`filter-${filterIdx}`)}
  >
    <span>{filterName}</span>
    {onDetachTab && (
      <span
        className="ml-1 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full hover:bg-slate-600"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onDetachTab(filterIdx, filterName, e);
        }}
        onClick={(e) => e.stopPropagation()}
        title="Detach as overlay"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            onDetachTab(filterIdx, filterName, e);
          }
        }}
      >
        <LuSquareArrowUpRight />
      </span>
    )}
    <span
      className="ml-1 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full hover:bg-slate-600"
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onCloseTab(filterIdx, e);
      }}
      onClick={(e) => e.stopPropagation()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
          onCloseTab(filterIdx, e);
        }
      }}
    >
      ×
    </span>
  </TabsTrigger>
);
