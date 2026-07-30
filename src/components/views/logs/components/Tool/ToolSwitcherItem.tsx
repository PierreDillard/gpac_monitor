import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { GpacLogLevel, GpacLogTool } from '@/types/domain/gpac/log-types';
import { LEVEL_COLORS } from '../../utils/constants';
import { bgToTextColor, getEffectiveLevel } from '../../utils/toolUtils';
import { StableNumber } from '@/utils/performance/StableNumber';

interface ToolSwitcherItemProps {
  tool: GpacLogTool;
  levelsByTool: Partial<Record<GpacLogTool, GpacLogLevel>>;
  defaultAllLevel: GpacLogLevel;
  logCountsByTool: Record<string, number>;
  currentTool: GpacLogTool;
  isChecked: boolean;
  onToggle: () => void;
  onToolSelect: (tool: GpacLogTool) => void;
}

export const ToolSwitcherItem: React.FC<ToolSwitcherItemProps> = React.memo(
  ({
    tool,
    levelsByTool,
    defaultAllLevel,
    logCountsByTool,
    currentTool,
    isChecked,
    onToggle,
    onToolSelect,
  }) => {
    const {
      effectiveLevel,
      bgColor,
      textColor,
      isActive,
      logCount,
      isCritical,
    } = useMemo(() => {
      const level = getEffectiveLevel(tool, levelsByTool, defaultAllLevel);
      const bg = LEVEL_COLORS[level];
      const critical =
        level === GpacLogLevel.ERROR || level === GpacLogLevel.WARNING;

      return {
        effectiveLevel: level,
        bgColor: bg,
        textColor: bgToTextColor(bg),
        isActive: tool === currentTool,
        logCount: logCountsByTool[tool] || 0,
        isCritical: critical,
      };
    }, [tool, levelsByTool, defaultAllLevel, currentTool, logCountsByTool]);

    return (
      <DropdownMenuItem
        className={`flex items-center gap-2 py-1 px-2 ${isActive ? 'bg-muted' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <Checkbox
          checked={isChecked}
          onCheckedChange={onToggle}
          className={`h-3 w-3 ${
            isChecked
              ? 'data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600'
              : 'bg-gray-700 border-gray-600'
          }`}
          onClick={(event) => event.stopPropagation()}
        />

        <div
          className="flex items-center justify-between flex-1 min-w-0 cursor-pointer"
          onClick={() => onToolSelect(tool)}
        >
          <span className="font-normal text-xs truncate">
            {tool.toUpperCase()}
          </span>
          <Badge
            variant="status"
            className={`text-xs ${textColor} ml-1 transition-none`}
            style={{ backgroundColor: bgColor }}
          >
            {effectiveLevel.toUpperCase()}
            {isCritical && (
              <>
                (<StableNumber value={logCount} />)
              </>
            )}
          </Badge>
        </div>
      </DropdownMenuItem>
    );
  },
);
