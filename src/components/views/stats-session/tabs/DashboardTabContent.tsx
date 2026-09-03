import type { EnrichedFilterOverview } from '@/types/domain/gpac/model';
import React from 'react';
import { LuActivity, LuArrowUp, LuArrowDown, LuPlay } from 'react-icons/lu';
import { FiltersGrid } from '../session-overview/FiltersGrid';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ActivityIndicator,
  ActivityLevel,
} from '@/components/ui/activity-indicator';
import type {
  StatsCounters,
  SystemStats,
} from '../hooks/stats/useStatsCalculations';
import { Widget } from '@/types/ui/widget';
import { CommandLineInfo } from '@/components/CommandLineDialog';

interface DashboardTabContentProps {
  systemStats: SystemStats;
  statsCounters: StatsCounters;
  filtersWithLiveStats: EnrichedFilterOverview[];
  filtersMatchingCriteria: EnrichedFilterOverview[];
  loading: boolean;
  monitoredFilters: Map<number, EnrichedFilterOverview>;
  onCardClick: (idx: number) => void;
  refreshInterval: string;
  activeWidgets?: Widget[];
}

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  badge?: string;
  progress?: number;
  activityLevel?: ActivityLevel;
  className?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  description,
  trend,
  badge,
  progress,
  activityLevel,
  className = '',
}) => {
  const getTrendIcon = () => {
    if (trend === 'up')
      return <LuArrowUp className="h-3.5 w-3.5 text-teal-400/80" />;
    if (trend === 'down')
      return <LuArrowDown className="h-3.5 w-3.5 text-rose-400/80" />;
    return <div className="h-3.5 w-3.5" />;
  };

  return (
    <Card
      className={`bg-monitor-panel/60 border border-white/[0.03] rounded-lg shadow-none hover:bg-monitor-panel/80  h-[80px] ${className}`}
    >
      <CardContent className="p-4 h-full flex flex-col justify-between">
        {/* Top row: title + icon */}
        <div className="flex items-center justify-between mb-1">
          <CardTitle className="text-[0.786rem] font-medium text-monitor-text-muted/80 uppercase tracking-wider">
            {title}
          </CardTitle>
          <div className="flex items-center gap-2 opacity-30">
            {activityLevel && (
              <ActivityIndicator level={activityLevel} size="sm" />
            )}
            <div className="opacity-70">{icon}</div>
          </div>
        </div>

        {/* Middle row: main value + trend */}
        <div className="flex items-baseline gap-2 my-auto">
          <div className="text-2xl font-bold text-slate-50 tabular-nums leading-none">
            {value}
          </div>
          {getTrendIcon()}
        </div>

        {/* Bottom row: description or badge */}
        {description && (
          <p className="text-[0.786rem] text-monitor-text-muted/80 leading-tight">
            {description}
          </p>
        )}

        {badge && !description && (
          <Badge className="text-xs bg-teal-500/10 text-teal-400 ring-1 ring-teal-400/20 w-fit">
            {badge}
          </Badge>
        )}

        {progress !== undefined && (
          <div className="mt-1">
            <Progress
              value={progress}
              className="h-1"
              color={
                progress > 80
                  ? 'bg-rose-500'
                  : progress > 50
                    ? 'bg-amber-400'
                    : 'bg-teal-500'
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const DashboardTabContent: React.FC<DashboardTabContentProps> = ({
  systemStats,
  statsCounters,
  filtersWithLiveStats,
  filtersMatchingCriteria,
  loading,
  monitoredFilters,
  onCardClick,
  refreshInterval,
  activeWidgets = [],
}) => {
  return (
    <div className="space-y-4">
      {/* Statistics Overview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge className="text-xs bg-white/5 ring-1 ring-monitor-line text-monitor-text-secondary">
              Refresh: {refreshInterval}
            </Badge>
            <CommandLineInfo />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
          {/* Processing Activity */}
          <div className="relative">
            <StatsCard
              title="Processing Activity"
              value={statsCounters.processing}
              icon={<LuPlay className="h-4 w-4" />}
              description={`${((statsCounters.processing / Math.max(statsCounters.total, 1)) * 100).toFixed(1)}% active`}
              trend={statsCounters.processing > 0 ? 'up' : 'neutral'}
              activityLevel={systemStats.systemActivityLevel}
            />
            <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 h-12 w-px bg-white/[0.06]" />
          </div>

          {/* Pipeline Status */}
          <div className="lg:pl-4">
            <StatsCard
              title="Pipeline Status"
              value={`${statsCounters.sources}→${statsCounters.sinks}`}
              icon={<LuActivity className="h-4 w-4" />}
              description="Sources to sinks"
              badge={statsCounters.processing > 0 ? 'Processing' : 'Idle'}
              trend={
                statsCounters.sources > 0 && statsCounters.sinks > 0
                  ? 'up'
                  : 'neutral'
              }
            />
          </div>
        </div>
      </div>

      {/* Filters Grid */}
      <div>
        <FiltersGrid
          filtersWithLiveStats={filtersWithLiveStats}
          filtersMatchingCriteria={filtersMatchingCriteria}
          loading={loading}
          monitoredFilters={monitoredFilters}
          onCardClick={onCardClick}
          activeWidgets={activeWidgets}
        />
      </div>
    </div>
  );
};
