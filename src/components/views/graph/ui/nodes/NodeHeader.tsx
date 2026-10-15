import type { CSSProperties } from 'react';
import FilterChangeBadges from '@/components/common/FilterChangeBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { FilterSessionType } from '../../utils/filterType';

interface NodeHeaderProps {
  filterIdx: number;
  fullLabel: string;
  displayLabel: string;
  sessionType: FilterSessionType;
  hasError: boolean;
  hasWarning: boolean;
  headerStyle: CSSProperties;
  textStyle: CSSProperties;
}

export default function NodeHeader({
  filterIdx,
  fullLabel,
  displayLabel,
  sessionType,
  hasError,
  hasWarning,
  headerStyle,
  textStyle,
}: NodeHeaderProps) {
  return (
    <div
      className="rounded-t-xl -m-4 mb-2 px-4 py-3 shadow-sm"
      style={headerStyle}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h3
            className="font-bold text-sm truncate"
            style={textStyle}
            title={fullLabel}
          >
            {displayLabel}
          </h3>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span
            className="text-xs font-medium px-2 py-1 bg-white/60 rounded-full"
            style={textStyle}
            title={
              sessionType === 'source'
                ? 'Source Filter'
                : sessionType === 'sink'
                  ? 'Sink Filter'
                  : 'Processing Filter'
            }
          >
            {sessionType.toUpperCase()}
          </span>
          <FilterChangeBadges filterIdx={filterIdx} />
          <StatusBadge
            label="ERR"
            colorScheme="red"
            visible={hasError}
            title="Error(s) in logs"
          />
          <StatusBadge
            label="WARN"
            colorScheme="amber"
            visible={hasWarning}
            title="Warning(s) in logs"
          />
        </div>
      </div>
    </div>
  );
}
