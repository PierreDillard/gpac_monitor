import { Widget, WidgetType } from '@/types/ui/widget';
import { IconType } from 'react-icons';
import LogsMonitor from '../views/logs/LogsMonitor';
import MetricsMonitor from '../views/cpu/MetricsMonitor';
import GraphMonitor from '../views/graph/GraphMonitor';
import MultiFilterMonitor from '../views/stats-session/session-overview/entry';
import { generateID } from '@/utils/core';
import { widgetIcons } from './widgetIcons';

export interface WidgetDefinition {
  type: WidgetType;
  title: string;
  icon: IconType;
  component: React.ElementType;
  defaultSize: { w: number; h: number };
  minWidth: number;
  defaultPosition?: { x: number; y: number };
  defaultZIndex?: number;
  description?: string;
  enabled: boolean;
  fixedPosition?: boolean;
}

export const widgetRegistry: Record<WidgetType, WidgetDefinition> = {
  [WidgetType.FILTERSESSION]: {
    type: WidgetType.FILTERSESSION,
    title: 'Session Filters',
    icon: widgetIcons[WidgetType.FILTERSESSION],
    component: MultiFilterMonitor,
    defaultSize: { w: 11, h: 8 },
    minWidth: 10,
    defaultPosition: { x: 13, y: 0 },
    defaultZIndex: 1000,
    description: 'Manage session filters effectively.',
    enabled: true,
  },
  [WidgetType.GRAPH]: {
    type: WidgetType.GRAPH,
    title: 'Pipeline Graph',
    icon: widgetIcons[WidgetType.GRAPH],
    component: GraphMonitor,
    defaultSize: { w: 13, h: 8 },
    minWidth: 2,
    defaultPosition: { x: 0, y: 0 },
    defaultZIndex: 1004,
    description: 'Visualize the processing pipeline graph.',
    enabled: true,
  },
  [WidgetType.METRICS]: {
    type: WidgetType.METRICS,
    title: 'System Metrics',
    icon: widgetIcons[WidgetType.METRICS],
    component: MetricsMonitor,
    defaultSize: { w: 6, h: 4 },
    minWidth: 4,
    defaultPosition: { x: 0, y: 8 },
    defaultZIndex: 1001,
    description: 'Display real-time system performance metrics.',
    enabled: true,
  },
  [WidgetType.LOGS]: {
    type: WidgetType.LOGS,
    title: 'System Logs',
    icon: widgetIcons[WidgetType.LOGS],
    component: LogsMonitor,
    defaultSize: { w: 18, h: 4 },
    minWidth: 2,
    defaultPosition: { x: 6, y: 8 },
    defaultZIndex: 1002,
    description: 'View and filter system logs.',
    enabled: true,
  },
};

export const createWidgetInstance = (type: WidgetType): Widget | null => {
  const def = widgetRegistry[type];
  if (!def || !def.enabled) return null;

  const id = generateID(type);
  const { w, h } = def.defaultSize;
  const { x = 0, y = 0 } = def.defaultPosition || {};

  return {
    id,
    type,
    title: def.title,
    x,
    y,
    w,
    h,
    fixedPosition: def.fixedPosition,
  };
};

export const getAllWidgets = (): WidgetDefinition[] =>
  Object.values(widgetRegistry);
export const getWidgetDefinition = (type: WidgetType): WidgetDefinition =>
  widgetRegistry[type];
