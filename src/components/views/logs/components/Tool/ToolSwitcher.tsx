import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GpacLogLevel, GpacLogTool } from '@/types/domain/gpac/log-types';
import { LEVEL_COLORS } from '../../utils/constants';
import { bgToTextColor, getEffectiveLevel } from '../../utils/toolUtils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ToolSwitcherItem } from './ToolSwitcherItem';
import { WidgetStatusBadge } from '@/components/widget/WidgetStatusBadge';

const EmptyToolFallback = React.memo(
  ({
    tool,
    levelsByTool,
    defaultAllLevel,
    logCountsByTool,
  }: {
    tool: GpacLogTool;
    levelsByTool: Partial<Record<GpacLogTool, GpacLogLevel>>;
    defaultAllLevel: GpacLogLevel;
    logCountsByTool: Record<string, number>;
  }) => {
    const effectiveLevel = getEffectiveLevel(
      tool,
      levelsByTool,
      defaultAllLevel,
    );
    const bgColor = LEVEL_COLORS[effectiveLevel];
    const textColor = bgToTextColor(bgColor);
    const logCount = logCountsByTool[tool] || 0;
    const isCritical =
      effectiveLevel === GpacLogLevel.ERROR ||
      effectiveLevel === GpacLogLevel.WARNING;

    return (
      <DropdownMenuItem
        className="flex items-center gap-2 py-1 px-2 bg-muted"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <Checkbox
          checked={true}
          onCheckedChange={() => {}}
          className="h-3 w-3 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
          onClick={(event) => event.stopPropagation()}
        />

        <div className="flex items-center justify-between flex-1 min-w-0">
          <span className="font-normal text-xs truncate">
            {tool.toUpperCase()}
          </span>
          <Badge
            variant="status"
            className={`text-xs ${textColor} ml-1`}
            style={{ backgroundColor: bgColor }}
            title="Active log(s)"
          >
            {effectiveLevel.toUpperCase()}
            {isCritical && `(${logCount})`}
          </Badge>
        </div>
      </DropdownMenuItem>
    );
  },
);

interface ToolSwitcherProps {
  currentTool: GpacLogTool;
  levelsByTool: Partial<Record<GpacLogTool, GpacLogLevel>>;
  defaultAllLevel: GpacLogLevel;
  visibleLogsCount: number;
  allLogCountsByTool: Record<string, number>;
  criticalLogCountsByTool: Record<string, number>;
  visibleToolsFilter: GpacLogTool[];
  onToolSelect: (tool: GpacLogTool) => void;
  onToggleToolFilter?: (tool: GpacLogTool) => void;
  onClearFilter?: () => void;
  onSelectAllTools?: (tools: GpacLogTool[]) => void;
}

export const ToolSwitcher: React.FC<ToolSwitcherProps> = React.memo(
  ({
    currentTool,
    levelsByTool,
    defaultAllLevel,
    visibleLogsCount,
    allLogCountsByTool,
    criticalLogCountsByTool,
    visibleToolsFilter,
    onToolSelect,
    onClearFilter,
    onSelectAllTools,
  }) => {
    const configuredTools = React.useMemo(() => {
      const tools = new Set<GpacLogTool>();

      // Only add tools that have logs in buffers (ignore tools with 0 logs)
      Object.keys(allLogCountsByTool).forEach((tool) => {
        if (allLogCountsByTool[tool] > 0) {
          tools.add(tool as GpacLogTool);
        }
      });

      return Array.from(tools).sort();
    }, [allLogCountsByTool]);

    const isAll =
      visibleToolsFilter.length > 0 &&
      visibleToolsFilter.length === configuredTools.length;
    const parentChecked = isAll;

    const currentDisplayInfo = React.useMemo(() => {
      if (
        visibleToolsFilter.length > 0 &&
        visibleToolsFilter.length === configuredTools.length
      ) {
        return {
          label: 'ALL',
          effectiveLevel: '',
          bgColor: '#6b7280',
          textColor: 'text-white',
          isCritical: false,
        };
      }

      const effectiveLevel = getEffectiveLevel(
        currentTool,
        levelsByTool,
        defaultAllLevel,
      );
      const bgColor = LEVEL_COLORS[effectiveLevel];
      const textColor = bgToTextColor(bgColor);
      const isCritical =
        effectiveLevel === GpacLogLevel.ERROR ||
        effectiveLevel === GpacLogLevel.WARNING;
      return {
        label: currentTool.toUpperCase(),
        effectiveLevel,
        bgColor,
        textColor,
        isCritical,
      };
    }, [
      currentTool,
      levelsByTool,
      defaultAllLevel,
      visibleToolsFilter,
      configuredTools,
    ]);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="px-0 py-0"
            title="Active logs"
          >
            <WidgetStatusBadge className="cursor-pointer hover:opacity-80 ">
              <span className="text-sm font-medium text-info">
                {currentDisplayInfo.label}
                {currentDisplayInfo.effectiveLevel &&
                  ` : ${currentDisplayInfo.effectiveLevel.toUpperCase()}`}
                {currentDisplayInfo.isCritical && ` (${visibleLogsCount})`}
              </span>
            </WidgetStatusBadge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 max-h-80 overflow-y-auto"
        >
          {/* ALL control at the top */}
          {configuredTools.length > 0 && (
            <>
              <DropdownMenuItem
                className="flex items-center gap-2 py-1 px-2"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <Checkbox
                  checked={parentChecked}
                  onCheckedChange={() => {
                    if (isAll) {
                      onClearFilter?.();
                    } else {
                      onSelectAllTools?.(configuredTools);
                    }
                  }}
                  className={`h-3 w-3 ${
                    parentChecked
                      ? 'data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600'
                      : 'bg-gray-700 border-gray-600'
                  }`}
                  onClick={(event) => event.stopPropagation()}
                />
                <span className="text-xs font-medium">ALL</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
            </>
          )}

          {/* Show tools with logs, or currentTool if no logs exist */}
          {configuredTools.length > 0 ? (
            configuredTools.map((tool) => {
              // If visibleToolsFilter is active, check if tool is in the filter
              // Otherwise, only currentTool is checked
              const isChecked =
                visibleToolsFilter.length > 0
                  ? visibleToolsFilter.includes(tool)
                  : tool === currentTool;
              return (
                <ToolSwitcherItem
                  key={tool}
                  tool={tool}
                  levelsByTool={levelsByTool}
                  defaultAllLevel={defaultAllLevel}
                  logCountsByTool={criticalLogCountsByTool}
                  currentTool={currentTool}
                  isChecked={isChecked}
                  onToggle={() => {
                    // If filter is active, clear it first to go to single-tool mode
                    if (visibleToolsFilter.length > 0) {
                      onClearFilter?.();
                    }
                    onToolSelect(tool);
                  }}
                  onToolSelect={onToolSelect}
                />
              );
            })
          ) : (
            /* If no logs, show only currentTool */
            <EmptyToolFallback
              key={currentTool}
              tool={currentTool}
              levelsByTool={levelsByTool}
              defaultAllLevel={defaultAllLevel}
              logCountsByTool={criticalLogCountsByTool}
            />
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);
