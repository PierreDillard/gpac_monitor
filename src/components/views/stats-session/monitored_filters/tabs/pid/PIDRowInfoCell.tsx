import { memo, useCallback } from 'react';
import { LuEye } from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/redux';
import { Badge } from '@/components/ui/badge';
import {
  getStreamTypeBadgeConfig,
  STREAM_TYPE_SHORT_LABEL,
} from '@/utils/filters/streamType';
import { PID_SELECTION_COLORS } from './utils/pidColors';
import { toggleSelectedPid } from '@/shared/store/slices/monitoredFilterSlice';
import { selectPidColorIndexByKey } from '@/shared/store/selectors';
import { buildPIDDisplayLabel } from './utils/pidLabel';
import { GraphRadio } from '@/components/common/charts';
import type { PIDWithIndex } from '../../../types';

interface PIDRowInfoCellProps {
  pid: PIDWithIndex;
  filterIdx: number;
  variant: 'input' | 'output';
  pidKey: string;
  infoLine: string;
  onOpenProps: () => void;
}

const PIDRowInfoCell = memo(
  ({
    pid,
    filterIdx,
    variant,
    pidKey,
    infoLine,
    onOpenProps,
  }: PIDRowInfoCellProps) => {
    const dispatch = useAppDispatch();
    const colorIndex = useAppSelector(
      (state) => selectPidColorIndexByKey(state)[pidKey] ?? -1,
    );
    const isSelected = colorIndex >= 0;

    const badgeConfig = getStreamTypeBadgeConfig(pid.type);

    const handleToggleSelect = useCallback(() => {
      dispatch(
        toggleSelectedPid({
          filterIdx,
          direction: variant,
          pidIndex: pid.pidIdx,
          label: buildPIDDisplayLabel(pid),
          streamTypeLabel: STREAM_TYPE_SHORT_LABEL[pid.type],
        }),
      );
    }, [dispatch, filterIdx, variant, pid]);

    return (
      <div className="min-w-0 flex items-center gap-1.5">
        <GraphRadio
          active={isSelected}
          onClick={handleToggleSelect}
          label={buildPIDDisplayLabel(pid)}
          color={isSelected ? PID_SELECTION_COLORS[colorIndex] : undefined}
        />
        {variant === 'input' && (
          <button
            onClick={onOpenProps}
            className=" rounded bg-gray-700/50 border border-gray-600/50 text-gray-300 hover:bg-gray-700/80 flex-shrink-0"
            title="View input properties"
          >
            <LuEye className="h-4 w-5" />
          </button>
        )}
        <Badge
          variant="outline"
          className={`px-1.5 py-0 h-5 font-mono font-bold text-[0.714rem] flex-shrink-0 ${isSelected ? '' : badgeConfig.className}`}
          style={
            isSelected
              ? {
                  borderColor: PID_SELECTION_COLORS[colorIndex],
                  color: PID_SELECTION_COLORS[colorIndex],
                }
              : undefined
          }
        >
          {badgeConfig.label}
        </Badge>
        <span
          className="min-w-0 truncate text-muted-foreground"
          title={infoLine}
        >
          {infoLine}
        </span>
      </div>
    );
  },
);

PIDRowInfoCell.displayName = 'PIDRowInfoCell';

export default PIDRowInfoCell;
