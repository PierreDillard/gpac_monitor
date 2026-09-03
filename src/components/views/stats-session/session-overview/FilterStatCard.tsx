import React, { useCallback, useMemo, memo } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import { Badge } from '@/components/ui/badge';
import { MonitoredBadge } from '@/components/ui/MonitoredBadge';
import { EnrichedFilterOverview } from '@/types/domain/gpac/model';
import { useAppSelector } from '@/shared/hooks/redux';
import { selectAllFilterAlerts } from '@/shared/store/selectors/header/headerSelectors';
import FilterChangeBadges from '@/components/common/FilterChangeBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatTime } from '@/utils/formatting/time';
import { formatNumber, formatPacketRate } from '@/utils/formatting/numbers';
import { microsecondsToSeconds } from '@/utils/formatting/time';

interface FilterStatCardProps {
  filter: EnrichedFilterOverview;
  onClick?: (idx: number) => void;
  isMonitored?: boolean;
  isDetached?: boolean;
  isStalled?: boolean;
}

const FilterStatCard: React.FC<FilterStatCardProps> = memo(
  ({
    filter,
    onClick,
    isMonitored = false,
    isDetached = false,
    isStalled = false,
  }) => {
    // Get log alerts for this filter by idx (unique identifier)
    const alerts = useAppSelector((state) =>
      filter.idx !== undefined
        ? (selectAllFilterAlerts(state)[String(filter.idx)] ?? null)
        : null,
    );

    const handleClick = useCallback(() => {
      if (onClick && filter.idx !== undefined) {
        onClick(filter.idx);
      }
    }, [filter.idx, onClick]);

    const hasPackets = Boolean(filter.pck_done && filter.pck_done > 0);
    const hasTime = Boolean(filter.time && filter.time > 0);

    const sessionType =
      !filter.nb_ipid && filter.nb_opid
        ? 'source'
        : filter.nb_ipid && !filter.nb_opid
          ? 'sink'
          : 'process';

    const formattedTime = formatTime(filter.time);
    const formattedPackets = formatNumber(filter.pck_done ?? 0);
    const formattedPacketRate = formatPacketRate(
      microsecondsToSeconds(filter.time ?? 0) > 0
        ? (filter.pck_done ?? 0) / microsecondsToSeconds(filter.time ?? 0)
        : 0,
    );

    const isMonitoredOrDetached = useMemo(
      () => isMonitored || isDetached,
      [isMonitored, isDetached],
    );

    const ringClass = useMemo(() => {
      return isMonitoredOrDetached
        ? 'ring-1 ring-red-700/90'
        : 'ring-1 ring-transparent hover:ring-monitor-accent/40';
    }, [isMonitoredOrDetached]);

    const cursorClass = useMemo(
      () =>
        isDetached
          ? 'cursor-not-allowed opacity-60'
          : 'cursor-pointer hover:bg-white/4',
      [isDetached],
    );

    const sessionTypeLabel =
      sessionType === 'source'
        ? 'Source'
        : sessionType === 'sink'
          ? 'Sink'
          : 'Process';

    return (
      <div
        className={`relativeflex flex-col gap-1.5 p-2.5 rounded-lg bg-black/20 border-transparent  ${ringClass} ${cursorClass}`}
        onClick={handleClick}
      >
        {isMonitored && !isDetached && (
          <MonitoredBadge
            isMonitored
            title="Filter is monitored"
            className="absolute -top-0.5 -left-0.5"
          />
        )}
        {/* Line 1: Name + Type + Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-ui font-semibold text-sm truncate text-monitor-text-primary">
              {filter.name}
            </span>
            {isStalled && (
              <FaExclamationTriangle
                className="h-3.5 w-3.5 text-amber-500 flex-shrink-0"
                title="Stalled - no media progress"
              />
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-xs ring-1 ring-monitor-line bg-white/5 text-monitor-text-secondary"
            >
              {sessionTypeLabel}
            </Badge>
            <FilterChangeBadges filterIdx={filter.idx ?? -1} />
            <StatusBadge
              label={`${alerts?.errors} ERR`}
              colorScheme="red"
              visible={Boolean(alerts && alerts.errors > 0)}
              title={`${alerts?.errors} error(s) in logs`}
            />
            <StatusBadge
              label={`${alerts?.warnings} WARN`}
              colorScheme="amber"
              visible={Boolean(alerts && alerts.warnings > 0)}
              title={`${alerts?.warnings} warning(s) in logs`}
            />
            <StatusBadge
              label="EOS"
              colorScheme="emerald"
              visible={Boolean(filter.is_eos || filter.status?.includes('EOS'))}
            />
          </div>
        </div>

        {/* Line 2: Metrics + PIDs */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-mono tabular-nums text-monitor-text-muted">
          {hasPackets && (
            <>
              <span title="Packets processed">{formattedPackets} pkt</span>
              <span className="text-monitor-text-subtle">•</span>
            </>
          )}
          {hasTime && (
            <>
              <span className="text-info" title="Packet rate">
                {formattedPacketRate}
              </span>
              <span className="text-monitor-text-subtle">•</span>
            </>
          )}
          {hasTime && (
            <span title="time the filter has been running">
              {formattedTime}
            </span>
          )}
          {((filter.errors && filter.errors > 0) ||
            (filter.current_errors && filter.current_errors > 0)) && (
            <>
              <span className="text-monitor-text-subtle">•</span>
              <span className="text-rose-400" title="Errors encountered">
                {(filter.errors || 0) + (filter.current_errors || 0)} err
              </span>
            </>
          )}
        </div>

        {/* Line 3: PIDs */}
        <div
          className="flex items-center justify-end gap-1 text-[0.571rem] font-mono tabular-nums text-monitor-text-muted"
          title="Input PIDs / Output PIDs"
        >
          <span className="uppercase tracking-wider">PIDs</span>
          <span>
            {filter.nb_ipid || 0}/{filter.nb_opid || 0}
          </span>
        </div>
      </div>
    );
  },
  // Note: memo comparison removed to allow alerts updates
  // Alerts come from Redux and need to trigger re-renders
);

FilterStatCard.displayName = 'FilterStatCard';

export default FilterStatCard;
