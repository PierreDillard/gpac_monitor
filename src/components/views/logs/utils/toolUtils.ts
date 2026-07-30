import { GpacLogLevel, GpacLogTool } from '@/types/domain/gpac/log-types';
import { TOOL_DISPLAY_NAMES } from './constants';

export const getEffectiveLevel = (
  tool: GpacLogTool,
  levelsByTool: Partial<Record<GpacLogTool, GpacLogLevel>>,
  defaultAllLevel: GpacLogLevel,
): GpacLogLevel => {
  return tool === GpacLogTool.ALL
    ? defaultAllLevel
    : (levelsByTool[tool] ?? defaultAllLevel);
};

export const sortTools = (currentTool: GpacLogTool): GpacLogTool[] => {
  return Object.values(GpacLogTool).sort((a, b) => {
    if (a === currentTool) return -1;
    if (b === currentTool) return 1;

    if (a === GpacLogTool.ALL) return 1;
    if (b === GpacLogTool.ALL) return -1;

    const nameA = TOOL_DISPLAY_NAMES[a];
    const nameB = TOOL_DISPLAY_NAMES[b];

    if (!nameA && !nameB) return 0;
    if (!nameA) return 1;
    if (!nameB) return -1;

    return nameA.localeCompare(nameB);
  });
};

export const bgToTextColor = (bgColorClass: string): string => {
  return bgColorClass.replace('bg-', 'text-');
};
